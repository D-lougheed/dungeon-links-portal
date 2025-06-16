import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Ruler, MapPin, Eye, Plus, ArrowLeft, Upload, Map, Settings, Edit3, Palette, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Map as MapType, Pin as DatabasePin, PinType, DistanceMeasurement } from './map/types';

// Internal UI representation of a pin
interface UIPin {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
  pin_type_id?: string;
  pin_type?: PinType;
  description?: string;
  x_normalized?: number;
  y_normalized?: number;
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
  scale_factor?: number;
  scale_unit?: string;
}

interface InteractiveMapProps {
  onBack?: () => void;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  const { toast } = useToast();

  // State management
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [pins, setPins] = useState<UIPin[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [mode, setMode] = useState<'view' | 'add-pin' | 'measure' | 'manage-pins'>('view');
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null);
  
  // Map selection state
  const [availableMaps, setAvailableMaps] = useState<MapOption[]>([]);
  const [selectedMap, setSelectedMap] = useState<MapOption | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showMapSelector, setShowMapSelector] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // Pin types and management
  const [pinTypes, setPinTypes] = useState<PinType[]>([]);
  const [selectedPinType, setSelectedPinType] = useState<string | null>(null);
  const [showPinEditor, setShowPinEditor] = useState(false);
  const [editingPin, setEditingPin] = useState<UIPin | null>(null);
  const [showScaleSettings, setShowScaleSettings] = useState(false);
  const [showPinTypeManager, setShowPinTypeManager] = useState(false);

  // Pin editor state - separate from editingPin to prevent re-renders
  const [pinEditorData, setPinEditorData] = useState({
    label: '',
    description: '',
    pin_type_id: ''
  });

  // Scale settings with expanded unit options
  const [scaleSettings, setScaleSettings] = useState({
    factor: 1,
    unit: 'meters'
  });

  // Available scale units
  const scaleUnits = [
    { value: 'meters', label: 'Meters', abbreviation: 'm' },
    { value: 'feet', label: 'Feet', abbreviation: 'ft' },
    { value: 'kilometers', label: 'Kilometers', abbreviation: 'km' },
    { value: 'miles', label: 'Miles', abbreviation: 'mi' },
    { value: 'squares', label: 'Grid Squares', abbreviation: 'sq' },
    { value: 'hexes', label: 'Hexes', abbreviation: 'hex' }
  ];

  // Refs
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapImageRef = useRef<HTMLImageElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pinIconInputRef = useRef<HTMLInputElement>(null);

  // Initialize with default maps and load from Supabase
  useEffect(() => {
    const defaultMaps: MapOption[] = [
      {
        id: 'default-1',
        name: 'The Slumbering Ancients',
        url: '/lovable-uploads/70382beb-0456-4b0e-b550-a587cc615789.png',
        width: 2000,
        height: 1500,
        scale_factor: 1,
        scale_unit: 'meters'
      }
    ];
    
    setAvailableMaps(defaultMaps);
    loadMapsFromSupabase();
    loadPinTypes();
  }, []);

  // Update scale settings when map changes
  useEffect(() => {
    if (selectedMap) {
      setScaleSettings({
        factor: selectedMap.scale_factor || 1,
        unit: selectedMap.scale_unit || 'meters'
      });
    }
  }, [selectedMap]);

  // Load pin types from database
  const loadPinTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('pin_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error loading pin types:', error);
        return;
      }

      setPinTypes(data);
      if (data.length > 0) {
        setSelectedPinType(data[0].id);
      }
    } catch (error) {
      console.error('Error loading pin types:', error);
    }
  };

  // Load pins for the current map with proper coordinate conversion
  const loadPinsForMap = async (mapId: string) => {
    if (!selectedMap) {
      console.log('No selected map, skipping pin loading');
      return;
    }

    try {
      console.log('Loading pins for map:', mapId);
      
      const { data, error } = await supabase
        .from('pins')
        .select(`
          *,
          pin_types (
            id,
            name,
            description,
            color,
            category,
            size_modifier,
            icon_url,
            is_active,
            created_at
          )
        `)
        .eq('map_id', mapId)
        .eq('is_visible', true);

      if (error) {
        console.error('Error loading pins:', error);
        return;
      }

      console.log('Loaded pins from database:', data);
      console.log('Selected map dimensions:', selectedMap.width, 'x', selectedMap.height);

      const mapWidth = selectedMap.width || 1;
      const mapHeight = selectedMap.height || 1;

      const convertedPins: UIPin[] = data.map((dbPin: any) => {
        const pin = {
          id: dbPin.id,
          x: Number(dbPin.x_normalized) * mapWidth,
          y: Number(dbPin.y_normalized) * mapHeight,
          label: dbPin.name,
          color: dbPin.pin_types?.color || '#FF0000',
          pin_type_id: dbPin.pin_type_id || undefined,
          pin_type: dbPin.pin_types,
          description: dbPin.description,
          x_normalized: Number(dbPin.x_normalized),
          y_normalized: Number(dbPin.y_normalized)
        };
        
        console.log(`Pin ${dbPin.name}: normalized(${dbPin.x_normalized}, ${dbPin.y_normalized}) -> pixel(${pin.x}, ${pin.y})`);
        return pin;
      });

      console.log('Converted pins:', convertedPins);
      setPins(convertedPins);
    } catch (error) {
      console.error('Error loading pins:', error);
    }
  };

  // Load distance measurements for the current map
  const loadMeasurementsForMap = async (mapId: string) => {
    try {
      const { data, error } = await supabase
        .from('distance_measurements')
        .select('*')
        .eq('map_id', mapId);

      if (error) {
        console.error('Error loading measurements:', error);
        return;
      }

      const mapWidth = selectedMap?.width || 1;
      const mapHeight = selectedMap?.height || 1;

      const convertedMeasurements: Measurement[] = data.map((measurement: any) => {
        const points = measurement.points as any[];
        if (points && points.length >= 2) {
          return {
            id: measurement.id,
            startX: points[0].x * mapWidth,
            startY: points[0].y * mapHeight,
            endX: points[1].x * mapWidth,
            endY: points[1].y * mapHeight,
            distance: measurement.total_distance || 0
          };
        }
        return null;
      }).filter(Boolean) as Measurement[];

      setMeasurements(convertedMeasurements);
    } catch (error) {
      console.error('Error loading measurements:', error);
    }
  };

  // Load maps from Supabase
  const loadMapsFromSupabase = async () => {
    try {
      setIsLoading(true);
      
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

      const supabaseMaps: MapOption[] = mapsData.map((map: MapType) => ({
        id: map.id,
        name: map.name,
        url: map.image_url,
        width: map.width,
        height: map.height,
        scale_factor: map.scale_factor,
        scale_unit: map.scale_unit
      }));
      
      setAvailableMaps(prev => {
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

  // Save pin to database with proper coordinate normalization
  const savePinToDatabase = async (pin: UIPin) => {
    if (!selectedMap || selectedMap.id.startsWith('default-')) return;

    try {
      const mapWidth = selectedMap.width || 1;
      const mapHeight = selectedMap.height || 1;

      // Ensure coordinates are normalized properly
      const x_normalized = pin.x_normalized || (pin.x / mapWidth);
      const y_normalized = pin.y_normalized || (pin.y / mapHeight);

      console.log(`Saving pin: pixel(${pin.x}, ${pin.y}) -> normalized(${x_normalized}, ${y_normalized})`);
      console.log(`Map dimensions: ${mapWidth} x ${mapHeight}`);

      const pinData = {
        map_id: selectedMap.id,
        pin_type_id: pin.pin_type_id || selectedPinType,
        name: pin.label,
        description: pin.description || null,
        x_normalized: x_normalized,
        y_normalized: y_normalized,
        is_visible: true
      };

      const { data, error } = await supabase
        .from('pins')
        .insert(pinData)
        .select(`
          *,
          pin_types (
            id,
            name,
            description,
            color,
            category,
            size_modifier,
            icon_url,
            is_active,
            created_at
          )
        `)
        .single();

      if (error) {
        console.error('Error saving pin:', error);
        toast({
          title: "Error",
          description: "Failed to save pin to database",
          variant: "destructive",
        });
        return null;
      }

      return {
        id: data.id,
        x: pin.x,
        y: pin.y,
        label: data.name,
        color: data.pin_types?.color || pin.color,
        pin_type_id: data.pin_type_id,
        pin_type: data.pin_types,
        description: data.description,
        x_normalized: data.x_normalized,
        y_normalized: data.y_normalized
      } as UIPin;
    } catch (error) {
      console.error('Error saving pin:', error);
      return null;
    }
  };

  // Update pin in database
  const updatePinInDatabase = async (pin: UIPin) => {
    if (!selectedMap || selectedMap.id.startsWith('default-')) return;

    try {
      const { error } = await supabase
        .from('pins')
        .update({
          name: pin.label,
          description: pin.description,
          pin_type_id: pin.pin_type_id
        })
        .eq('id', pin.id);

      if (error) {
        console.error('Error updating pin:', error);
        toast({
          title: "Error",
          description: "Failed to update pin",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating pin:', error);
      return false;
    }
  };

  // Create new pin type with optional icon upload
  const createPinType = async (name: string, color: string, category: string, iconFile?: File) => {
    try {
      let iconUrl = null;

      if (iconFile) {
        const fileExt = iconFile.name.split('.').pop();
        const fileName = `${crypto.randomUUID()}.${fileExt}`;
        const filePath = `pin-icons/${fileName}`;

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('maps')
          .upload(filePath, iconFile);

        if (uploadError) {
          console.error('Icon upload error:', uploadError);
        } else {
          const { data: urlData } = supabase.storage
            .from('maps')
            .getPublicUrl(filePath);
          iconUrl = urlData.publicUrl;
        }
      }

      const pinTypeData = {
        name,
        color,
        category,
        description: null,
        size_modifier: 1.0,
        icon_url: iconUrl,
        is_active: true
      };

      const { data, error } = await supabase
        .from('pin_types')
        .insert(pinTypeData)
        .select()
        .single();

      if (error) {
        console.error('Error creating pin type:', error);
        toast({
          title: "Error",
          description: "Failed to create pin type",
          variant: "destructive",
        });
        return;
      }

      setPinTypes(prev => [...prev, data]);
      setSelectedPinType(data.id);
      toast({
        title: "Success",
        description: "Pin type created successfully!",
      });
    } catch (error) {
      console.error('Error creating pin type:', error);
    }
  };

  // Update map scale with improved unit validation
  const updateMapScale = async (scaleFactor: number, scaleUnit: string) => {
    if (!selectedMap || selectedMap.id.startsWith('default-')) return;

    // Validate scale unit
    const validUnit = scaleUnits.find(unit => unit.value === scaleUnit);
    if (!validUnit) {
      toast({
        title: "Error",
        description: "Invalid scale unit selected",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('maps')
        .update({ 
          scale_factor: scaleFactor,
          scale_unit: scaleUnit 
        })
        .eq('id', selectedMap.id);

      if (error) {
        console.error('Error updating map scale:', error);
        toast({
          title: "Error",
          description: "Failed to update map scale",
          variant: "destructive",
        });
        return;
      }

      setScaleSettings({ factor: scaleFactor, unit: scaleUnit });
      setSelectedMap(prev => prev ? { 
        ...prev, 
        scale_factor: scaleFactor, 
        scale_unit: scaleUnit 
      } : null);
      
      toast({
        title: "Success",
        description: `Map scale updated to 1 pixel = ${scaleFactor} ${validUnit.label.toLowerCase()}!`,
      });
    } catch (error) {
      console.error('Error updating map scale:', error);
    }
  };

  // Handle file upload to Supabase
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file",
        variant: "destructive",
      });
      return;
    }

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
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `maps/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('maps')
        .upload(filePath, file);

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw new Error(uploadError.message);
      }

      const { data: urlData } = supabase.storage
        .from('maps')
        .getPublicUrl(filePath);

      const img = new Image();
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = URL.createObjectURL(file);
      });

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
        await supabase.storage.from('maps').remove([filePath]);
        throw new Error(dbError.message);
      }

      const newMap: MapOption = {
        id: mapRecord.id,
        name: mapRecord.name,
        url: mapRecord.image_url,
        width: mapRecord.width,
        height: mapRecord.height,
        scale_factor: mapRecord.scale_factor,
        scale_unit: mapRecord.scale_unit
      };

      setAvailableMaps(prev => [newMap, ...prev]);
      setSelectedMap(newMap);
      setShowMapSelector(false);

      toast({
        title: "Success",
        description: "Map uploaded successfully!",
      });

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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Select a map and load its data
  const selectMap = (map: MapOption) => {
    console.log('Selecting map:', map);
    setSelectedMap(map);
    setShowMapSelector(false);
    setPins([]);
    setMeasurements([]);
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });

    // Load pins after the map is selected
    if (!map.id.startsWith('default-')) {
      // Use a timeout to ensure the selectedMap state is updated
      setTimeout(() => {
        loadPinsForMap(map.id);
        loadMeasurementsForMap(map.id);
      }, 100);
    }
  };

  // Calculate distance with proper scale and unit formatting
  const calculateDistance = (x1: number, y1: number, x2: number, y2: number) => {
    const pixelDistance = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    return pixelDistance * scaleSettings.factor;
  };

  // Get scale unit display information
  const getScaleUnitInfo = () => {
    const unitInfo = scaleUnits.find(unit => unit.value === scaleSettings.unit);
    return unitInfo || { value: scaleSettings.unit, label: scaleSettings.unit, abbreviation: scaleSettings.unit };
  };

  // Helper function to get mouse position relative to the image
  const getImageCoordinates = useCallback((clientX: number, clientY: number) => {
    if (!mapContainerRef.current) return { x: 0, y: 0 };
    
    const rect = mapContainerRef.current.getBoundingClientRect();
    const x = (clientX - rect.left - panOffset.x) / zoom;
    const y = (clientY - rect.top - panOffset.y) / zoom;
    
    return { x, y };
  }, [panOffset, zoom]);

  // Show pin editor for new pin
  const showPinEditorForNewPin = (x: number, y: number) => {
    const selectedType = pinTypes.find(type => type.id === selectedPinType);
    const newPin: UIPin = {
      id: 'new',
      x,
      y,
      label: `${selectedType?.name || 'Pin'} ${pins.length + 1}`,
      color: selectedType?.color || '#ff0000',
      pin_type_id: selectedPinType || undefined
    };
    
    setEditingPin(newPin);
    setPinEditorData({
      label: newPin.label,
      description: '',
      pin_type_id: selectedPinType || ''
    });
    setShowPinEditor(true);
  };

  // Show pin editor for existing pin
  const showPinEditorForExistingPin = (pin: UIPin) => {
    setEditingPin(pin);
    setPinEditorData({
      label: pin.label,
      description: pin.description || '',
      pin_type_id: pin.pin_type_id || ''
    });
    setShowPinEditor(true);
  };

  // Save pin from editor
  const savePinFromEditor = async () => {
    if (!editingPin) return;

    const updatedPin: UIPin = {
      ...editingPin,
      label: pinEditorData.label,
      description: pinEditorData.description,
      pin_type_id: pinEditorData.pin_type_id,
      pin_type: pinTypes.find(pt => pt.id === pinEditorData.pin_type_id),
      color: pinTypes.find(pt => pt.id === pinEditorData.pin_type_id)?.color || editingPin.color
    };

    if (editingPin.id === 'new') {
      const savedPin = await savePinToDatabase(updatedPin);
      if (savedPin) {
        setPins(prev => [...prev, savedPin]);
      }
    } else {
      const success = await updatePinInDatabase(updatedPin);
      if (success) {
        setPins(prev => prev.map(p => p.id === updatedPin.id ? updatedPin : p));
      }
    }

    setShowPinEditor(false);
    setEditingPin(null);
    setMode('view');
  };

  // Memoized styles
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

  const containerStyle = useMemo(() => ({
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    position: 'relative' as const,
    cursor: mode === 'add-pin' ? 'crosshair' : 
            mode === 'measure' ? 'crosshair' :
            isDragging ? 'grabbing' : 'grab'
  }), [mode, isDragging]);

  const getPinStyle = useCallback((pin: UIPin) => {
    const pinType = pin.pin_type || pinTypes.find(pt => pt.id === pin.pin_type_id);
    const baseSize = 24;
    const size = baseSize * (pinType?.size_modifier || 1);
    
    // Use the stored normalized coordinates if available, otherwise calculate from pixel coordinates
    let displayX, displayY;
    
    if (pin.x_normalized !== undefined && pin.y_normalized !== undefined && selectedMap) {
      // Use normalized coordinates for consistent positioning
      displayX = pin.x_normalized * (selectedMap.width || 1);
      displayY = pin.y_normalized * (selectedMap.height || 1);
    } else {
      // Fallback to pixel coordinates
      displayX = pin.x;
      displayY = pin.y;
    }
    
    return {
      position: 'absolute' as const,
      left: `${panOffset.x + displayX * zoom - size/2}px`,
      top: `${panOffset.y + displayY * zoom - size}px`,
      transform: `scale(${Math.max(0.5, Math.min(1.5, zoom))})`,
      transformOrigin: 'center bottom',
      pointerEvents: 'auto' as const,
      zIndex: 1000
    };
  }, [panOffset, zoom, pinTypes, selectedMap]);

  // Event handlers
  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!mapContainerRef.current) return;
    
    const rect = mapContainerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.max(0.1, Math.min(5, zoom + delta));
    
    const zoomRatio = newZoom / zoom;
    const newPanX = mouseX - (mouseX - panOffset.x) * zoomRatio;
    const newPanY = mouseY - (mouseY - panOffset.y) * zoomRatio;
    
    setZoom(newZoom);
    setPanOffset({ x: newPanX, y: newPanY });
  }, [zoom, panOffset]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    
    if (mode === 'add-pin') {
      const coords = getImageCoordinates(e.clientX, e.clientY);
      showPinEditorForNewPin(coords.x, coords.y);
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

    if (mode === 'view') {
      setIsDragging(true);
      setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
    }
  }, [mode, getImageCoordinates, measureStart, panOffset, calculateDistance]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging && mode === 'view') {
      e.preventDefault();
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  }, [isDragging, mode, dragStart]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleImageLoad = useCallback(() => {
    if (mapContainerRef.current && mapImageRef.current) {
      const container = mapContainerRef.current;
      const image = mapImageRef.current;
      
      const containerWidth = container.clientWidth;
      const containerHeight = container.clientHeight;
      const imageWidth = image.naturalWidth;
      const imageHeight = image.naturalHeight;
      
      const scaleX = (containerWidth * 0.8) / imageWidth;
      const scaleY = (containerHeight * 0.8) / imageHeight;
      const initialZoom = Math.min(scaleX, scaleY, 1);
      
      const scaledWidth = imageWidth * initialZoom;
      const scaledHeight = imageHeight * initialZoom;
      const centerX = (containerWidth - scaledWidth) / 2;
      const centerY = (containerHeight - scaledHeight) / 2;
      
      setZoom(initialZoom);
      setPanOffset({ 
        x: centerX,
        y: Math.max(20, centerY)
      });

      // If we have a selected map and it's not a default map, load pins after image loads
      if (selectedMap && !selectedMap.id.startsWith('default-')) {
        console.log('Image loaded, reloading pins for map:', selectedMap.id);
        loadPinsForMap(selectedMap.id);
      }
    }
  }, [selectedMap]);

  // Effects
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

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

  const handleModeChange = (newMode: 'view' | 'add-pin' | 'measure' | 'manage-pins') => {
    setMode(newMode);
    setMeasureStart(null);
  };

  const removePin = async (pinId: string) => {
    setPins(prev => prev.filter(p => p.id !== pinId));
    
    if (selectedMap && !selectedMap.id.startsWith('default-')) {
      try {
        const { error } = await supabase
          .from('pins')
          .delete()
          .eq('id', pinId);

        if (error) {
          console.error('Error removing pin:', error);
        }
      } catch (error) {
        console.error('Error removing pin:', error);
      }
    }
  };

  // Pin Type Manager Component
  const PinTypeManager = () => {
    const [newPinType, setNewPinType] = useState({
      name: '',
      color: '#FF6B6B',
      category: 'custom'
    });
    const [selectedIcon, setSelectedIcon] = useState<File | null>(null);

    const handleCreatePinType = async () => {
      if (newPinType.name.trim()) {
        await createPinType(newPinType.name, newPinType.color, newPinType.category, selectedIcon || undefined);
        setNewPinType({
          name: '',
          color: '#FF6B6B',
          category: 'custom'
        });
        setSelectedIcon(null);
        if (pinIconInputRef.current) {
          pinIconInputRef.current.value = '';
        }
      }
    };

    const handleIconSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file && file.type.startsWith('image/')) {
        setSelectedIcon(file);
      }
    };

    return (
      <div className="p-4 border-b">
        <h3 className="font-semibold mb-3">Pin Type Manager</h3>
        
        <div className="mb-4 space-y-2">
          <input
            type="text"
            placeholder="Pin type name"
            value={newPinType.name}
            onChange={(e) => setNewPinType(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-2 py-1 border rounded text-sm"
          />
          <div className="flex gap-2">
            <input
              type="color"
              value={newPinType.color}
              onChange={(e) => setNewPinType(prev => ({ ...prev, color: e.target.value }))}
              className="w-8 h-8 border rounded cursor-pointer"
            />
            <select
              value={newPinType.category}
              onChange={(e) => setNewPinType(prev => ({ ...prev, category: e.target.value }))}
              className="flex-1 px-2 py-1 border rounded text-sm"
            >
              <option value="settlement">Settlement</option>
              <option value="location">Location</option>
              <option value="terrain">Terrain</option>
              <option value="gameplay">Gameplay</option>
              <option value="custom">Custom</option>
            </select>
          </div>
          <div>
            <input
              ref={pinIconInputRef}
              type="file"
              accept="image/*"
              onChange={handleIconSelect}
              className="hidden"
            />
            <button
              onClick={() => pinIconInputRef.current?.click()}
              className="w-full px-2 py-1 border rounded text-sm bg-gray-50 hover:bg-gray-100"
            >
              {selectedIcon ? selectedIcon.name : 'Choose Icon (Optional)'}
            </button>
          </div>
          <button
            onClick={handleCreatePinType}
            className="w-full bg-blue-600 text-white py-1 rounded text-sm hover:bg-blue-700"
          >
            Create Pin Type
          </button>
        </div>

        <div className="space-y-2 max-h-40 overflow-y-auto">
          {pinTypes.map((pinType) => (
            <div
              key={pinType.id}
              onClick={() => setSelectedPinType(pinType.id)}
              className={`flex items-center gap-2 p-2 rounded cursor-pointer ${
                selectedPinType === pinType.id ? 'bg-blue-100' : 'bg-gray-50 hover:bg-gray-100'
              }`}
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: pinType.color }}
              />
              <span className="text-sm font-medium">{pinType.name}</span>
              <span className="text-xs text-gray-500">({pinType.category})</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Enhanced Scale Settings Component with expanded unit options
  const ScaleSettings = () => {
    const [tempScale, setTempScale] = useState(scaleSettings);

    const handleSaveScale = () => {
      updateMapScale(tempScale.factor, tempScale.unit);
      setShowScaleSettings(false);
    };

    const selectedUnitInfo = scaleUnits.find(unit => unit.value === tempScale.unit);

    return (
      <div className="absolute top-4 right-4 bg-white p-4 rounded-lg shadow-lg z-20 min-w-72">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Settings size={16} />
          Map Scale Settings
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Scale Factor</label>
            <input
              type="number"
              value={tempScale.factor}
              onChange={(e) => setTempScale(prev => ({ ...prev, factor: parseFloat(e.target.value) || 1 }))}
              className="w-full px-3 py-2 border rounded text-sm"
              step="0.1"
              min="0.1"
              placeholder="e.g., 1, 0.5, 2, 5"
            />
            <p className="text-xs text-gray-500 mt-1">
              How many real-world units does 1 pixel represent?
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">Unit of Measurement</label>
            <select
              value={tempScale.unit}
              onChange={(e) => setTempScale(prev => ({ ...prev, unit: e.target.value }))}
              className="w-full px-3 py-2 border rounded text-sm"
            >
              {scaleUnits.map((unit) => (
                <option key={unit.value} value={unit.value}>
                  {unit.label} ({unit.abbreviation})
                </option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-3 rounded text-sm">
            <div className="font-medium text-gray-700 mb-1">Preview:</div>
            <div className="text-gray-600">
              1 pixel = {tempScale.factor} {selectedUnitInfo?.label.toLowerCase() || tempScale.unit}
            </div>
            {tempScale.factor !== 1 && (
              <div className="text-gray-500 text-xs mt-1">
                {Math.round(1 / tempScale.factor * 10) / 10} pixels = 1 {selectedUnitInfo?.label.toLowerCase() || tempScale.unit}
              </div>
            )}
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <div><strong>Current:</strong> 1 pixel = {scaleSettings.factor} {getScaleUnitInfo().label.toLowerCase()}</div>
            <div><strong>Tip:</strong> Use smaller factors (like 0.1) for detailed maps, larger factors (like 10) for world maps.</div>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={handleSaveScale}
              className="flex-1 bg-blue-600 text-white py-2 px-3 rounded text-sm hover:bg-blue-700 flex items-center justify-center gap-1"
            >
              <Save size={14} />
              Save Scale
            </button>
            <button
              onClick={() => setShowScaleSettings(false)}
              className="flex-1 bg-gray-300 text-gray-700 py-2 px-3 rounded text-sm hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Pin Editor Modal
  const PinEditor = () => {
    if (!showPinEditor || !editingPin) return null;

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">
              {editingPin.id === 'new' ? 'Add New Pin' : 'Edit Pin'}
            </h3>
            <button
              onClick={() => setShowPinEditor(false)}
              className="text-gray-500 hover:text-gray-700"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Pin Name</label>
              <input
                type="text"
                value={pinEditorData.label}
                onChange={(e) => setPinEditorData(prev => ({ ...prev, label: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Enter pin name"
                autoFocus
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={pinEditorData.description}
                onChange={(e) => setPinEditorData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
                placeholder="Enter description (optional)"
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Pin Type</label>
              <select
                value={pinEditorData.pin_type_id}
                onChange={(e) => setPinEditorData(prev => ({ ...prev, pin_type_id: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm"
              >
                {pinTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.category})
                  </option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="flex gap-2 mt-6">
            <button
              onClick={savePinFromEditor}
              disabled={!pinEditorData.label.trim()}
              className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Save size={16} className="inline mr-2" />
              Save Pin
            </button>
            <button
              onClick={() => setShowPinEditor(false)}
              className="flex-1 bg-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-400"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
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

            <div>
              <h2 className="text-lg font-semibold mb-4">
                Available Maps 
                {isLoading && <span className="text-sm text-gray-500 ml-2">(Loading...)</span>}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {availableMaps.map((map) => {
                  const unitInfo = scaleUnits.find(unit => unit.value === map.scale_unit) || 
                                  { value: map.scale_unit, label: map.scale_unit, abbreviation: map.scale_unit };
                  return (
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
                      <p className="text-xs text-gray-400">
                        Scale: 1px = {map.scale_factor || 1} {unitInfo.abbreviation}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const unitInfo = getScaleUnitInfo();

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">
      {/* Pin Editor Modal */}
      <PinEditor />
      
      {/* Sidebar */}
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
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => setShowMapSelector(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Change Map
            </button>
            <button
              onClick={() => setShowScaleSettings(true)}
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              Scale Settings
            </button>
          </div>
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
            <button
              onClick={() => handleModeChange('manage-pins')}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded text-sm font-medium ${
                mode === 'manage-pins' 
                  ? 'bg-purple-600 text-white' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Palette size={16} />
              Manage Pin Types
            </button>
          </div>

          {mode === 'add-pin' && pinTypes.length > 0 && (
            <div className="mt-4">
              <label className="block text-sm font-medium mb-2">Selected Pin Type:</label>
              <select
                value={selectedPinType || ''}
                onChange={(e) => setSelectedPinType(e.target.value)}
                className="w-full px-3 py-2 border rounded text-sm"
              >
                {pinTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name} ({type.category})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {mode === 'manage-pins' && <PinTypeManager />}

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
                  <div className="flex items-center gap-2 flex-1">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: pin.color }}
                    />
                    <div className="flex flex-col flex-1">
                      <span className="text-sm font-medium">{pin.label}</span>
                      <span className="text-xs text-gray-500">{pin.pin_type?.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => showPinEditorForExistingPin(pin)}
                      className="text-blue-500 hover:text-blue-700 text-xs p-1"
                      title="Edit pin"
                    >
                      <Edit3 size={12} />
                    </button>
                    <button
                      onClick={() => removePin(pin.id)}
                      className="text-red-500 hover:text-red-700 text-xs p-1"
                      title="Remove pin"
                    >
                      <X size={12} />
                    </button>
                  </div>
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
                  <span className="text-sm">
                    {measurement.distance.toFixed(1)} {unitInfo.abbreviation}
                  </span>
                  <button
                    onClick={() => setMeasurements(prev => prev.filter(m => m.id !== measurement.id))}
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
          <p>📍 Click pins to edit</p>
          <p className="mt-2 font-medium">
            Scale: 1 pixel = {scaleSettings.factor} {unitInfo.abbreviation}
          </p>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative overflow-hidden">
        {showScaleSettings && <ScaleSettings />}

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
            {mode === 'measure' && <span>📏 Click two points to measure distance</span>}
            {mode === 'manage-pins' && <span>🎨 Managing pin types - use sidebar</span>}
          </div>

          <div className="absolute bottom-4 left-4 bg-white bg-opacity-90 px-2 py-1 rounded text-sm font-mono z-10">
            Scale: 1px = {scaleSettings.factor} {unitInfo.abbreviation} | Zoom: {(zoom * 100).toFixed(0)}%
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

          {pins.map((pin) => {
            const pinType = pin.pin_type || pinTypes.find(pt => pt.id === pin.pin_type_id);
            return (
              <div
                key={pin.id}
                style={getPinStyle(pin)}
                title={`${pin.label} (${pinType?.name || 'Unknown'})`}
                onClick={() => showPinEditorForExistingPin(pin)}
                className="cursor-pointer"
              >
                <div className="relative">
                  {pinType?.icon_url ? (
                    <img
                      src={pinType.icon_url}
                      alt={pinType.name}
                      style={{
                        width: 24 * (pinType.size_modifier || 1),
                        height: 24 * (pinType.size_modifier || 1),
                        filter: `drop-shadow(2px 2px 4px rgba(0,0,0,0.3))`
                      }}
                    />
                  ) : (
                    <MapPin 
                      size={24 * (pinType?.size_modifier || 1)} 
                      fill={pinType?.color || pin.color} 
                      color={pinType?.color || pin.color}
                      className="drop-shadow-lg"
                    />
                  )}
                  <div className="absolute -top-12 left-1/2 transform -translate-x-1/2 bg-black text-white px-2 py-1 rounded text-xs whitespace-nowrap opacity-0 hover:opacity-100 transition-opacity pointer-events-none z-10">
                    <div className="font-medium">{pin.label}</div>
                    {pin.description && (
                      <div className="text-gray-300">{pin.description}</div>
                    )}
                    <div className="text-gray-400">{pinType?.name}</div>
                  </div>
                </div>
              </div>
            );
          })}

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
                {measurement.distance.toFixed(1)} {unitInfo.abbreviation}
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
