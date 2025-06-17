
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Pin, DistanceMeasurement, Map } from './types';

interface MapCanvasProps {
  map: Map;
  pins: Pin[];
  distances: DistanceMeasurement[];
  activeMode: 'view' | 'pin' | 'distance';
  onPinAdd: (x: number, y: number) => void;
  onDistanceAdd: (points: { x: number; y: number }[], distance: number) => void;
  userRole: string;
}

const MapCanvas: React.FC<MapCanvasProps> = ({
  map,
  pins,
  distances,
  activeMode,
  onPinAdd,
  onDistanceAdd,
  userRole
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
  const [distancePoints, setDistancePoints] = useState<{ x: number; y: number }[]>([]);
  const [hoveredPin, setHoveredPin] = useState<string | null>(null);
  const [imageLoaded, setImageLoaded] = useState(false);

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
    const scaleX = canvas.width / map.width;
    const scaleY = canvas.height / map.height;
    const initialScale = Math.min(scaleX, scaleY, 1);
    
    console.log('Initializing canvas:', {
      containerSize: { width: containerRect.width, height: containerRect.height },
      mapSize: { width: map.width, height: map.height },
      initialScale
    });
    
    setScale(initialScale);
    setOffset({
      x: (canvas.width - map.width * initialScale) / 2,
      y: (canvas.height - map.height * initialScale) / 2
    });
  }, [map, imageLoaded]);

  // Draw everything on canvas
  const draw = useCallback(() => {
    if (!canvasRef.current || !imageRef.current || !imageLoaded) {
      console.log('Cannot draw - missing canvas, image, or image not loaded');
      return;
    }
    
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

    console.log('Drawing with transform:', { offset, scale });

    // Draw map image
    ctx.drawImage(imageRef.current, 0, 0, map.width, map.height);
    
    // Draw distance measurements
    distances.forEach(distance => {
      if (distance.points && distance.points.length > 1) {
        ctx.strokeStyle = '#ff6b35';
        ctx.lineWidth = 3 / scale;
        ctx.setLineDash([5 / scale, 5 / scale]);
        
        ctx.beginPath();
        const startPoint = distance.points[0];
        ctx.moveTo(startPoint.x * map.width, startPoint.y * map.height);
        
        distance.points.slice(1).forEach(point => {
          ctx.lineTo(point.x * map.width, point.y * map.height);
        });
        
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw measurement label
        const midPoint = distance.points[Math.floor(distance.points.length / 2)];
        ctx.fillStyle = '#ff6b35';
        ctx.font = `${12 / scale}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(
          `${distance.name}: ${distance.total_distance?.toFixed(1)} ${distance.unit}`,
          midPoint.x * map.width,
          midPoint.y * map.height - 10 / scale
        );
      }
    });

    // Draw current distance measurement being created
    if (activeMode === 'distance' && distancePoints.length > 0) {
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 2 / scale;
      ctx.setLineDash([3 / scale, 3 / scale]);
      
      ctx.beginPath();
      ctx.moveTo(distancePoints[0].x, distancePoints[0].y);
      
      distancePoints.slice(1).forEach(point => {
        ctx.lineTo(point.x, point.y);
      });
      
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw pins
    pins.filter(pin => pin.is_visible).forEach(pin => {
      const x = pin.x_normalized * map.width;
      const y = pin.y_normalized * map.height;
      const pinSize = 12 / scale;
      
      // Pin shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.beginPath();
      ctx.arc(x + 1 / scale, y + 1 / scale, pinSize * 0.8, 0, 2 * Math.PI);
      ctx.fill();
      
      // Pin body
      ctx.fillStyle = pin.pin_types?.color || '#ff0000';
      ctx.beginPath();
      ctx.arc(x, y, pinSize, 0, 2 * Math.PI);
      ctx.fill();
      
      // Pin border
      ctx.strokeStyle = hoveredPin === pin.id ? '#ffffff' : '#000000';
      ctx.lineWidth = 2 / scale;
      ctx.stroke();
      
      // Pin label
      if (hoveredPin === pin.id) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
        ctx.fillRect(x + 15 / scale, y - 10 / scale, ctx.measureText(pin.name).width + 8 / scale, 16 / scale);
        
        ctx.fillStyle = '#ffffff';
        ctx.font = `${11 / scale}px Arial`;
        ctx.textAlign = 'left';
        ctx.fillText(pin.name, x + 19 / scale, y + 2 / scale);
      }
    });
    
    // Restore context
    ctx.restore();
  }, [map, pins, distances, scale, offset, distancePoints, activeMode, hoveredPin, imageLoaded]);

  // Draw on every render
  useEffect(() => {
    draw();
  }, [draw]);

  // Handle mouse events
  const handleMouseDown = (e: React.MouseEvent) => {
    console.log('Mouse down - activeMode:', activeMode);
    if (activeMode === 'view') {
      setIsDragging(true);
      setLastMousePos({ x: e.clientX, y: e.clientY });
      console.log('Started dragging');
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert mouse position to map coordinates
    const mapX = (mouseX - offset.x) / scale;
    const mapY = (mouseY - offset.y) / scale;

    // Check for pin hover
    const hoveredPinId = pins.find(pin => {
      const pinX = pin.x_normalized * map.width;
      const pinY = pin.y_normalized * map.height;
      const distance = Math.sqrt((mapX - pinX) ** 2 + (mapY - pinY) ** 2);
      return distance < 15 / scale;
    })?.id || null;
    
    setHoveredPin(hoveredPinId);

    if (isDragging && activeMode === 'view') {
      const deltaX = e.clientX - lastMousePos.x;
      const deltaY = e.clientY - lastMousePos.y;
      
      console.log('Dragging - delta:', { deltaX, deltaY });
      
      setOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));
      
      setLastMousePos({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    console.log('Mouse up - stopping drag');
    setIsDragging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!canvasRef.current || isDragging) return;

    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    // Convert to map coordinates
    const mapX = (mouseX - offset.x) / scale;
    const mapY = (mouseY - offset.y) / scale;

    console.log('Click event:', { activeMode, userRole, mapX, mapY });

    if (activeMode === 'pin' && userRole === 'dm') {
      if (mapX >= 0 && mapX <= map.width && mapY >= 0 && mapY <= map.height) {
        onPinAdd(mapX, mapY);
      }
    } else if (activeMode === 'distance' && userRole === 'dm') {
      if (mapX >= 0 && mapX <= map.width && mapY >= 0 && mapY <= map.height) {
        const newPoints = [...distancePoints, { x: mapX, y: mapY }];
        setDistancePoints(newPoints);
        
        // If we have at least 2 points, we can calculate distance
        if (newPoints.length >= 2) {
          let totalDistance = 0;
          for (let i = 1; i < newPoints.length; i++) {
            const dx = newPoints[i].x - newPoints[i - 1].x;
            const dy = newPoints[i].y - newPoints[i - 1].y;
            totalDistance += Math.sqrt(dx * dx + dy * dy);
          }
          
          // Convert pixel distance to real distance if scale is available
          if (map.scale_factor) {
            totalDistance *= map.scale_factor;
          }
          
          // Double-click to finish measurement
          if (e.detail === 2 && newPoints.length >= 2) {
            onDistanceAdd(newPoints, totalDistance);
            setDistancePoints([]);
          }
        }
      }
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
    
    console.log('Zoom event:', { 
      deltaY: e.deltaY, 
      wheel, 
      zoom, 
      currentScale: scale, 
      newScale,
      mouseX,
      mouseY,
      newOffsetX,
      newOffsetY
    });
    
    setScale(newScale);
    setOffset({ x: newOffsetX, y: newOffsetY });
  }, [scale, offset]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && activeMode === 'distance') {
      setDistancePoints([]);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-[600px] border-2 border-gray-300 rounded-lg overflow-hidden bg-gray-100"
      tabIndex={0}
      onKeyDown={handleKeyDown}
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
        onClick={handleClick}
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
              <p>📍 Hover over pins for details</p>
            </div>
          )}
          {activeMode === 'pin' && userRole === 'dm' && (
            <div>
              <p>📍 Click to place a pin</p>
            </div>
          )}
          {activeMode === 'distance' && userRole === 'dm' && (
            <div>
              <p>📏 Click points to measure distance</p>
              <p>⏎ Double-click to finish measurement</p>
              <p>⎋ Press Escape to cancel</p>
            </div>
          )}
        </div>
      )}

      {/* Scale indicator */}
      {imageLoaded && map.scale_factor && (
        <div className="absolute bottom-4 left-4 bg-black bg-opacity-60 text-white p-2 rounded text-sm">
          Scale: 1 pixel = {map.scale_factor} {map.scale_unit}
        </div>
      )}

      {/* Zoom level indicator */}
      {imageLoaded && (
        <div className="absolute bottom-4 right-4 bg-black bg-opacity-60 text-white p-2 rounded text-sm">
          Zoom: {Math.round(scale * 100)}%
        </div>
      )}
    </div>
  );
};

export default MapCanvas;
