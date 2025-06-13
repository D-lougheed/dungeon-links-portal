
import React, { useState, useEffect, useCallback } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import { LatLng, CRS, Icon } from 'leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Save, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import 'leaflet/dist/leaflet.css';

// Custom icon for map pins
const pinIcon = new Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

interface MapPin {
  id: string;
  x: number;
  y: number;
  title: string;
  description: string | null;
  created_at: string;
  user_id: string | null;
}

interface AddPinComponentProps {
  onAddPin: (point: LatLng) => void;
}

const AddPinComponent: React.FC<AddPinComponentProps> = ({ onAddPin }) => {
  useMapEvents({
    click: (e) => {
      onAddPin(e.latlng);
    },
  });
  return null;
};

interface AdminMapEditorProps {
  onBack: () => void;
}

const AdminMapEditor: React.FC<AdminMapEditorProps> = ({ onBack }) => {
  const [pins, setPins] = useState<MapPin[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [newPin, setNewPin] = useState<{ x: number; y: number; title: string; description: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Map bounds - adjust these based on your map image dimensions
  const mapBounds: [[number, number], [number, number]] = [[0, 0], [1000, 1000]];

  const fetchPins = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('map_pins')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPins(data || []);
    } catch (error) {
      console.error('Error fetching pins:', error);
      toast({
        title: "Error",
        description: "Failed to load map pins",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchPins();

    // Set up real-time subscription
    const channel = supabase
      .channel('map_pins_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'map_pins' }, (payload) => {
        console.log('Real-time update:', payload);
        fetchPins(); // Refetch all pins on any change
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchPins]);

  const handleAddPin = useCallback((point: LatLng) => {
    setNewPin({
      x: point.lat,
      y: point.lng,
      title: '',
      description: ''
    });
    setSelectedPin(null);
    setIsEditing(true);
  }, []);

  const handleSaveNewPin = async () => {
    if (!newPin || !newPin.title.trim()) {
      toast({
        title: "Error",
        description: "Pin title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('map_pins')
        .insert({
          x: newPin.x,
          y: newPin.y,
          title: newPin.title,
          description: newPin.description || null,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pin added successfully",
      });

      setNewPin(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving pin:', error);
      toast({
        title: "Error",
        description: "Failed to save pin",
        variant: "destructive",
      });
    }
  };

  const handleUpdatePin = async () => {
    if (!selectedPin || !selectedPin.title.trim()) {
      toast({
        title: "Error",
        description: "Pin title is required",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('map_pins')
        .update({
          title: selectedPin.title,
          description: selectedPin.description
        })
        .eq('id', selectedPin.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pin updated successfully",
      });

      setIsEditing(false);
    } catch (error) {
      console.error('Error updating pin:', error);
      toast({
        title: "Error",
        description: "Failed to update pin",
        variant: "destructive",
      });
    }
  };

  const handleDeletePin = async (pinId: string) => {
    if (!confirm('Are you sure you want to delete this pin?')) return;

    try {
      const { error } = await supabase
        .from('map_pins')
        .delete()
        .eq('id', pinId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pin deleted successfully",
      });

      setSelectedPin(null);
      setIsEditing(false);
    } catch (error) {
      console.error('Error deleting pin:', error);
      toast({
        title: "Error",
        description: "Failed to delete pin",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-amber-700">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Button
            onClick={onBack}
            variant="outline"
            className="border-amber-300 text-amber-800 hover:bg-amber-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Admin Tools
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-200px)]">
          {/* Map Panel */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-4">
                <CardTitle className="text-amber-900 flex items-center">
                  <Plus className="h-5 w-5 mr-2" />
                  Interactive Map Editor
                </CardTitle>
                <p className="text-sm text-amber-700">
                  Click anywhere on the map to add a new pin
                </p>
              </CardHeader>
              <CardContent className="h-[calc(100%-100px)]">
                <div className="w-full h-full border rounded">
                  <MapContainer
                    crs={CRS.Simple}
                    bounds={mapBounds}
                    style={{ height: '100%', width: '100%' }}
                    className="rounded"
                  >
                    <TileLayer
                      url="/lovable-uploads/70382beb-0456-4b0e-b550-a587cc615789.png"
                      attribution="Campaign Map"
                    />
                    
                    <AddPinComponent onAddPin={handleAddPin} />
                    
                    {pins.map((pin) => (
                      <Marker
                        key={pin.id}
                        position={[pin.x, pin.y]}
                        icon={pinIcon}
                        eventHandlers={{
                          click: () => {
                            setSelectedPin(pin);
                            setNewPin(null);
                            setIsEditing(false);
                          }
                        }}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold text-amber-900">{pin.title}</h3>
                            {pin.description && (
                              <p className="text-sm text-amber-700 mt-1">{pin.description}</p>
                            )}
                          </div>
                        </Popup>
                      </Marker>
                    ))}
                    
                    {newPin && (
                      <Marker
                        position={[newPin.x, newPin.y]}
                        icon={pinIcon}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold text-green-600">New Pin</h3>
                            <p className="text-sm text-gray-600">Configure in the panel →</p>
                          </div>
                        </Popup>
                      </Marker>
                    )}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Control Panel */}
          <div className="lg:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="text-amber-900">
                  {newPin ? 'Add New Pin' : selectedPin ? 'Edit Pin' : 'Pin Manager'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {newPin && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-amber-800">Title</label>
                      <Input
                        value={newPin.title}
                        onChange={(e) => setNewPin({ ...newPin, title: e.target.value })}
                        placeholder="Enter pin title"
                        className="border-amber-300 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-amber-800">Description</label>
                      <Textarea
                        value={newPin.description}
                        onChange={(e) => setNewPin({ ...newPin, description: e.target.value })}
                        placeholder="Enter pin description (optional)"
                        className="border-amber-300 focus:border-amber-500"
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveNewPin}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        Save Pin
                      </Button>
                      <Button
                        onClick={() => setNewPin(null)}
                        variant="outline"
                        className="border-amber-300 text-amber-800"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {selectedPin && !newPin && (
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-amber-800">Title</label>
                      <Input
                        value={selectedPin.title}
                        onChange={(e) => setSelectedPin({ ...selectedPin, title: e.target.value })}
                        disabled={!isEditing}
                        className="border-amber-300 focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-amber-800">Description</label>
                      <Textarea
                        value={selectedPin.description || ''}
                        onChange={(e) => setSelectedPin({ ...selectedPin, description: e.target.value })}
                        disabled={!isEditing}
                        className="border-amber-300 focus:border-amber-500"
                        rows={3}
                      />
                    </div>
                    <div className="text-xs text-amber-600">
                      Position: ({selectedPin.x.toFixed(2)}, {selectedPin.y.toFixed(2)})
                    </div>
                    <div className="flex gap-2">
                      {!isEditing ? (
                        <>
                          <Button
                            onClick={() => setIsEditing(true)}
                            className="flex-1 bg-amber-600 hover:bg-amber-700"
                          >
                            Edit Pin
                          </Button>
                          <Button
                            onClick={() => handleDeletePin(selectedPin.id)}
                            variant="outline"
                            className="border-red-300 text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            onClick={handleUpdatePin}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            <Save className="h-4 w-4 mr-2" />
                            Save
                          </Button>
                          <Button
                            onClick={() => setIsEditing(false)}
                            variant="outline"
                            className="border-amber-300 text-amber-800"
                          >
                            Cancel
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {!selectedPin && !newPin && (
                  <div className="space-y-4">
                    <div className="text-center text-amber-700">
                      <p className="text-sm">Click on the map to add a new pin</p>
                      <p className="text-sm">Click on existing pins to edit them</p>
                    </div>
                    
                    <div className="border-t border-amber-200 pt-4">
                      <h4 className="font-medium text-amber-900 mb-2">
                        Existing Pins ({pins.length})
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {pins.map((pin) => (
                          <div
                            key={pin.id}
                            className="p-2 border border-amber-200 rounded cursor-pointer hover:bg-amber-50"
                            onClick={() => setSelectedPin(pin)}
                          >
                            <div className="font-medium text-sm text-amber-900">{pin.title}</div>
                            <div className="text-xs text-amber-600">
                              ({pin.x.toFixed(2)}, {pin.y.toFixed(2)})
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMapEditor;
