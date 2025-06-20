import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Map, MapArea, Point, RegionType } from './types';
import { ZoomIn, ZoomOut } from 'lucide-react';

interface MapAreasCanvasProps {
  map: Map;
  mapAreas: MapArea[];
  activeMode: 'view' | 'area';
  onAreaAdd: (coordinates: Point[], areaName: string, areaType: string, description?: string) => void;
  userRole: string;
  regionTypes: RegionType[];
  hiddenTypes: Set<string>;
  getAreaColor: (areaType: string) => string;
}

const MapAreasCanvas: React.FC<MapAreasCanvasProps> = ({
  map,
  mapAreas,
  activeMode,
  onAreaAdd,
  userRole,
  regionTypes,
  hiddenTypes,
  getAreaColor
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  // Area creation states
  const [isCreatingArea, setIsCreatingArea] = useState(false);
  const [currentPolygon, setCurrentPolygon] = useState<Point[]>([]);
  const [showAreaForm, setShowAreaForm] = useState(false);
  const [areaForm, setAreaForm] = useState({
    name: '',
    type: 'terrain',
    description: ''
  });

  // Get available area types
  const availableTypes = [
    'terrain', 'landmark', 'region', 'settlement', 'water', 
    'forest', 'mountain', 'desert',
    ...regionTypes.map(type => type.name)
  ];

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Save context state
    ctx.save();

    // Apply transformations: first translate, then scale
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw the map image
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, map.width || 800, map.height || 600);
      
      // Draw existing areas
      mapAreas.forEach((area) => {
        if (area.is_visible === false || hiddenTypes.has(area.area_type)) return;

        const color = getAreaColor(area.area_type);
        
        if (area.polygon_coordinates && area.polygon_coordinates.length > 0) {
          // Draw polygon
          ctx.fillStyle = color + '40'; // 25% opacity
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 / scale; // Adjust line width for zoom
          
          ctx.beginPath();
          area.polygon_coordinates.forEach((point, index) => {
            const x = point.x * (map.width || 800);
            const y = point.y * (map.height || 600);
            if (index === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          });
          ctx.closePath();
          ctx.fill();
          ctx.stroke();

          // Draw area name
          if (area.polygon_coordinates.length > 0) {
            const centerX = area.polygon_coordinates.reduce((sum, p) => sum + p.x, 0) / area.polygon_coordinates.length * (map.width || 800);
            const centerY = area.polygon_coordinates.reduce((sum, p) => sum + p.y, 0) / area.polygon_coordinates.length * (map.height || 600);
            
            ctx.fillStyle = '#000000';
            ctx.font = `${14 / scale}px Arial`; // Adjust font size for zoom
            ctx.textAlign = 'center';
            ctx.fillText(area.area_name, centerX, centerY);
          }
        } else if (area.bounding_box) {
          // Draw legacy rectangle
          const { x1, y1, x2, y2 } = area.bounding_box;
          const width = Math.abs(x2 - x1);
          const height = Math.abs(y2 - y1);
          
          ctx.fillStyle = color + '40';
          ctx.strokeStyle = color;
          ctx.lineWidth = 2 / scale; // Adjust line width for zoom
          ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), width, height);
          ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), width, height);
          
          // Draw area name
          ctx.fillStyle = '#000000';
          ctx.font = `${14 / scale}px Arial`; // Adjust font size for zoom
          ctx.textAlign = 'center';
          ctx.fillText(area.area_name, (x1 + x2) / 2, (y1 + y2) / 2);
        }
      });

      // Draw current polygon being created (transform back to screen coordinates)
      ctx.restore(); // Restore to screen coordinate system
      if (currentPolygon.length > 0) {
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 3;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        currentPolygon.forEach((point, index) => {
          // Transform map coordinates to screen coordinates
          const screenX = (point.x * scale) + offset.x;
          const screenY = (point.y * scale) + offset.y;
          if (index === 0) {
            ctx.moveTo(screenX, screenY);
          } else {
            ctx.lineTo(screenX, screenY);
          }
        });
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw points
        currentPolygon.forEach(point => {
          const screenX = (point.x * scale) + offset.x;
          const screenY = (point.y * scale) + offset.y;
          ctx.fillStyle = '#ff0000';
          ctx.beginPath();
          ctx.arc(screenX, screenY, 4, 0, 2 * Math.PI);
          ctx.fill();
        });
      }
    };
    img.src = map.image_url;
  }, [map, mapAreas, scale, offset, currentPolygon, hiddenTypes, getAreaColor]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      drawCanvas();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawCanvas]);

  // Convert screen coordinates to map coordinates
  const screenToMap = (screenX: number, screenY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // Transform screen coordinates to map coordinates
    const mapX = (canvasX - offset.x) / scale;
    const mapY = (canvasY - offset.y) / scale;
    
    return { x: mapX, y: mapY };
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeMode === 'area' && userRole === 'dm') {
      const mapCoords = screenToMap(e.clientX, e.clientY);
      
      if (isCreatingArea) {
        // Add point to current polygon
        setCurrentPolygon(prev => [...prev, mapCoords]);
      }
    }
  };

  const handleCanvasDoubleClick = () => {
    if (activeMode === 'area' && userRole === 'dm' && currentPolygon.length >= 3) {
      // Finish creating polygon
      setShowAreaForm(true);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (activeMode === 'view' || userRole !== 'dm') {
      setIsDragging(true);
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      setDragStart({ 
        x: canvasX - offset.x, 
        y: canvasY - offset.y 
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const rect = canvas.getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;
      
      setOffset({
        x: canvasX - dragStart.x,
        y: canvasY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Calculate zoom factor
    const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.1, Math.min(5, scale * zoomFactor));

    if (newScale !== scale) {
      // Calculate the point in map coordinates before zoom
      const mapX = (mouseX - offset.x) / scale;
      const mapY = (mouseY - offset.y) / scale;
      
      // Calculate new offset to keep the mouse point fixed
      const newOffsetX = mouseX - mapX * newScale;
      const newOffsetY = mouseY - mapY * newScale;
      
      setOffset({ x: newOffsetX, y: newOffsetY });
      setScale(newScale);
    }
  };

  const handleZoomIn = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const newScale = Math.min(5, scale * 1.2);
    
    // Calculate the point in map coordinates before zoom
    const mapX = (centerX - offset.x) / scale;
    const mapY = (centerY - offset.y) / scale;
    
    // Calculate new offset to keep the center point fixed
    const newOffsetX = centerX - mapX * newScale;
    const newOffsetY = centerY - mapY * newScale;
    
    setOffset({ x: newOffsetX, y: newOffsetY });
    setScale(newScale);
  };

  const handleZoomOut = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    
    const newScale = Math.max(0.1, scale * 0.8);
    
    // Calculate the point in map coordinates before zoom
    const mapX = (centerX - offset.x) / scale;
    const mapY = (centerY - offset.y) / scale;
    
    // Calculate new offset to keep the center point fixed
    const newOffsetX = centerX - mapX * newScale;
    const newOffsetY = centerY - mapY * newScale;
    
    setOffset({ x: newOffsetX, y: newOffsetY });
    setScale(newScale);
  };

  const handleResetZoom = () => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  };

  const startAreaCreation = () => {
    setIsCreatingArea(true);
    setCurrentPolygon([]);
  };

  const cancelAreaCreation = () => {
    setIsCreatingArea(false);
    setCurrentPolygon([]);
    setShowAreaForm(false);
    setAreaForm({ name: '', type: 'terrain', description: '' });
  };

  const handleAreaSubmit = () => {
    if (currentPolygon.length >= 3 && areaForm.name) {
      // Convert to normalized coordinates
      const normalizedCoords = currentPolygon.map(point => ({
        x: point.x / (map.width || 800),
        y: point.y / (map.height || 600)
      }));
      
      onAreaAdd(normalizedCoords, areaForm.name, areaForm.type, areaForm.description);
      cancelAreaCreation();
    }
  };

  return (
    <div className="space-y-4">
      {/* Canvas Controls */}
      {userRole === 'dm' && activeMode === 'area' && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-amber-900">Create Area</h3>
            <div className="flex space-x-2">
              {!isCreatingArea ? (
                <Button onClick={startAreaCreation}>
                  Start Creating Area
                </Button>
              ) : (
                <>
                  <Button onClick={cancelAreaCreation} variant="outline">
                    Cancel
                  </Button>
                  {currentPolygon.length >= 3 && (
                    <Button onClick={() => setShowAreaForm(true)}>
                      Finish Area
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
          
          {isCreatingArea && (
            <p className="text-sm text-amber-700">
              Click points on the map to create a custom area. Double-click or use "Finish Area" when done (minimum 3 points).
              Current points: {currentPolygon.length}
            </p>
          )}
        </Card>
      )}

      {/* Area Form Modal */}
      {showAreaForm && (
        <Card className="p-4 border-2 border-amber-400">
          <h3 className="font-medium text-amber-900 mb-4">Create New Area</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-amber-800">Area Name</label>
              <Input
                value={areaForm.name}
                onChange={(e) => setAreaForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter area name"
              />
            </div>
            
            <div>
              <label className="text-sm font-medium text-amber-800">Area Type</label>
              <Select value={areaForm.type} onValueChange={(value) => setAreaForm(prev => ({ ...prev, type: value }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableTypes.map(type => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-amber-800">Description (Optional)</label>
              <Textarea
                value={areaForm.description}
                onChange={(e) => setAreaForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Enter area description"
                rows={3}
              />
            </div>
            
            <div className="flex space-x-2">
              <Button onClick={handleAreaSubmit} disabled={!areaForm.name}>
                Create Area
              </Button>
              <Button onClick={cancelAreaCreation} variant="outline">
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Canvas Container */}
      <div 
        ref={containerRef}
        className="relative w-full h-[600px] border border-amber-300 rounded-lg overflow-hidden bg-gray-100"
      >
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
          onDoubleClick={handleCanvasDoubleClick}
          onWheel={handleWheel}
          className="cursor-crosshair"
          style={{ cursor: activeMode === 'area' && userRole === 'dm' ? 'crosshair' : isDragging ? 'grabbing' : 'grab' }}
        />
        
        {/* Enhanced Canvas Controls */}
        <div className="absolute top-4 right-4 space-y-2">
          <div className="flex flex-col space-y-1">
            <Button
              onClick={handleZoomIn}
              size="sm"
              variant="outline"
              className="bg-white/90 hover:bg-white"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleZoomOut}
              size="sm"
              variant="outline"
              className="bg-white/90 hover:bg-white"
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              onClick={handleResetZoom}
              size="sm"
              variant="outline"
              className="bg-white/90 hover:bg-white text-xs px-2"
            >
              Reset
            </Button>
          </div>
          <div className="bg-white/90 px-2 py-1 rounded text-xs font-medium">
            {Math.round(scale * 100)}%
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapAreasCanvas;
