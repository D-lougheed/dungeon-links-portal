
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Upload, Plus, Ruler, Save, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import MapUploader from './map/MapUploader';
import MapSelector from './map/MapSelector';
import PinManager from './map/PinManager';
import DistanceTool from './map/DistanceTool';
import MapCanvas from './map/MapCanvas';

interface InteractiveMapProps {
  onBack: () => void;
}

interface Map {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  width: number;
  height: number;
  scale_factor: number | null;
  scale_unit: string | null;
  is_active: boolean;
  created_at: string;
}

interface Pin {
  id: string;
  map_id: string;
  pin_type_id: string | null;
  name: string;
  description: string | null;
  x_normalized: number;
  y_normalized: number;
  external_link: string | null;
  is_visible: boolean;
  pin_types?: {
    name: string;
    color: string;
    category: string;
  };
}

interface PinType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  category: string | null;
  size_modifier: number;
}

interface DistanceMeasurement {
  id: string;
  map_id: string;
  name: string;
  points: { x: number; y: number }[];
  total_distance: number | null;
  unit: string;
}

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  const { userRole } = useAuth();
  const { toast } = useToast();
  const [currentView, setCurrentView] = useState<'selector' | 'uploader' | 'map'>('selector');
  const [selectedMap, setSelectedMap] = useState<Map | null>(null);
  const [maps, setMaps] = useState<Map[]>([]);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinTypes, setPinTypes] = useState<PinType[]>([]);
  const [distances, setDistances] = useState<DistanceMeasurement[]>([]);
  const [activeMode, setActiveMode] = useState<'view' | 'pin' | 'distance'>('view');
  const [selectedPinType, setSelectedPinType] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load initial data
  useEffect(() => {
    loadMaps();
    loadPinTypes();
  }, []);

  // Load map data when a map is selected
  useEffect(() => {
    if (selectedMap) {
      loadMapData(selectedMap.id);
    }
  }, [selectedMap]);

  const loadMaps = async () => {
    try {
      const { data, error } = await supabase
        .from('maps')
        .select('*')
        .order('created_at', { ascending: false });

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
        .order('category', { ascending: true });

      if (error) throw error;
      setPinTypes(data || []);
      if (data && data.length > 0) {
        setSelectedPinType(data[0].id);
      }
    } catch (error) {
      console.error('Error loading pin types:', error);
    }
  };

  const loadMapData = async (mapId: string) => {
    try {
      // Load pins
      const { data: pinsData, error: pinsError } = await supabase
        .from('pins')
        .select(`
          *,
          pin_types (
            name,
            color,
            category
          )
        `)
        .eq('map_id', mapId);

      if (pinsError) throw pinsError;
      setPins(pinsData || []);

      // Load distance measurements
      const { data: distanceData, error: distanceError } = await supabase
        .from('distance_measurements')
        .select('*')
        .eq('map_id', mapId);

      if (distanceError) throw distanceError;
      setDistances(distanceData || []);

    } catch (error) {
      console.error('Error loading map data:', error);
      toast({
        title: "Error",
        description: "Failed to load map data",
        variant: "destructive",
      });
    }
  };

  const handleMapSelect = (map: Map) => {
    setSelectedMap(map);
    setCurrentView('map');
    setActiveMode('view');
  };

  const handleMapUploaded = (map: Map) => {
    setMaps(prev => [map, ...prev]);
    setSelectedMap(map);
    setCurrentView('map');
    toast({
      title: "Success",
      description: "Map uploaded successfully!",
    });
  };

  const handlePinAdd = async (x: number, y: number) => {
    if (!selectedMap || !selectedPinType || activeMode !== 'pin') return;

    const pinName = prompt('Enter pin name:');
    if (!pinName) return;

    const description = prompt('Enter pin description (optional):') || null;

    try {
      const { data, error } = await supabase
        .from('pins')
        .insert({
          map_id: selectedMap.id,
          pin_type_id: selectedPinType,
          name: pinName,
          description,
          x_normalized: x / selectedMap.width,
          y_normalized: y / selectedMap.height,
        })
        .select(`
          *,
          pin_types (
            name,
            color,
            category
          )
        `)
        .single();

      if (error) throw error;

      setPins(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Pin added successfully!",
      });
    } catch (error) {
      console.error('Error adding pin:', error);
      toast({
        title: "Error",
        description: "Failed to add pin",
        variant: "destructive",
      });
    }
  };

  const handlePinUpdate = async (pinId: string, updates: Partial<Pin>) => {
    try {
      const { error } = await supabase
        .from('pins')
        .update(updates)
        .eq('id', pinId);

      if (error) throw error;

      setPins(prev => prev.map(pin => 
        pin.id === pinId ? { ...pin, ...updates } : pin
      ));

      toast({
        title: "Success",
        description: "Pin updated successfully!",
      });
    } catch (error) {
      console.error('Error updating pin:', error);
      toast({
        title: "Error",
        description: "Failed to update pin",
        variant: "destructive",
      });
    }
  };

  const handlePinDelete = async (pinId: string) => {
    try {
      const { error } = await supabase
        .from('pins')
        .delete()
        .eq('id', pinId);

      if (error) throw error;

      setPins(prev => prev.filter(pin => pin.id !== pinId));
      toast({
        title: "Success",
        description: "Pin deleted successfully!",
      });
    } catch (error) {
      console.error('Error deleting pin:', error);
      toast({
        title: "Error",
        description: "Failed to delete pin",
        variant: "destructive",
      });
    }
  };

  const handleDistanceAdd = async (points: { x: number; y: number }[], distance: number) => {
    if (!selectedMap) return;

    const name = prompt('Enter measurement name:');
    if (!name) return;

    try {
      const normalizedPoints = points.map(point => ({
        x: point.x / selectedMap.width,
        y: point.y / selectedMap.height
      }));

      const { data, error } = await supabase
        .from('distance_measurements')
        .insert({
          map_id: selectedMap.id,
          name,
          points: normalizedPoints,
          total_distance: distance,
          unit: selectedMap.scale_unit || 'pixels'
        })
        .select()
        .single();

      if (error) throw error;

      setDistances(prev => [...prev, data]);
      toast({
        title: "Success",
        description: "Distance measurement saved!",
      });
    } catch (error) {
      console.error('Error saving distance:', error);
      toast({
        title: "Error",
        description: "Failed to save distance measurement",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-indigo-700">Loading maps...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="bg-gradient-to-r from-blue-800 to-indigo-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              onClick={onBack}
              variant="outline"
              className="border-blue-200 text-blue-100 hover:bg-blue-700 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Interactive World Map</h1>
              <p className="text-blue-100 text-sm">
                {selectedMap ? selectedMap.name : 'Campaign mapping and location management'}
              </p>
            </div>
          </div>
          
          {currentView === 'map' && (
            <div className="flex items-center space-x-2">
              <Button
                onClick={() => setCurrentView('selector')}
                variant="outline"
                className="border-blue-200 text-blue-100 hover:bg-blue-700"
              >
                Change Map
              </Button>
              {userRole === 'dm' && (
                <Button
                  onClick={() => setCurrentView('uploader')}
                  variant="outline"
                  className="border-blue-200 text-blue-100 hover:bg-blue-700"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Upload New Map
                </Button>
              )}
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {currentView === 'selector' && (
          <MapSelector
            maps={maps}
            onMapSelect={handleMapSelect}
            onUploadClick={() => setCurrentView('uploader')}
            userRole={userRole}
          />
        )}

        {currentView === 'uploader' && userRole === 'dm' && (
          <MapUploader
            onMapUploaded={handleMapUploaded}
            onCancel={() => setCurrentView('selector')}
          />
        )}

        {currentView === 'map' && selectedMap && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Map Tools Panel */}
            <div className="lg:col-span-1 space-y-4">
              {/* Mode Selection */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg">Map Tools</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button
                    onClick={() => setActiveMode('view')}
                    variant={activeMode === 'view' ? 'default' : 'outline'}
                    className="w-full justify-start"
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    View Mode
                  </Button>
                  
                  {userRole === 'dm' && (
                    <>
                      <Button
                        onClick={() => setActiveMode('pin')}
                        variant={activeMode === 'pin' ? 'default' : 'outline'}
                        className="w-full justify-start"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Pins
                      </Button>
                      
                      <Button
                        onClick={() => setActiveMode('distance')}
                        variant={activeMode === 'distance' ? 'default' : 'outline'}
                        className="w-full justify-start"
                      >
                        <Ruler className="h-4 w-4 mr-2" />
                        Measure Distance
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Pin Manager */}
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

              {/* Distance Tool */}
              <DistanceTool
                distances={distances}
                map={selectedMap}
                userRole={userRole}
                activeMode={activeMode}
              />
            </div>

            {/* Map Display */}
            <div className="lg:col-span-3">
              <Card className="h-full">
                <CardContent className="p-4 h-full">
                  <MapCanvas
                    map={selectedMap}
                    pins={pins}
                    distances={distances}
                    activeMode={activeMode}
                    onPinAdd={handlePinAdd}
                    onDistanceAdd={handleDistanceAdd}
                    userRole={userRole}
                  />
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default InteractiveMap;
