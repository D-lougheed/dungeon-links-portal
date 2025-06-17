
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Ruler } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MapSelector from './map/MapSelector';
import MapCanvas from './map/MapCanvas';
import PinManager from './map/PinManager';
import DistanceTool from './map/DistanceTool';
import { Map, Pin, PinType, DistanceMeasurement, convertDatabasePinToPin } from './map/types';

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
  const [activeMode, setActiveMode] = useState<'view' | 'distance'>('view');
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

              <MapCanvas
                map={selectedMap}
                pins={pins}
                distances={distances}
                activeMode={activeMode}
                onPinAdd={() => {}} // Disabled for view-only
                onDistanceAdd={handleDistanceAdd}
                userRole={userRole}
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ViewOnlyInteractiveMap;
