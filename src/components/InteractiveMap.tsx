import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, MapPin, Ruler, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MapUploader from './map/MapUploader';
import MapSelector from './map/MapSelector';
import MapCanvas from './map/MapCanvas';
import PinManager from './map/PinManager';
import DistanceTool from './map/DistanceTool';
import { Map, Pin, PinType, DistanceMeasurement, convertDatabasePinToPin, convertPinToDatabasePin } from './map/types';

interface MapArea {
  id: string;
  area_name: string;
  area_type: string;
  description?: string;
  terrain_features: string[];
  landmarks: string[];
  general_location?: string;
  confidence_score?: number;
  bounding_box?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  } | null;
}

interface InteractiveMapProps {
  onBack: () => void;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  
  const [maps, setMaps] = useState<Map[]>([]);
  const [selectedMap, setSelectedMap] = useState<Map | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinTypes, setPinTypes] = useState<PinType[]>([]);
  const [distances, setDistances] = useState<DistanceMeasurement[]>([]);
  const [mapAreas, setMapAreas] = useState<MapArea[]>([]);
  const [selectedPinType, setSelectedPinType] = useState<PinType | null>(null);
  const [activeMode, setActiveMode] = useState<'view' | 'pin' | 'distance'>('view');
  const [showAreaOverlays, setShowAreaOverlays] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load maps from Supabase
  const loadMaps = async () => {
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

      const supabaseMaps: Map[] = mapsData.map((map: any) => ({
        id: map.id,
        name: map.name,
        image_url: map.image_url,
        image_path: map.image_path,
        width: map.width,
        height: map.height,
        scale_factor: map.scale_factor,
        scale_unit: map.scale_unit,
        description: map.description,
        is_active: map.is_active
      }));
      
      setMaps(supabaseMaps);
      
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
        setSelectedPinType(data[0]);
      }
    } catch (error) {
      console.error('Error loading pin types:', error);
    }
  };

  // Load pins for the current map with proper coordinate conversion
  const loadPins = async () => {
    if (!selectedMap) {
      console.log('No selected map, skipping pin loading');
      return;
    }

    try {
      console.log('Loading pins for map:', selectedMap.id);
      
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
        .eq('map_id', selectedMap.id)
        .eq('is_visible', true);

      if (error) {
        console.error('Error loading pins:', error);
        return;
      }

      console.log('Loaded pins from database:', data);
      console.log('Selected map dimensions:', selectedMap.width, 'x', selectedMap.height);

      const convertedPins: Pin[] = data.map((dbPin: any) => {
        const pin = {
          id: dbPin.id,
          x: Number(dbPin.x_normalized) * selectedMap.width,
          y: Number(dbPin.y_normalized) * selectedMap.height,
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
  const loadDistances = async () => {
    if (!selectedMap) {
      console.log('No selected map, skipping distance loading');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('distance_measurements')
        .select('*')
        .eq('map_id', selectedMap.id);

      if (error) {
        console.error('Error loading measurements:', error);
        return;
      }

      const convertedMeasurements: DistanceMeasurement[] = data.map((measurement: any) => {
        const points = measurement.points as any[];
        if (points && points.length >= 2) {
          return {
            id: measurement.id,
            startX: points[0].x * selectedMap.width,
            startY: points[0].y * selectedMap.height,
            endX: points[1].x * selectedMap.width,
            endY: points[1].y * selectedMap.height,
            distance: measurement.total_distance || 0
          };
        }
        return null;
      }).filter(Boolean) as DistanceMeasurement[];

      setDistances(convertedMeasurements);
    } catch (error) {
      console.error('Error loading measurements:', error);
    }
  };

  // Save pin to database with proper coordinate normalization
  const savePinToDatabase = async (pin: Pin) => {
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
        pin_type_id: pin.pin_type_id || selectedPinType?.id,
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

      toast({
        title: "Success",
        description: "Pin saved successfully!",
      });

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
      } as Pin;
    } catch (error) {
      console.error('Error saving pin:', error);
      return null;
    }
  };

  // Update pin in database
  const updatePinInDatabase = async (pin: Pin) => {
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
      setSelectedPinType(data);
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

      const newMap: Map = {
        id: mapRecord.id,
        name: mapRecord.name,
        image_url: mapRecord.image_url,
        image_path: mapRecord.image_path,
        width: mapRecord.width,
        height: mapRecord.height,
        scale_factor: mapRecord.scale_factor,
        scale_unit: mapRecord.scale_unit,
        description: mapRecord.description
      };

      setMaps(prev => [newMap, ...prev]);
      setSelectedMap(newMap);
      setShowAreaOverlays(false);

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
    }
  };

  // Load data when map is selected
  useEffect(() => {
    if (selectedMap) {
      loadPins();
      loadDistances();
      loadMapAreas();
    }
  }, [selectedMap]);

  // Load maps from Supabase
  useEffect(() => {
    loadMaps();
  }, []);

  // Load pin types from database
  useEffect(() => {
    loadPinTypes();
  }, []);

  const loadMapAreas = async () => {
    if (!selectedMap) return;

    try {
      const { data, error } = await supabase
        .from('map_areas')
        .select('*')
        .eq('map_id', selectedMap.id)
        .order('area_name');
      
      if (error) throw error;
      
      // Transform the data to match our MapArea interface with proper type conversion
      const transformedAreas: MapArea[] = (data || []).map(area => {
        // Handle bounding_box conversion from Json to expected type
        let boundingBox: { x1: number; y1: number; x2: number; y2: number } | null = null;
        
        if (area.bounding_box && typeof area.bounding_box === 'object' && area.bounding_box !== null) {
          const bbox = area.bounding_box as any;
          if (typeof bbox.x1 === 'number' && typeof bbox.y1 === 'number' && 
              typeof bbox.x2 === 'number' && typeof bbox.y2 === 'number') {
            boundingBox = {
              x1: bbox.x1,
              y1: bbox.y1,
              x2: bbox.x2,
              y2: bbox.y2
            };
          }
        }

        return {
          id: area.id,
          area_name: area.area_name,
          area_type: area.area_type,
          description: area.description,
          terrain_features: Array.isArray(area.terrain_features) ? area.terrain_features.map(item => String(item)) : [],
          landmarks: Array.isArray(area.landmarks) ? area.landmarks.map(item => String(item)) : [],
          general_location: area.general_location,
          confidence_score: area.confidence_score,
          bounding_box: boundingBox
        };
      });
      
      setMapAreas(transformedAreas);
    } catch (error) {
      console.error('Error loading map areas:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-800 mx-auto mb-4"></div>
          <p className="text-amber-800">Loading maps...</p>
        </div>
      </div>
    );
  }

  if (userRole !== 'dm') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-amber-900 mb-4">Access Restricted</h2>
          <p className="text-amber-700 mb-4">Only Dungeon Masters can access the interactive map editor.</p>
          <Button onClick={onBack} variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100">
            Back to Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-800 to-orange-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Button 
              onClick={onBack}
              variant="ghost"
              className="text-amber-100 hover:bg-amber-700"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div className="h-6 w-px bg-amber-600"></div>
            <h1 className="text-2xl font-bold">Interactive Maps</h1>
          </div>
          
          {selectedMap && (
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setActiveMode('view')}
                variant={activeMode === 'view' ? 'default' : 'outline'}
                size="sm"
                className={activeMode === 'view' 
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                  : 'border-amber-200 text-amber-100 hover:bg-amber-700'
                }
              >
                <Eye className="h-4 w-4 mr-2" />
                View
              </Button>
              <Button
                onClick={() => setActiveMode('pin')}
                variant={activeMode === 'pin' ? 'default' : 'outline'}
                size="sm"
                className={activeMode === 'pin' 
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                  : 'border-amber-200 text-amber-100 hover:bg-amber-700'
                }
              >
                <MapPin className="h-4 w-4 mr-2" />
                Add Pins
              </Button>
              <Button
                onClick={() => setActiveMode('distance')}
                variant={activeMode === 'distance' ? 'default' : 'outline'}
                size="sm"
                className={activeMode === 'distance' 
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                  : 'border-amber-200 text-amber-100 hover:bg-amber-700'
                }
              >
                <Ruler className="h-4 w-4 mr-2" />
                Measure
              </Button>
              {mapAreas.filter(area => area.bounding_box).length > 0 && (
                <Button
                  onClick={() => setShowAreaOverlays(!showAreaOverlays)}
                  variant={showAreaOverlays ? 'default' : 'outline'}
                  size="sm"
                  className={showAreaOverlays 
                    ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                    : 'border-amber-200 text-amber-100 hover:bg-amber-700'
                  }
                >
                  <Layers className="h-4 w-4 mr-2" />
                  AI Areas ({mapAreas.filter(area => area.bounding_box).length})
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!selectedMap ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-amber-900 mb-2">Manage Your Maps</h2>
              <p className="text-amber-700">
                Upload new maps or select an existing map to add pins, measure distances, and manage locations.
              </p>
            </div>
            
            <MapUploader onMapUploaded={loadMaps} />
            
            <MapSelector
              maps={maps}
              onMapSelect={setSelectedMap}
              userRole={userRole}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main map area */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-amber-900">{selectedMap.name}</h2>
                <Button
                  onClick={() => setSelectedMap(null)}
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  Choose Different Map
                </Button>
              </div>
              
              {selectedMap.description && (
                <p className="text-amber-700">{selectedMap.description}</p>
              )}

              {showAreaOverlays && mapAreas.filter(area => area.bounding_box).length > 0 && (
                <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg">
                  <p className="text-blue-800 text-sm">
                    <strong>AI Area Overlays:</strong> Showing {mapAreas.filter(area => area.bounding_box).length} areas 
                    identified by AI analysis. These colored zones show where the AI detected different terrain types, 
                    landmarks, and regions on your map. You can review and manually correct these areas if needed.
                  </p>
                </div>
              )}

              <MapCanvas
                map={selectedMap}
                pins={pins}
                distances={distances}
                activeMode={activeMode}
                onPinAdd={handlePinAdd}
                onDistanceAdd={handleDistanceAdd}
                userRole={userRole}
                mapAreas={mapAreas}
                showAreaOverlays={showAreaOverlays}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <PinManager
                pinTypes={pinTypes}
                selectedPinType={selectedPinType}
                onPinTypeSelect={setSelectedPinType}
                pins={pins}
                onPinUpdate={handlePinUpdate}
                onPinDelete={handlePinDelete}
                userRole={userRole}
                activeMode={activeMode}
              />

              <DistanceTool
                distances={distances}
                map={selectedMap}
                userRole={userRole}
                activeMode={activeMode}
              />

              {/* AI Areas Panel */}
              {mapAreas.length > 0 && (
                <div className="bg-white rounded-lg border border-gray-200 p-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    AI-Identified Areas ({mapAreas.length})
                  </h3>
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {mapAreas.map((area) => (
                      <div key={area.id} className="p-2 bg-gray-50 rounded border text-sm">
                        <div className="flex justify-between items-start mb-1">
                          <span className="font-medium text-gray-900">{area.area_name}</span>
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                            {area.area_type}
                          </span>
                        </div>
                        {area.description && (
                          <p className="text-gray-600 text-xs mb-1">{area.description}</p>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-xs text-gray-500">
                            {area.general_location}
                          </span>
                          {area.bounding_box ? (
                            <span className="text-xs text-green-600">📍 Mapped</span>
                          ) : (
                            <span className="text-xs text-gray-400">📍 No coordinates</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default InteractiveMap;
