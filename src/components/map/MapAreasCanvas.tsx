
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MapArea, Map, Point } from './types';

interface MapAreasCanvasProps {
  map: Map;
  mapAreas: MapArea[];
  activeMode: 'view' | 'area';
  onAreaAdd: (coordinates: Point[], areaName: string, areaType: string, description?: string) => void;
  userRole: string;
}

const MapAreasCanvas: React.FC<MapAreasCanvasProps> = ({
  map,
  mapAreas,
  activeMode,
  onAreaAdd,
  userRole
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [isDrawingPolygon, setIsDrawingPolygon] = useState(false);
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);
  const [currentMousePos, setCurrentMousePos] = useState<Point | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [newAreaCoordinates, setNewAreaCoordinates] = useState<Point[] | null>(null);

  // Load and cache the image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      console.log('Image loaded successfully');
      imageRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = (error) => {
      console.error('Failed to load image:', error);
      setImageLoaded(false);
    };
    img.src = map.image_url;
    
    return () => {
      imageRef.current = null;
      setImageLoaded(false);
    };
  }, [map.image_url]);

  // Initialize canvas size and scale
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current || !imageLoaded) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;
    
    // Set canvas size to container size
    const containerRect = container.getBoundingClientRect();
    canvas.width = containerRect.width;
    canvas.height = containerRect.height;

    // Calculate initial scale to fit image
    const scaleX = canvas.width / (map.width || 1);
    const scaleY = canvas.height / (map.height || 1);
    const initialScale = Math.min(scaleX, scaleY, 1);
    
    setScale(initialScale);
    setOffset({
      x: (canvas.width - (map.width || 0) * initialScale) / 2,
      y: (canvas.height - (map.height || 0) * initialScale) / 2
    });
  }, [map, imageLoaded]);

  // Get area color based on type
  const getAreaColor = (areaType: string) => {
    const colors: { [key: string]: string } = {
      'terrain': '#22c55e',
      'landmark': '#3b82f6',
      'region': '#f59e0b',
      'settlement': '#8b5cf6',
      'water': '#06b6d4',
      'forest': '#16a34a',
      'mountain': '#78716c',
      'desert': '#eab308',
      'default': '#ef4444'
    };
    return colors[areaType] || colors.default;
  };

  // Convert normalized coordinates to pixel coordinates
  const normalizedToPixel = (point: Point): Point => ({
    x: point.x * (map.width || 0),
    y: point.y * (map.height || 0)
  });

  // Draw polygon on canvas
  const drawPolygon = (ctx: CanvasRenderingContext2D, points: Point[], color: string, fill = true, stroke = true) => {
    if (points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    
    if (points.length > 2) {
      ctx.closePath();
    }

    if (fill && points.length > 2) {
      ctx.fillStyle = color + '40'; // 25% transparency
      ctx.fill();
    }

    if (stroke) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
    }
  };

  // Draw everything on canvas
  const draw = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save context
    ctx.save();
    
    // Apply transformations
    ctx.translate(offset.x, offset.y);
    ctx.scale(scale, scale);

    // Draw map image
    ctx.drawImage(imageRef.current, 0, 0, map.width || 0, map.height || 0);
    
    // Draw existing map areas
    mapAreas.forEach(area => {
      const color = getAreaColor(area.area_type);
      
      if (area.polygon_coordinates && area.polygon_coordinates.length > 0) {
        // Draw polygon area
        const pixelPoints = area.polygon_coordinates.map(normalizedToPixel);
        drawPolygon(ctx, pixelPoints, color);
        
        // Draw area label at centroid
        if (pixelPoints.length > 2) {
          const centroid = pixelPoints.reduce(
            (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
            { x: 0, y: 0 }
          );
          centroid.x /= pixelPoints.length;
          centroid.y /= pixelPoints.length;
          
          ctx.fillStyle = color;
          ctx.font = `${12 / scale}px Arial`;
          ctx.textAlign = 'center';
          ctx.fillText(area.area_name, centroid.x, centroid.y);
        }
      } else if (area.bounding_box) {
        // Draw legacy rectangular area
        const bbox = area.bounding_box;
        const x1 = bbox.x1 * (map.width || 0);
        const y1 = bbox.y1 * (map.height || 0);
        const x2 = bbox.x2 * (map.width || 0);
        const y2 = bbox.y2 * (map.height || 0);
        
        // Draw area rectangle with transparency
        ctx.fillStyle = color + '40';
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        
        // Draw area border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / scale;
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        
        // Draw area label
        ctx.fillStyle = color;
        ctx.font = `${12 / scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(area.area_name, (x1 + x2) / 2, (y1 + y2) / 2);
      }
    });

    // Draw current polygon being drawn
    if (isDrawingPolygon && polygonPoints.length > 0) {
      // Draw completed segments
      if (polygonPoints.length > 1) {
        drawPolygon(ctx, polygonPoints, '#ff6b35', false, true);
      }
      
      // Draw line to current mouse position
      if (currentMousePos && polygonPoints.length > 0) {
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 2 / scale;
        ctx.setLineDash([5 / scale, 5 / scale]);
        ctx.beginPath();
        ctx.moveTo(polygonPoints[polygonPoints.length - 1].x, polygonPoints[polygonPoints.length - 1].y);
        ctx.lineTo(currentMousePos.x, currentMousePos.y);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Draw polygon points
      polygonPoints.forEach((point, index) => {
        ctx.fillStyle = '#ff6b35';
        ctx.beginPath();
        ctx.arc(point.x, point.y, 4 / scale, 0, 2 * Math.PI);
        ctx.fill();
        
        // Label the points
        ctx.fillStyle = '#000';
        ctx.font = `${10 / scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText((index + 1).toString(), point.x, point.y - 8 / scale);
      });
    }
    
    // Restore context
    ctx.restore();
  }, [map, mapAreas, scale, offset, isDrawingPolygon, polygonPoints, currentMousePos, imageLoaded]);

  // Draw on every render
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeMode === 'view') {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDragging && activeMode === 'view') {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      setOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (activeMode === 'area' && isDrawingPolygon) {
      // Update current mouse position for preview line
      const mapX = (mouseX - offset.x) / scale;
      const mapY = (mouseY - offset.y) / scale;
      
      if (mapX >= 0 && mapX <= (map.width || 0) && mapY >= 0 && mapY <= (map.height || 0)) {
        setCurrentMousePos({ x: mapX, y: mapY });
      }
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    if (activeMode !== 'area' || userRole !== 'dm') return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to map coordinates
    const mapX = (mouseX - offset.x) / scale;
    const mapY = (mouseY - offset.y) / scale;

    if (mapX >= 0 && mapX <= (map.width || 0) && mapY >= 0 && mapY <= (map.height || 0)) {
      const newPoint = { x: mapX, y: mapY };
      
      if (!isDrawingPolygon) {
        // Start new polygon
        setIsDrawingPolygon(true);
        setPolygonPoints([newPoint]);
      } else {
        // Add point to existing polygon
        setPolygonPoints(prev => [...prev, newPoint]);
      }
    }
  };

  const handleFinishPolygon = () => {
    if (polygonPoints.length >= 3) {
      // Convert to normalized coordinates
      const normalizedPoints = polygonPoints.map(point => ({
        x: point.x / (map.width || 1),
        y: point.y / (map.height || 1)
      }));
      
      setNewAreaCoordinates(normalizedPoints);
      setShowAreaDialog(true);
    }
    
    // Reset polygon drawing state
    setIsDrawingPolygon(false);
    setPolygonPoints([]);
    setCurrentMousePos(null);
  };

  const handleCancelPolygon = () => {
    setIsDrawingPolygon(false);
    setPolygonPoints([]);
    setCurrentMousePos(null);
  };

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    
    if (!canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    // Calculate zoom factor
    const zoomIntensity = 0.1;
    const wheel = e.deltaY < 0 ? 1 : -1;
    const zoom = Math.exp(wheel * zoomIntensity);
    
    // Calculate new scale
    const newScale = Math.max(0.1, Math.min(10, scale * zoom));
    
    // Calculate the point under the mouse in world coordinates
    const worldX = (mouseX - offset.x) / scale;
    const worldY = (mouseY - offset.y) / scale;
    
    // Calculate new offset to keep the point under the mouse
    const newOffsetX = mouseX - worldX * newScale;
    const newOffsetY = mouseY - worldY * newScale;
    
    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  }, [scale, offset]);

  const handleAreaSubmit = (areaName: string, areaType: string, description?: string) => {
    if (newAreaCoordinates) {
      onAreaAdd(newAreaCoordinates, areaName, areaType, description);
    }
    setShowAreaDialog(false);
    setNewAreaCoordinates(null);
  };

  return (
    <div className="space-y-4">
      <div 
        ref={containerRef}
        className="relative w-full h-[600px] border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100"
      >
        {!imageLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-800 mx-auto mb-2"></div>
              <p className="text-amber-800 text-sm">Loading map image...</p>
            </div>
          </div>
        )}
        
        <canvas
          ref={canvasRef}
          className={imageLoaded ? "cursor-crosshair" : "hidden"}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          style={{
            cursor: activeMode === 'view' ? (isDragging ? 'grabbing' : 'grab') : 'crosshair'
          }}
        />
        
        {/* Instructions overlay */}
        {imageLoaded && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-60 text-white p-3 rounded-lg text-sm">
            {activeMode === 'view' && (
              <div>
                <p>🖱️ Click and drag to pan</p>
                <p>🔍 Scroll to zoom</p>
              </div>
            )}
            {activeMode === 'area' && userRole === 'dm' && (
              <div>
                {!isDrawingPolygon && <p>📐 Click to start drawing area</p>}
                {isDrawingPolygon && (
                  <div>
                    <p>📍 Click to add points ({polygonPoints.length} points)</p>
                    <p>🎯 Need at least 3 points to finish</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Drawing controls */}
        {activeMode === 'area' && userRole === 'dm' && isDrawingPolygon && (
          <div className="absolute bottom-4 left-4 space-x-2">
            <Button
              onClick={handleFinishPolygon}
              disabled={polygonPoints.length < 3}
              size="sm"
              className="bg-green-600 hover:bg-green-700"
            >
              Finish Area ({polygonPoints.length} points)
            </Button>
            <Button
              onClick={handleCancelPolygon}
              variant="outline"
              size="sm"
            >
              Cancel
            </Button>
          </div>
        )}

        {/* Zoom level indicator */}
        {imageLoaded && (
          <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white p-2 rounded text-sm">
            Zoom: {Math.round(scale * 100)}%
          </div>
        )}
      </div>

      {/* Area Creation Dialog */}
      {showAreaDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-lg max-w-md w-full mx-4">
            <h3 className="text-lg font-bold mb-4">Create New Area</h3>
            <form onSubmit={(e) => {
              e.preventDefault();
              const formData = new FormData(e.currentTarget);
              handleAreaSubmit(
                formData.get('areaName') as string,
                formData.get('areaType') as string,
                formData.get('description') as string || undefined
              );
            }}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Area Name</label>
                  <input
                    name="areaName"
                    type="text"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="Enter area name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Area Type</label>
                  <select
                    name="areaType"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2"
                  >
                    <option value="">Select type</option>
                    <option value="terrain">Terrain</option>
                    <option value="landmark">Landmark</option>
                    <option value="region">Region</option>
                    <option value="settlement">Settlement</option>
                    <option value="water">Water</option>
                    <option value="forest">Forest</option>
                    <option value="mountain">Mountain</option>
                    <option value="desert">Desert</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Description (Optional)</label>
                  <textarea
                    name="description"
                    rows={3}
                    className="w-full border border-gray-300 rounded px-3 py-2"
                    placeholder="Enter description"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-2 mt-6">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowAreaDialog(false);
                    setNewAreaCoordinates(null);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit">Create Area</Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapAreasCanvas;
