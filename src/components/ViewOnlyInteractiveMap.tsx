import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Ruler, Layers } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MapSelector from './map/MapSelector';
import MapCanvas from './map/MapCanvas';
import PinManager from './map/PinManager';
import DistanceTool from './map/DistanceTool';
import { Map, Pin, PinType, DistanceMeasurement, convertDatabasePinToPin } from './map/types';

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

interface ViewOnlyInteractiveMapProps {
  onBack: () => void;
}

const ViewOnlyInteractiveMap: React.FC<ViewOnlyInteractiveMapProps> = ({ onBack }) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  
  const [maps, setMaps] = useState<Map[]>([]);
  const [selectedMap, setSelectedMap] = useState<Map | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinTypes, setPinTypes] = useState<PinType[]>([]);
  const [distances, setDistances] = useState<DistanceMeasurement[]>([]);
  const [mapAreas, setMapAreas] = useState<MapArea[]>([]);
  const [activeMode, setActiveMode] = useState<'view' | 'distance'>('view');
  const [showAreaOverlays, setShowAreaOverlays] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load maps on component mount
  useEffect(() => {
    loadMaps();
    loadPinTypes();
  }, []);

  // Load data when map is selected
  useEffect(() => {
    if (selectedMap) {
      loadPins();
      loadDistances();
      loadMapAreas();
    }
  }, [selectedMap]);

  const loadMaps = async () => {
    try {
      const { data, error } = await supabase
        .from('maps')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setMaps(data || []);
    } catch (error) {
      console.error('Error loading maps:', error);
      toast({
        title: "Error",
        description: "Failed to load maps",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const loadPinTypes = async () => {
    try {
      const { data, error } = await supabase
        .from('pin_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (error) throw error;
      setPinTypes(data || []);
    } catch (error) {
      console.error('Error loading pin types:', error);
    }
  };

  const loadPins = async () => {
    if (!selectedMap) return;

    try {
      const { data, error } = await supabase
        .from('pins')
        .select(`
          *,
          pin_types (*)
        `)
        .eq('map_id', selectedMap.id)
        .eq('is_visible', true);

      if (error) throw error;

      const convertedPins = (data || []).map(dbPin => 
        convertDatabasePinToPin(dbPin, selectedMap.width, selectedMap.height)
      );
      
      setPins(convertedPins);
    } catch (error) {
      console.error('Error loading pins:', error);
      toast({
        title: "Error",
        description: "Failed to load map pins",
        variant: "destructive",
      });
    }
  };

  const loadDistances = async () => {
    if (!selectedMap) return;

    try {
      const { data, error } = await supabase
        .from('distance_measurements')
        .select('*')
        .eq('map_id', selectedMap.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Convert the database data to DistanceMeasurement format
      const convertedDistances: DistanceMeasurement[] = (data || []).map(dbDistance => ({
        id: dbDistance.id,
        map_id: dbDistance.map_id,
        name: dbDistance.name,
        points: Array.isArray(dbDistance.points) ? dbDistance.points as { x: number; y: number }[] : [],
        total_distance: dbDistance.total_distance || 0,
        unit: dbDistance.unit || 'pixels',
        created_at: dbDistance.created_at || undefined,
        created_by: dbDistance.created_by || undefined
      }));
      
      setDistances(convertedDistances);
    } catch (error) {
      console.error('Error loading distances:', error);
    }
  };

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

  const handleDistanceAdd = async (points: { x: number; y: number }[], distance: number) => {
    if (!selectedMap || !user) return;

    const normalizedPoints = points.map(point => ({
      x: point.x / selectedMap.width,
      y: point.y / selectedMap.height
    }));

    try {
      const { error } = await supabase
        .from('distance_measurements')
        .insert({
          map_id: selectedMap.id,
          name: `Measurement ${distances.length + 1}`,
          points: normalizedPoints,
          total_distance: distance,
          unit: selectedMap.scale_unit || 'pixels',
          created_by: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Distance measurement added",
      });

      loadDistances();
    } catch (error) {
      console.error('Error adding distance:', error);
      toast({
        title: "Error",
        description: "Failed to add distance measurement",
        variant: "destructive",
      });
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
              <h2 className="text-3xl font-bold text-amber-900 mb-2">Choose a Map to Explore</h2>
              <p className="text-amber-700">
                Select a map below to view locations, pins, and measure distances.
              </p>
            </div>
            
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
                    landmarks, and regions on your map.
                  </p>
                </div>
              )}

              <MapCanvas
                map={selectedMap}
                pins={pins}
                distances={distances}
                activeMode={activeMode}
                onPinAdd={() => {}} // Disabled for view-only
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
                selectedPinType={null}
                onPinTypeSelect={() => {}} // Disabled for view-only
                pins={pins}
                onPinUpdate={() => {}} // Disabled for view-only
                onPinDelete={() => {}} // Disabled for view-only
                userRole="player" // Force player role to disable editing
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

export default ViewOnlyInteractiveMap;
