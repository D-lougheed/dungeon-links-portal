
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, MapPin, Ruler, Upload } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MapSelector from './map/MapSelector';
import MapCanvas from './map/MapCanvas';
import PinManager from './map/PinManager';
import DistanceTool from './map/DistanceTool';
import MapUploader from './map/MapUploader';
import { Map, Pin, PinType, DistanceMeasurement, convertDatabasePinToPin, convertPinToDatabasePin } from './map/types';

interface InteractiveMapAdminProps {
  onBack: () => void;
}

const InteractiveMapAdmin: React.FC<InteractiveMapAdminProps> = ({ onBack }) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  
  const [maps, setMaps] = useState<Map[]>([]);
  const [selectedMap, setSelectedMap] = useState<Map | null>(null);
  const [pins, setPins] = useState<Pin[]>([]);
  const [pinTypes, setPinTypes] = useState<PinType[]>([]);
  const [distances, setDistances] = useState<DistanceMeasurement[]>([]);
  const [activeMode, setActiveMode] = useState<'view' | 'pin' | 'distance'>('view');
  const [selectedPinType, setSelectedPinType] = useState<string | null>(null);
  const [showUploader, setShowUploader] = useState(false);
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
      let query = supabase
        .from('pins')
        .select(`
          *,
          pin_types (*)
        `)
        .eq('map_id', selectedMap.id);

      // DMs can see all pins, players only see visible ones
      if (userRole !== 'dm') {
        query = query.eq('is_visible', true);
      }

      const { data, error } = await query;

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

  const handlePinAdd = async (x: number, y: number) => {
    if (!selectedMap || !selectedPinType || !user) return;

    const selectedType = pinTypes.find(type => type.id === selectedPinType);
    if (!selectedType) return;

    const newPin: Pin = {
      id: 'temp-' + Date.now(),
      x,
      y,
      x_normalized: x / selectedMap.width,
      y_normalized: y / selectedMap.height,
      label: `New ${selectedType.name}`,
      name: `New ${selectedType.name}`,
      color: selectedType.color,
      pin_type_id: selectedPinType,
      pin_type: selectedType,
      pin_types: selectedType,
      map_id: selectedMap.id,
      is_visible: true
    };

    try {
      const dbPin = convertPinToDatabasePin(newPin, selectedMap.id, selectedMap.width, selectedMap.height);
      
      const { data, error } = await supabase
        .from('pins')
        .insert({
          ...dbPin,
          created_by: user.id
        })
        .select(`
          *,
          pin_types (*)
        `)
        .single();

      if (error) throw error;

      const convertedPin = convertDatabasePinToPin(data, selectedMap.width, selectedMap.height);
      setPins(prev => [...prev, convertedPin]);

      toast({
        title: "Success",
        description: "Pin added successfully",
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
    if (!user || !selectedMap) return;

    try {
      const updateData: any = {};
      
      if (updates.name !== undefined) updateData.name = updates.name;
      if (updates.description !== undefined) updateData.description = updates.description;
      if (updates.is_visible !== undefined) updateData.is_visible = updates.is_visible;

      const { error } = await supabase
        .from('pins')
        .update(updateData)
        .eq('id', pinId);

      if (error) throw error;

      setPins(prev => prev.map(pin => 
        pin.id === pinId ? { ...pin, ...updates } : pin
      ));

      toast({
        title: "Success",
        description: "Pin updated successfully",
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
    if (!user) return;

    try {
      const { error } = await supabase
        .from('pins')
        .delete()
        .eq('id', pinId);

      if (error) throw error;

      setPins(prev => prev.filter(pin => pin.id !== pinId));

      toast({
        title: "Success",
        description: "Pin deleted successfully",
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

  const handleMapUploaded = (newMap: Map) => {
    setMaps(prev => [...prev, newMap]);
    setSelectedMap(newMap);
    setShowUploader(false);
    toast({
      title: "Success",
      description: "Map uploaded and selected successfully",
    });
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
            <h1 className="text-2xl font-bold">Interactive Maps (Admin)</h1>
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
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {showUploader ? (
          <MapUploader
            onMapUploaded={handleMapUploaded}
            onCancel={() => setShowUploader(false)}
          />
        ) : !selectedMap ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-amber-900 mb-2">Manage Your Maps</h2>
              <p className="text-amber-700">
                Upload new maps or select existing ones to manage pins and areas.
              </p>
            </div>
            
            <MapSelector
              maps={maps}
              onMapSelect={setSelectedMap}
              onUploadClick={() => setShowUploader(true)}
              userRole={userRole}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main map area */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-amber-900">{selectedMap.name}</h2>
                <div className="flex space-x-2">
                  <Button
                    onClick={() => setShowUploader(true)}
                    variant="outline"
                    className="border-amber-300 text-amber-800 hover:bg-amber-100"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload New Map
                  </Button>
                  <Button
                    onClick={() => setSelectedMap(null)}
                    variant="outline"
                    className="border-amber-300 text-amber-800 hover:bg-amber-100"
                  >
                    Choose Different Map
                  </Button>
                </div>
              </div>
              
              {selectedMap.description && (
                <p className="text-amber-700">{selectedMap.description}</p>
              )}

              <MapCanvas
                map={selectedMap}
                pins={pins}
                distances={distances}
                activeMode={activeMode}
                onPinAdd={handlePinAdd}
                onDistanceAdd={handleDistanceAdd}
                userRole={userRole}
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
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default InteractiveMapAdmin;
