import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Ruler, MapPin, Eye, Plus, ArrowLeft, Upload, Map } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Map as MapType } from './map/types';

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

interface MapOption {
  id: string;
  name: string;
  url: string;
  width?: number;
  height?: number;
}

interface InteractiveMapProps {
  onBack?: () => void;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  const { toast } = useToast();

  // State management
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [pins, setPins] = useState<Pin[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'view' | 'add-pin' | 'measure'>('view');
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  
  // Map selection state
  const [availableMaps, setAvailableMaps] = useState<MapOption[]>([]);
  const [selectedMap, setSelectedMap] = useState<MapOption | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showMapSelector, setShowMapSelector] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapImageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize with default maps and load from Supabase
  useEffect(() => {
    const defaultMaps: MapOption[] = [
      {
        id: 'default-1',
        name: 'The Slumbering Ancients',
        url: '/lovable-uploads/70382beb-0456-4b0e-b550-a587cc615789.png',
        width: 2000,
        height: 1500
      }
    ];
    
    setAvailableMaps(defaultMaps);
    loadMapsFromSupabase();
  }, []);

  // Load maps from Supabase
  const loadMapsFromSupabase = async () => {
    try {
      setIsLoading(true);
      
      // Get maps from the database
      const { data: mapsData, error: mapsError } = await supabase
        .from('maps')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (mapsError) {
        console.error('Error loading maps:', mapsError);
        toast({
          title: "Error",
          description: "Failed to load maps from database",
          variant: "destructive",
        });
        return;
      }

      // Convert database maps to MapOption format
      const supabaseMaps: MapOption[] = mapsData.map((map: MapType) => ({
        id: map.id,
        name: map.name,
        url: map.image_url,
        width: map.width,
        height: map.height
      }));
      
      setAvailableMaps(prev => {
        // Remove default maps if we have real maps, otherwise keep them
        const defaultMaps = prev.filter(map => map.id.startsWith('default-'));
        return supabaseMaps.length > 0 ? supabaseMaps : [...defaultMaps, ...supabaseMaps];
      });

    } catch (error) {
      console.error('Error loading maps from Supabase:', error);
      toast({
        title: "Error",
        description: "Failed to load maps",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file upload to Supabase
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 50MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    try {
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `maps/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('maps')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('maps')
        .getPublicUrl(filePath);

      // Get image dimensions
      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

      // Create map record in database
      const mapData = {
        name: file.name.replace(/\.[^/.]+$/, ""),
        description: null,
        image_url: urlData.publicUrl,
        image_path: filePath,
        width: img.width,
        height: img.height,
        scale_factor: 1,
        scale_unit: 'meters',
        is_active: true
      };

      const { data: mapRecord, error: dbError } = await supabase
        .from('maps')
        .insert(mapData)
        .select()
        .single();

      if (dbError) {
        console.error('Database error:', dbError);
        // Clean up uploaded file if database insert fails
        await supabase.storage.from('maps').remove([filePath]);
        throw new Error(dbError.message);
      }

      // Create MapOption from the new record
      const newMap: MapOption = {
        id: mapRecord.id,
        name: mapRecord.name,
        url: mapRecord.image_url,
        width: mapRecord.width,
        height: mapRecord.height
      };

      setAvailableMaps(prev => [newMap, ...prev]);
      setSelectedMap(newMap);
      setShowMapSelector(false);

      toast({
        title: "Success",
        description: "Map uploaded successfully!",
      });

      // Clean up object URL
      URL.revokeObjectURL(img.src);

    } catch (error) {
      console.error('Error uploading map:', error);
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload map",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Select a map
  const selectMap = (map: MapOption) => {
    setSelectedMap(map);
    setShowMapSelector(false);
    // Reset map state when switching maps
    setPins([]);
    setMeasurements([]);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  };

  // Pixel to meter conversion
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

  // Show map selector if no map selected
  if (showMapSelector || !selectedMap) {
    return (
      <div className="flex h-screen bg-gray-100">
        <div className="w-full max-w-4xl mx-auto p-8">
          <div className="bg-white rounded-lg shadow-lg p-6">
            <div className="flex items-center gap-3 mb-6">
              {onBack && (
                <button
                  onClick={onBack}
                  className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
                >
                  <ArrowLeft size={20} />
                  Back
                </button>
              )}
              <h1 className="text-2xl font-bold text-gray-800">Select a Map</h1>
            </div>

            {/* Upload Section */}
            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-4">Upload New Map</h2>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <Upload size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-4">Upload a map image to get started</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Choose File'}
                </button>
              </div>
            </div>

            {/* Available Maps */}
            <div>
              <h2 className="text-lg font-semibold mb-4">
                Available Maps 
                {isLoading && <span className="text-sm text-gray-500 ml-2">(Loading...)</span>}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableMaps.map((map) => (
                  <div
                    key={map.id}
                    onClick={() => selectMap(map)}
                    className="border rounded-lg p-4 cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
                  >
                    <div className="aspect-video bg-gray-200 rounded mb-3 flex items-center justify-center overflow-hidden">
                      <img
                        src={map.url}
                        alt={map.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                      <Map size={48} className="text-gray-400" />
                    </div>
                    <h3 className="font-medium text-gray-800">{map.name}</h3>
                    <p className="text-sm text-gray-500">
                      {map.width} x {map.height}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      <div className="w-80 bg-white shadow-lg flex flex-col">
        <div className="p-4 border-b">
          <div className="flex items-center gap-3 mb-2">
            {onBack && (
              <button
                onClick={onBack}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 transition-colors"
              >
                <ArrowLeft size={20} />
                Back
              </button>
            )}
          </div>
          <h2 className="text-xl font-bold text-blue-600">Interactive World Map</h2>
          <p className="text-sm text-gray-600">{selectedMap.name}</p>
          <button
            onClick={() => setShowMapSelector(true)}
            className="text-xs text-blue-600 hover:text-blue-800 mt-1"
          >
            Change Map
          </button>
        </div>

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

        <div className="p-4 text-xs text-gray-600 space-y-1">
          <p>🖱️ Click and drag to pan</p>
          <p>🔍 Scroll to zoom</p>
          <p>📍 Hover over pins for details</p>
          <p className="mt-2 font-medium">Scale: 1 pixel = 1 meter</p>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={mapContainerRef}
          style={containerStyle}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
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

          <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 px-2 py-1 rounded text-sm font-mono z-10">
            Scale: 1 pixel = 1 meter | Zoom: {(zoom * 100).toFixed(0)}%
          </div>

          <img
            ref={mapImageRef}
            src={selectedMap.url}
            alt="Interactive Map"
            className="absolute select-none"
            style={imageStyle}
            draggable={false}
            onLoad={handleImageLoad}
          />

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

export default InteractiveMap;
