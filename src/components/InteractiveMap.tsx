
import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, ImageOverlay, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MapPin, Settings } from 'lucide-react';
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

interface InteractiveMapProps {
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
  lat?: number;
  lng?: number;
  icon?: {
    name: string;
    icon_url: string;
    icon_file_path: string | null;
    icon_size_width: number;
    icon_size_height: number;
  };
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

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  const [mapSettings, setMapSettings] = useState<MapSettings | null>(null);
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(null);
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
      
      // Load map settings
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

      // Load locations with icons
      const { data: locationsData, error: locationsError } = await supabase
        .from('map_locations')
        .select(`
          *,
          icon:map_icons(name, icon_url, icon_file_path, icon_size_width, icon_size_height)
        `)
        .order('created_at', { ascending: false });

      if (locationsError) {
        throw locationsError;
      }

      // Convert percentage coordinates to lat/lng
      const convertedLocations = (locationsData || []).map(location => ({
        ...location,
        lat: (50 - location.y_coordinate) * 1.8,
        lng: (location.x_coordinate - 50) * 3.6
      }));

      setLocations(convertedLocations);
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

  const createCustomIcon = (icon: any) => {
    const iconUrl = getImageUrl(icon.icon_file_path, icon.icon_url);
    return L.icon({
      iconUrl: iconUrl || '',
      iconSize: [icon.icon_size_width, icon.icon_size_height],
      iconAnchor: [icon.icon_size_width / 2, icon.icon_size_height],
      popupAnchor: [0, -icon.icon_size_height],
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-amber-700">Loading map...</div>
      </div>
    );
  }

  const currentMapImageUrl = getImageUrl(mapSettings?.map_image_path, mapSettings?.map_image_url);
  const mapBounds = L.latLngBounds([[-85, -180], [85, 180]]);

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
        
        {locations.map((location) => {
          const customIcon = location.icon ? createCustomIcon(location.icon) : undefined;
          
          return (
            <Marker
              key={location.id}
              position={[location.lat as number, location.lng as number]}
              icon={customIcon}
              eventHandlers={{
                click: () => setSelectedLocation(location)
              }}
            >
              <Popup>
                <div className="p-2">
                  <h3 className="font-bold text-amber-900 mb-2">{location.name}</h3>
                  <p className="text-sm text-gray-600 mb-2">Type: {location.location_type}</p>
                  {location.description && (
                    <p className="text-sm text-gray-700">{location.description}</p>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    );
  };

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
                Explore the world of your campaign
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map Area */}
          <div className="lg:col-span-3">
            <Card className="border-amber-200 bg-white shadow-lg">
              <CardContent className="p-0">
                <div className="h-[600px] rounded-lg overflow-hidden border-2 border-amber-200">
                  {renderMap()}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Location List Sidebar */}
          <div className="lg:col-span-1">
            <Card className="border-amber-200 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-amber-900 flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Locations
                </CardTitle>
                <CardDescription>
                  Click on a location to view details
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {locations.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No locations have been added yet
                    </p>
                  ) : (
                    locations.map((location) => {
                      const iconUrl = location.icon ? getImageUrl(location.icon.icon_file_path, location.icon.icon_url) : null;
                      
                      return (
                        <div
                          key={location.id}
                          className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedLocation?.id === location.id 
                              ? 'border-amber-300 bg-amber-50' 
                              : 'border-gray-200 hover:border-amber-200 hover:bg-amber-25'
                          }`}
                          onClick={() => setSelectedLocation(location)}
                        >
                          <div className="flex items-center space-x-2">
                            {iconUrl ? (
                              <img
                                src={iconUrl}
                                alt={location.name}
                                className="flex-shrink-0"
                                style={{
                                  width: '20px',
                                  height: '20px'
                                }}
                              />
                            ) : (
                              <MapPin className="h-4 w-4 text-red-600 flex-shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="font-medium text-amber-900 truncate">{location.name}</p>
                              <p className="text-xs text-gray-600">{location.location_type}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Map Info */}
            <Card className="border-amber-200 bg-white shadow-lg mt-4">
              <CardHeader>
                <CardTitle className="text-amber-900 flex items-center">
                  <Settings className="h-5 w-5 mr-2" />
                  Map Info
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Locations:</span>
                    <span className="font-medium">{locations.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Map Type:</span>
                    <span className="font-medium">Leaflet</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Map Status:</span>
                    <span className="font-medium">
                      {currentMapImageUrl ? 'Custom Image Loaded' : 'OpenStreetMap'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default InteractiveMap;
