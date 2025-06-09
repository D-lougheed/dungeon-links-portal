
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Plus, Edit, Trash2, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import 'leaflet/dist/leaflet.css';

interface MapLocation {
  id: string;
  name: string;
  description: string | null;
  location_type: string;
  x_coordinate: number;
  y_coordinate: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

interface InteractiveMapProps {
  onBack: () => void;
}

const LOCATION_TYPES = [
  { value: 'capitol_city', label: 'Capitol City', color: '#FFD700' },
  { value: 'city', label: 'City', color: '#FF6B35' },
  { value: 'town', label: 'Town', color: '#4ECDC4' },
  { value: 'village', label: 'Village', color: '#45B7D1' },
  { value: 'ruins', label: 'Ruins', color: '#96CEB4' },
  { value: 'cave', label: 'Cave', color: '#FFEAA7' },
  { value: 'port', label: 'Port', color: '#DDA0DD' },
  { value: 'custom', label: 'Custom', color: '#A0A0A0' }
];

const MapClickHandler = ({ onMapClick, isDM }: { onMapClick: (lat: number, lng: number) => void, isDM: boolean }) => {
  useMapEvents({
    click: (e) => {
      if (isDM) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLocation, setEditingLocation] = useState<MapLocation | null>(null);
  const [clickPosition, setClickPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location_type: 'city'
  });

  const isDM = userRole === 'dm';

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('map_locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({
        title: "Error",
        description: "Failed to load map locations",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!isDM) return;
    
    setClickPosition({ lat, lng });
    setShowAddForm(true);
    setEditingLocation(null);
    setFormData({
      name: '',
      description: '',
      location_type: 'city'
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !clickPosition) return;

    try {
      const locationData = {
        name: formData.name,
        description: formData.description || null,
        location_type: formData.location_type,
        x_coordinate: clickPosition.lng,
        y_coordinate: clickPosition.lat,
        created_by: user.id
      };

      if (editingLocation) {
        const { error } = await supabase
          .from('map_locations')
          .update(locationData)
          .eq('id', editingLocation.id);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Location updated successfully",
        });
      } else {
        const { error } = await supabase
          .from('map_locations')
          .insert([locationData]);

        if (error) throw error;
        toast({
          title: "Success",
          description: "Location added successfully",
        });
      }

      setShowAddForm(false);
      setEditingLocation(null);
      setClickPosition(null);
      fetchLocations();
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: "Error",
        description: "Failed to save location",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (location: MapLocation) => {
    if (!isDM) return;
    
    setEditingLocation(location);
    setClickPosition({ lat: location.y_coordinate, lng: location.x_coordinate });
    setFormData({
      name: location.name,
      description: location.description || '',
      location_type: location.location_type
    });
    setShowAddForm(true);
  };

  const handleDelete = async (locationId: string) => {
    if (!isDM) return;

    try {
      const { error } = await supabase
        .from('map_locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Location deleted successfully",
      });
      fetchLocations();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        title: "Error",
        description: "Failed to delete location",
        variant: "destructive",
      });
    }
  };

  const createCustomIcon = (locationType: string): L.DivIcon => {
    const locationTypeData = LOCATION_TYPES.find(type => type.value === locationType);
    const color = locationTypeData?.color || '#A0A0A0';
    
    return L.divIcon({
      html: `<div style="background-color: ${color}; width: 20px; height: 20px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);"></div>`,
      className: 'custom-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-amber-700">Loading map...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      <header className="bg-gradient-to-r from-amber-800 to-orange-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Button 
              onClick={onBack}
              variant="outline"
              className="border-amber-200 text-amber-100 hover:bg-amber-700 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Interactive World Map</h1>
              <p className="text-amber-100 text-sm">
                {isDM ? 'Click anywhere to add a location' : 'View campaign locations'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map Container */}
          <div className="lg:col-span-3">
            <Card className="h-[600px]">
              <CardContent className="p-0 h-full">
                <MapContainer
                  center={[0, 0]}
                  zoom={2}
                  className="h-full w-full rounded-lg"
                  crs={L.CRS.Simple}
                  minZoom={-2}
                  maxZoom={4}
                >
                  <TileLayer
                    url="/lovable-uploads/70382beb-0456-4b0e-b550-a587cc615789.png"
                  />
                  <MapClickHandler onMapClick={handleMapClick} isDM={isDM} />
                  
                  {locations.map((location) => (
                    <Marker
                      key={location.id}
                      position={[location.y_coordinate, location.x_coordinate]}
                      icon={createCustomIcon(location.location_type)}
                    >
                      <Popup>
                        <div className="p-2">
                          <h3 className="font-bold text-lg">{location.name}</h3>
                          <p className="text-sm text-gray-600 capitalize mb-2">
                            {LOCATION_TYPES.find(type => type.value === location.location_type)?.label}
                          </p>
                          {location.description && (
                            <p className="text-sm mb-3">{location.description}</p>
                          )}
                          {isDM && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => handleEdit(location)}
                                className="bg-blue-600 hover:bg-blue-700"
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(location.id)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            </div>
                          )}
                        </div>
                      </Popup>
                    </Marker>
                  ))}
                </MapContainer>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1">
            {/* Legend */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Location Types</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {LOCATION_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-2">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300"
                        style={{ backgroundColor: type.color }}
                      ></div>
                      <span className="text-sm">{type.label}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Add/Edit Form */}
            {showAddForm && isDM && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">
                    {editingLocation ? 'Edit Location' : 'Add New Location'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Location name"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="location_type">Type</Label>
                      <Select
                        value={formData.location_type}
                        onValueChange={(value) => setFormData({ ...formData, location_type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LOCATION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Optional description"
                        rows={3}
                      />
                    </div>

                    <div className="flex gap-2">
                      <Button type="submit" className="flex-1">
                        <MapPin className="h-4 w-4 mr-2" />
                        {editingLocation ? 'Update' : 'Add'} Location
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowAddForm(false);
                          setEditingLocation(null);
                          setClickPosition(null);
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default InteractiveMap;
