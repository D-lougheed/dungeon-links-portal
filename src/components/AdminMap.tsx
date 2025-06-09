
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, ImageOverlay, Marker, Popup, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, MapPin, Upload, Trash2, Save, Plus, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

// Fix Leaflet default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface AdminMapProps {
  onBack: () => void;
}

interface MapLocation {
  id: string;
  name: string;
  description: string | null;
  x_coordinate: number;
  y_coordinate: number;
  location_type: string;
  icon_id: string | null;
  zoom_level: number | null;
  lat: number;
  lng: number;
  icon?: {
    id: string;
    name: string;
    tag_type: string;
    icon_url: string;
    icon_file_path: string | null;
    icon_size_width: number;
    icon_size_height: number;
  };
}

interface MapIcon {
  id: string;
  name: string;
  tag_type: string;
  icon_url: string;
  icon_file_path: string | null;
  icon_size_width: number;
  icon_size_height: number;
}

interface MapSettings {
  id: string;
  map_image_url: string | null;
  map_image_path: string | null;
  default_zoom: number;
  max_zoom: number;
  min_zoom: number;
  center_lat: number;
  center_lng: number;
}

// Separate click handler component
const MapClickHandler: React.FC<{
  isAddingLocation: boolean;
  onLocationSelect: (lat: number, lng: number) => void;
}> = ({ isAddingLocation, onLocationSelect }) => {
  useMapEvents({
    click(e) {
      if (isAddingLocation) {
        console.log(`Map clicked at: ${e.latlng.lat}, ${e.latlng.lng}`);
        onLocationSelect(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
};

const AdminMap: React.FC<AdminMapProps> = ({ onBack }) => {
  const [mapSettings, setMapSettings] = useState<MapSettings | null>(null);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [icons, setIcons] = useState<MapIcon[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [newLocation, setNewLocation] = useState({
    name: '',
    description: '',
    location_type: '',
    icon_id: '',
    lat: 0,
    lng: 0
  });
  const [mapImageFile, setMapImageFile] = useState<File | null>(null);
  const [iconImageFile, setIconImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadMapData();
  }, []);

  const getImageUrl = (filePath: string | null, fallbackUrl: string | null) => {
    if (filePath) {
      const bucket = filePath.startsWith('map-images/') ? 'map-images' : 'map-icons';
      const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
      return data.publicUrl;
    }
    return fallbackUrl;
  };

  const loadMapData = async () => {
    try {
      setIsLoading(true);
      
      const { data: settings, error: settingsError } = await supabase
        .from('map_settings')
        .select('*')
        .single();

      if (settingsError && settingsError.code !== 'PGRST116') {
        throw settingsError;
      }

      if (settings) {
        setMapSettings(settings);
      }

      const { data: iconsData, error: iconsError } = await supabase
        .from('map_icons')
        .select('*')
        .order('tag_type', { ascending: true });

      if (iconsError) {
        throw iconsError;
      }

      setIcons(iconsData || []);

      const { data: locationsData, error: locationsError } = await supabase
        .from('map_locations')
        .select(`
          *,
          icon:map_icons(id, name, tag_type, icon_url, icon_file_path, icon_size_width, icon_size_height)
        `)
        .order('created_at', { ascending: false });

      if (locationsError) {
        throw locationsError;
      }

      const convertedLocations = (locationsData || []).map(location => ({
        ...location,
        lat: (50 - location.y_coordinate) * 1.8,
        lng: (location.x_coordinate - 50) * 3.6
      }));

      setLocations(convertedLocations as MapLocation[]);
    } catch (error) {
      console.error('Error loading map data:', error);
      toast({
        title: "Error Loading Map",
        description: "There was an error loading the map data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const createCustomIcon = (icon: MapIcon) => {
    const iconUrl = getImageUrl(icon.icon_file_path, icon.icon_url);
    return L.icon({
      iconUrl: iconUrl || '',
      iconSize: [icon.icon_size_width, icon.icon_size_height],
      iconAnchor: [icon.icon_size_width / 2, icon.icon_size_height],
      popupAnchor: [0, -icon.icon_size_height],
    });
  };

  const handleSaveLocation = async () => {
    if (!newLocation.name || !newLocation.location_type) {
      toast({
        title: "Missing Information",
        description: "Please provide a name and location type.",
        variant: "destructive",
      });
      return;
    }

    try {
      const x_coordinate = (newLocation.lng / 3.6) + 50;
      const y_coordinate = 50 - (newLocation.lat / 1.8);

      const { error } = await supabase
        .from('map_locations')
        .insert({
          name: newLocation.name,
          description: newLocation.description || null,
          location_type: newLocation.location_type,
          icon_id: newLocation.icon_id || null,
          x_coordinate: Math.max(0, Math.min(100, x_coordinate)),
          y_coordinate: Math.max(0, Math.min(100, y_coordinate)),
          created_by: user?.id || ''
        });

      if (error) throw error;

      toast({
        title: "Location Added",
        description: "The new location has been successfully added to the map.",
      });

      setIsAddingLocation(false);
      setNewLocation({
        name: '',
        description: '',
        location_type: '',
        icon_id: '',
        lat: 0,
        lng: 0
      });
      
      await loadMapData();
    } catch (error) {
      console.error('Error saving location:', error);
      toast({
        title: "Save Failed",
        description: "There was an error saving the location. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteLocation = async (locationId: string) => {
    if (!confirm('Are you sure you want to delete this location?')) return;

    try {
      const { error } = await supabase
        .from('map_locations')
        .delete()
        .eq('id', locationId);

      if (error) throw error;

      toast({
        title: "Location Deleted",
        description: "The location has been removed from the map.",
      });

      setSelectedLocation(null);
      await loadMapData();
    } catch (error) {
      console.error('Error deleting location:', error);
      toast({
        title: "Delete Failed",
        description: "There was an error deleting the location. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleLocationClick = (location: MapLocation) => {
    setSelectedLocation(location);
    setIsAddingLocation(false);
  };

  const handleMapClick = (lat: number, lng: number) => {
    setNewLocation(prev => ({
      ...prev,
      lat,
      lng
    }));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 flex items-center justify-center">
        <div className="text-slate-700">Loading admin map...</div>
      </div>
    );
  }

  const currentMapImageUrl = getImageUrl(mapSettings?.map_image_path, mapSettings?.map_image_url);
  const mapBounds = L.latLngBounds([[-85, -180], [85, 180]]);

  // Extract map rendering component
  const renderMap = () => {
    return (
      <MapContainer
        center={[0, 0]}
        zoom={mapSettings?.default_zoom || 2}
        style={{ height: '100%', width: '100%' }}
        maxBounds={mapBounds}
        maxBoundsViscosity={1.0}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {currentMapImageUrl && (
          <ImageOverlay
            url={currentMapImageUrl}
            bounds={mapBounds}
            opacity={0.8}
          />
        )}
        
        <MapClickHandler 
          isAddingLocation={isAddingLocation}
          onLocationSelect={handleMapClick}
        />
        
        {locations.map((location) => {
          const customIcon = location.icon ? createCustomIcon(location.icon) : undefined;
          
          return (
            <Marker
              key={location.id}
              position={[location.lat, location.lng]}
              icon={customIcon}
              eventHandlers={{
                click: () => handleLocationClick(location)
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-lg">{location.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">Type: {location.location_type}</p>
                  {location.description && (
                    <p className="text-sm mb-3">{location.description}</p>
                  )}
                  <Button
                    onClick={() => handleDeleteLocation(location.id)}
                    variant="destructive"
                    size="sm"
                    className="w-full"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Delete
                  </Button>
                </div>
              </Popup>
            </Marker>
          );
        })}
        
        {isAddingLocation && newLocation.lat !== 0 && newLocation.lng !== 0 && (
          <Marker position={[newLocation.lat, newLocation.lng]}>
            <Popup>
              <div className="p-2">
                <h3 className="font-bold text-green-600">New Location</h3>
                <p className="text-sm">Click "Save Location" to add this marker</p>
              </div>
            </Popup>
          </Marker>
        )}
      </MapContainer>
    );
  };

  // Extract form component
  const renderLocationForm = () => {
    if (!isAddingLocation && !selectedLocation) return null;
    
    return (
      <Card className="border-slate-200 bg-white shadow-lg">
        <CardHeader>
          <CardTitle className="text-slate-900">
            {isAddingLocation ? 'Add New Location' : 'Edit Location'}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAddingLocation ? (
            <>
              <div>
                <Label htmlFor="locationName">Name</Label>
                <Input
                  id="locationName"
                  value={newLocation.name}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Location name"
                />
              </div>
              
              <div>
                <Label htmlFor="locationType">Type</Label>
                <Input
                  id="locationType"
                  value={newLocation.location_type}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, location_type: e.target.value }))}
                  placeholder="City, Village, Dungeon, etc."
                />
              </div>
              
              <div>
                <Label htmlFor="locationIcon">Icon</Label>
                <Select
                  value={newLocation.icon_id}
                  onValueChange={(value) => setNewLocation(prev => ({ ...prev, icon_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select an icon" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Default marker</SelectItem>
                    {icons.map((icon) => (
                      <SelectItem key={icon.id} value={icon.id}>
                        {icon.name} ({icon.tag_type})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="locationDescription">Description</Label>
                <Textarea
                  id="locationDescription"
                  value={newLocation.description}
                  onChange={(e) => setNewLocation(prev => ({ ...prev, description: e.target.value }))}
                  placeholder="Optional description"
                />
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Lat: {newLocation.lat.toFixed(4)}</Label>
                </div>
                <div>
                  <Label>Lng: {newLocation.lng.toFixed(4)}</Label>
                </div>
              </div>
              
              <Button onClick={handleSaveLocation} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Save Location
              </Button>
            </>
          ) : selectedLocation && (
            <>
              <div>
                <Label>Name</Label>
                <p className="text-sm font-medium">{selectedLocation.name}</p>
              </div>
              <div>
                <Label>Type</Label>
                <p className="text-sm">{selectedLocation.location_type}</p>
              </div>
              {selectedLocation.description && (
                <div>
                  <Label>Description</Label>
                  <p className="text-sm">{selectedLocation.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label>Lat: {selectedLocation.lat?.toFixed(4) || 'N/A'}</Label>
                </div>
                <div>
                  <Label>Lng: {selectedLocation.lng?.toFixed(4) || 'N/A'}</Label>
                </div>
              </div>
              <Button 
                onClick={() => handleDeleteLocation(selectedLocation.id)}
                variant="destructive" 
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Location
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <header className="bg-gradient-to-r from-slate-800 to-gray-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <Button 
              onClick={onBack}
              variant="outline"
              className="border-slate-200 text-slate-100 hover:bg-slate-700 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Admin Map Editor (Leaflet)</h1>
              <p className="text-slate-100 text-sm">
                Manage your campaign world map with Leaflet
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => {
                setIsAddingLocation(!isAddingLocation);
                setSelectedLocation(null);
              }}
              variant={isAddingLocation ? "destructive" : "default"}
              className={isAddingLocation ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
            >
              {isAddingLocation ? (
                <>Cancel Adding</>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Location
                </>
              )}
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
            <Card className="border-slate-200 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-slate-900 flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  World Map (Leaflet)
                  {isAddingLocation && (
                    <span className="ml-4 text-sm bg-green-100 text-green-800 px-2 py-1 rounded">
                      Click to place new location
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="h-[600px] rounded-lg overflow-hidden border-2 border-slate-200">
                  {renderMap()}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="xl:col-span-1 space-y-6">
            {renderLocationForm()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default AdminMap;
