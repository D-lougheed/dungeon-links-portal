import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { MapArea, Map } from './types';

interface MapAreasCanvasProps {
  map: Map;
  mapAreas: MapArea[];
  activeMode: 'view' | 'area';
  onAreaAdd: (boundingBox: { x1: number; y1: number; x2: number; y2: number }, areaName: string, areaType: string, description?: string) => void;
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
  const [isDrawingArea, setIsDrawingArea] = useState(false);
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null);
  const [currentRect, setCurrentRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showAreaDialog, setShowAreaDialog] = useState(false);
  const [newAreaBounds, setNewAreaBounds] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

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
      if (area.bounding_box) {
        const bbox = area.bounding_box as { x1: number; y1: number; x2: number; y2: number };
        const x1 = bbox.x1 * (map.width || 0);
        const y1 = bbox.y1 * (map.height || 0);
        const x2 = bbox.x2 * (map.width || 0);
        const y2 = bbox.y2 * (map.height || 0);
        
        const color = getAreaColor(area.area_type);
        
        // Draw area rectangle with transparency
        ctx.fillStyle = color + '40'; // 25% transparency
        ctx.fillRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        
        // Draw area border
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / scale;
        ctx.strokeRect(Math.min(x1, x2), Math.min(y1, y2), Math.abs(x2 - x1), Math.abs(y2 - y1));
        
        // Draw area label
        ctx.fillStyle = color;
        ctx.font = `${12 / scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(
          area.area_name,
          (x1 + x2) / 2,
          (y1 + y2) / 2
        );
      }
    });

    // Draw current rectangle being drawn
    if (currentRect) {
      ctx.strokeStyle = '#ff6b35';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([5 / scale, 5 / scale]);
      ctx.strokeRect(
        Math.min(currentRect.x1, currentRect.x2),
        Math.min(currentRect.y1, currentRect.y2),
        Math.abs(currentRect.x2 - currentRect.x1),
        Math.abs(currentRect.y2 - currentRect.y1)
      );
      ctx.setLineDash([]);
    }
    
    // Restore context
    ctx.restore();
  }, [map, mapAreas, scale, offset, currentRect, imageLoaded]);

  // Draw on every render
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    if (activeMode === 'view') {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
    } else if (activeMode === 'area' && userRole === 'dm') {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // Convert to map coordinates
      const mapX = (mouseX - offset.x) / scale;
      const mapY = (mouseY - offset.y) / scale;

      if (mapX >= 0 && mapX <= (map.width || 0) && mapY >= 0 && mapY <= (map.height || 0)) {
        setIsDrawingArea(true);
        setStartPoint({ x: mapX, y: mapY });
        setCurrentRect({ x1: mapX, y1: mapY, x2: mapX, y2: mapY });
      }
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
    } else if (isDrawingArea && startPoint) {
      const mapX = (mouseX - offset.x) / scale;
      const mapY = (mouseY - offset.y) / scale;

      setCurrentRect({
        x1: startPoint.x,
        y1: startPoint.y,
        x2: Math.max(0, Math.min(map.width || 0, mapX)),
        y2: Math.max(0, Math.min(map.height || 0, mapY))
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging) {
      setIsDragging(false);
    } else if (isDrawingArea && currentRect) {
      // Only create area if it has meaningful size
      const width = Math.abs(currentRect.x2 - currentRect.x1);
      const height = Math.abs(currentRect.y2 - currentRect.y1);
      
      if (width > 10 && height > 10) {
        setNewAreaBounds(currentRect);
        setShowAreaDialog(true);
      }
      
      setIsDrawingArea(false);
      setStartPoint(null);
      setCurrentRect(null);
    }
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
    if (newAreaBounds) {
      onAreaAdd(newAreaBounds, areaName, areaType, description);
    }
    setShowAreaDialog(false);
    setNewAreaBounds(null);
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
                <p>📐 Click and drag to define area</p>
                <p>🎯 Release to set boundaries</p>
              </div>
            )}
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
                    setNewAreaBounds(null);
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
