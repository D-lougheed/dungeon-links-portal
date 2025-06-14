import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Ruler, MapPin, Eye, Plus } from 'lucide-react';

interface Pin {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
}

interface Measurement {
  id: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  distance: number;
}

interface InteractiveMapProps {
  imageUrl: string;
  imageWidth?: number;
  imageHeight?: number;
}

export const InteractiveMap: React.FC<InteractiveMapProps> = ({
  imageUrl,
  imageWidth = 2000,
  imageHeight = 1500
}) => {
  // State management
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [pins, setPins] = useState<Pin[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'view' | 'add-pin' | 'measure'>('view');
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapImageRef = useRef<HTMLImageElement>(null);

  // Pixel to meter conversion (1 pixel = 1 meter as per your scale)
  const pixelToMeter = 1;

  // Helper function to get mouse position relative to the image
  const getImageCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!mapContainerRef.current) return { x: 0, y: 0 };
    
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - panOffset.x) / zoom;
    const y = (clientY - rect.top - panOffset.y) / zoom;
    
    return { x, y };
  }, [panOffset, zoom]);

  // Calculate distance between two points
  const calculateDistance = (x1: number, y1: number, x2: number, y2: number) => {
    return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2)) * pixelToMeter;
  };

  // Memoized image style for performance
  const imageStyle = useMemo(() => ({
    transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
    transformOrigin: '0 0',
    width: 'auto',
    height: 'auto',
    maxWidth: 'none',
    maxHeight: 'none',
    imageRendering: 'pixelated' as const,
    userSelect: 'none' as const,
    pointerEvents: 'none' as const
  }), [panOffset.x, panOffset.y, zoom]);

  // Container style
  const containerStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative' as const,
    cursor: mode === 'add-pin' ? 'crosshair' : 
            mode === 'measure' ? 'crosshair' :
            isDragging ? 'grabbing' : 'grab'
  }), [mode, isDragging]);

  // Pin style helper
  const getPinStyle = useCallback((pin: Pin) => ({
    position: 'absolute' as const,
    left: `${panOffset.x + pin.x * zoom - 12}px`,
    top: `${panOffset.y + pin.y * zoom - 24}px`,
    transform: `scale(${Math.max(0.5, Math.min(1.5, zoom))})`,
    transformOrigin: 'center bottom',
    pointerEvents: 'auto' as const,
    zIndex: 1000
  }), [panOffset, zoom]);

  // Mouse wheel zoom handler - CRITICAL FIX
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!mapContainerRef.current) return;
    
    const rect = mapContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
    
    // Zoom towards mouse position
    const zoomRatio = newZoom / zoom;
    const newPanX = mouseX - (mouseX - panOffset.x) * zoomRatio;
    const newPanY = mouseY - (mouseY - panOffset.y) * zoomRatio;
    
    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  }, [zoom, panOffset]);

  // Mouse down handler - CRITICAL FIX
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    if (mode === 'add-pin') {
      const coords = getImageCoordinates(e.clientX, e.clientY);
      const newPin: Pin = {
        id: Date.now().toString(),
        x: coords.x,
        y: coords.y,
        label: `Pin ${pins.length + 1}`,
        color: '#ff0000'
      };
      setPins(prev => [...prev, newPin]);
      setMode('view');
      return;
    }

    if (mode === 'measure') {
      const coords = getImageCoordinates(e.clientX, e.clientY);
      if (!measureStart) {
        setMeasureStart(coords);
      } else {
        const distance = calculateDistance(measureStart.x, measureStart.y, coords.x, coords.y);
        const newMeasurement: Measurement = {
          id: Date.now().toString(),
          startX: measureStart.x,
          startY: measureStart.y,
          endX: coords.x,
          endY: coords.y,
          distance
        };
        setMeasurements(prev => [...prev, newMeasurement]);
        setMeasureStart(null);
        setMode('view');
      }
      return;
    }

    // Start dragging for pan mode
    if (mode === 'view') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [mode, getImageCoordinates, pins.length, measureStart, panOffset]);

  // Mouse move handler - CRITICAL FIX
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && mode === 'view') {
      e.preventDefault();
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, mode, dragStart]);

  // Mouse up handler
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle image load - CENTER MAP INITIALLY
  const handleImageLoad = useCallback(() => {
    if (mapContainerRef.current && mapImageRef.current) {
      const container = mapContainerRef.current;
      const image = mapImageRef.current;
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imageWidth = image.naturalWidth;
      const imageHeight = image.naturalHeight;
      
      // Center the image
      const centerX = (containerWidth - imageWidth) / 2;
      const centerY = (containerHeight - imageHeight) / 2;
      
      setPanOffset({ 
        x: Math.max(0, centerX), 
        y: Math.max(0, centerY) 
      });
    }
  }, []);

  // Set up wheel event listener - CRITICAL FIX
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // IMPORTANT: passive: false allows preventDefault()
    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Global mouse events for dragging - CRITICAL FIX
  useEffect(() => {
    const handleGlobalMouseUp = () => setIsDragging(false);
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging || mode !== 'view') return;
      
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, mode, dragStart]);

  // Handle mode changes
  const handleModeChange = (newMode: 'view' | 'add-pin' | 'measure') => {
    setMode(newMode);
    setMeasureStart(null);
  };

  // Remove pin
  const removePin = (pinId: string) => {
    setPins(prev => prev.filter(p => p.id !== pinId));
  };

  // Remove measurement
  const removeMeasurement = (measurementId: string) => {
    setMeasurements(prev => prev.filter(m => m.id !== measurementId));
  };

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg flex flex-col">
        <div className="p-4 border-b">
          <h2 className="text-xl font-bold text-blue-600">Interactive World Map</h2>
          <p className="text-sm text-gray-600">The Slumbering Ancients 100+ 6k</p>
        </div>

        {/* Map Tools */}
        <div className="p-4 border-b">
          <h3 className="font-semibold mb-3">Map Tools</h3>
          <div className="space-y-2">
            <button
              onClick={() => handleModeChange('view')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
                mode === 'view' 
                  ? 'bg-gray-900 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye size={16} />
              View Mode
            </button>
            <button
              onClick={() => handleModeChange('add-pin')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
                mode === 'add-pin' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Plus size={16} />
              Add Pins
            </button>
            <button
              onClick={() => handleModeChange('measure')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
                mode === 'measure' 
                  ? 'bg-green-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Ruler size={16} />
              Measure Distance
            </button>
          </div>
        </div>

        {/* Pins */}
        <div className="p-4 border-b flex-1">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Pins ({pins.length})</h3>
            {pins.length > 0 && (
              <button 
                onClick={() => setPins([])}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Clear all
              </button>
            )}
          </div>
          {pins.length === 0 ? (
            <p className="text-sm text-gray-500">No pins on this map yet</p>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {pins.map((pin) => (
                <div key={pin.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: pin.color }}
                    />
                    <span className="text-sm">{pin.label}</span>
                  </div>
                  <button
                    onClick={() => removePin(pin.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Distance Measurements */}
        <div className="p-4 border-b">
          <div className="flex justify-between items-center mb-2">
            <h3 className="font-semibold">Distance Measurements ({measurements.length})</h3>
            {measurements.length > 0 && (
              <button 
                onClick={() => setMeasurements([])}
                className="text-xs text-red-600 hover:text-red-800"
              >
                Clear all
              </button>
            )}
          </div>
          {measurements.length === 0 ? (
            <p className="text-sm text-gray-500">No distance measurements yet</p>
          ) : (
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {measurements.map((measurement) => (
                <div key={measurement.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <span className="text-sm">{measurement.distance.toFixed(1)}m</span>
                  <button
                    onClick={() => removeMeasurement(measurement.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions */}
        <div className="p-4 text-xs text-gray-600 space-y-1">
          <p>🖱️ Click and drag to pan</p>
          <p>🔍 Scroll to zoom</p>
          <p>📍 Hover over pins for details</p>
          <p className="mt-2 font-medium">Scale: 1 pixel = 1 meter</p>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        <div
          ref={mapContainerRef}
          style={containerStyle}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Instructions overlay */}
          <div className="absolute top-4 left-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded text-sm z-10">
            {mode === 'view' && (
              <div className="flex items-center gap-2">
                <span>🖱️ Click and drag to pan</span>
                <span>🔍 Scroll to zoom</span>
              </div>
            )}
            {mode === 'add-pin' && <span>📍 Click anywhere to add a pin</span>}
            {mode === 'measure' && (
              <span>📏 Click two points to measure distance</span>
            )}
          </div>

          {/* Zoom level indicator */}
          <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 px-2 py-1 rounded text-sm font-mono z-10">
            Scale: 1 pixel = 1 meter | Zoom: {(zoom * 100).toFixed(0)}%
          </div>

          {/* Map Image */}
          <img
            ref={mapImageRef}
            src={imageUrl}
            alt="Interactive Map"
            className="absolute select-none"
            style={imageStyle}
            draggable={false}
            onLoad={handleImageLoad}
          />

          {/* Pins */}
          {pins.map((pin) => (
            <div
              key={pin.id}
              style={getPinStyle(pin)}
              title={pin.label}
            >
              <div className="relative">
                <MapPin 
                  size={24} 
                  fill={pin.color} 
                  color={pin.color}
                  className="drop-shadow-lg"
                />
                <div className="absolute -top-8 left-1/2 transform -translate-x-1/2 bg-black text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none">
                  {pin.label}
                </div>
              </div>
            </div>
          ))}

          {/* Measurements */}
          {measurements.map((measurement) => (
            <svg
              key={measurement.id}
              className="absolute inset-0 pointer-events-none z-10"
              style={{ width: '100%', height: '100%' }}
            >
              <line
                x1={panOffset.x + measurement.startX * zoom}
                y1={panOffset.y + measurement.startY * zoom}
                x2={panOffset.x + measurement.endX * zoom}
                y2={panOffset.y + measurement.endY * zoom}
                stroke="#00ff00"
                strokeWidth="2"
                strokeDasharray="5,5"
              />
              <text
                x={panOffset.x + (measurement.startX + measurement.endX) * zoom / 2}
                y={panOffset.y + (measurement.startY + measurement.endY) * zoom / 2 - 10}
                fill="#00ff00"
                fontSize="12"
                fontWeight="bold"
                textAnchor="middle"
                className="drop-shadow-lg"
              >
                {measurement.distance.toFixed(1)}m
              </text>
            </svg>
          ))}

          {/* Measurement preview */}
          {measureStart && mode === 'measure' && (
            <div
              className="absolute w-2 h-2 bg-green-500 rounded-full pointer-events-none z-20"
              style={{
                left: `${panOffset.x + measureStart.x * zoom - 4}px`,
                top: `${panOffset.y + measureStart.y * zoom - 4}px`
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
};
