
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MapPin, Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
  icon?: {
    name: string;
    icon_url: string;
    icon_size_width: number;
    icon_size_height: number;
  };
}

interface MapSettings {
  id: string;
  map_image_url: string | null;
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
  const [zoom, setZoom] = useState(2);
  const [mapCenter, setMapCenter] = useState({ x: 50, y: 50 });
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    loadMapData();
  }, []);

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
        setZoom(settings.default_zoom || 2);
        setMapCenter({ 
          x: settings.center_lng || 50, 
          y: settings.center_lat || 50 
        });
      }

      // Load locations with icons
      const { data: locationsData, error: locationsError } = await supabase
        .from('map_locations')
        .select(`
          *,
          icon:map_icons(name, icon_url, icon_size_width, icon_size_height)
        `)
        .order('created_at', { ascending: false });

      if (locationsError) {
        throw locationsError;
      }

      setLocations(locationsData || []);
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

  const handleLocationClick = (location: MapLocation) => {
    setSelectedLocation(location);
  };

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    
    console.log(`Clicked at: ${x.toFixed(2)}%, ${y.toFixed(2)}%`);
    setSelectedLocation(null);
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
                Explore the world of your campaign
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setZoom(Math.max(mapSettings?.min_zoom || 1, zoom - 1))}
              variant="outline"
              className="border-amber-200 text-amber-100 hover:bg-amber-700"
              disabled={zoom <= (mapSettings?.min_zoom || 1)}
            >
              -
            </Button>
            <span className="text-amber-100 px-3">Zoom: {zoom}</span>
            <Button
              onClick={() => setZoom(Math.min(mapSettings?.max_zoom || 18, zoom + 1))}
              variant="outline"
              className="border-amber-200 text-amber-100 hover:bg-amber-700"
              disabled={zoom >= (mapSettings?.max_zoom || 18)}
            >
              +
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map Area */}
          <div className="lg:col-span-3">
            <Card className="border-amber-200 bg-white shadow-lg">
              <CardContent className="p-0">
                <div 
                  className="relative w-full h-[600px] bg-gradient-to-br from-blue-100 to-green-100 cursor-crosshair overflow-hidden border-2 border-amber-200 rounded-lg"
                  onClick={handleMapClick}
                  style={{
                    backgroundImage: mapSettings?.map_image_url ? `url(${mapSettings.map_image_url})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat'
                  }}
                >
                  {!mapSettings?.map_image_url && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center text-gray-500">
                        <MapPin className="h-16 w-16 mx-auto mb-4 opacity-50" />
                        <p className="text-lg font-medium">No Map Uploaded</p>
                        <p className="text-sm">Ask your DM to upload a map image</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Render locations as markers */}
                  {locations.map((location) => (
                    <div
                      key={location.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer hover:scale-110 transition-transform"
                      style={{
                        left: `${location.x_coordinate}%`,
                        top: `${location.y_coordinate}%`,
                        zIndex: selectedLocation?.id === location.id ? 20 : 10
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLocationClick(location);
                      }}
                    >
                      {location.icon ? (
                        <img
                          src={location.icon.icon_url}
                          alt={location.name}
                          className="drop-shadow-lg"
                          style={{
                            width: `${location.icon.icon_size_width}px`,
                            height: `${location.icon.icon_size_height}px`
                          }}
                        />
                      ) : (
                        <MapPin 
                          className="h-6 w-6 text-red-600 drop-shadow-lg" 
                          fill="currentColor"
                        />
                      )}
                      
                      {/* Location label */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {location.name}
                      </div>
                    </div>
                  ))}
                  
                  {/* Selected location popup */}
                  {selectedLocation && (
                    <div
                      className="absolute bg-white border-2 border-amber-300 rounded-lg shadow-xl p-4 max-w-xs z-30"
                      style={{
                        left: `${Math.min(selectedLocation.x_coordinate + 2, 85)}%`,
                        top: `${Math.max(selectedLocation.y_coordinate - 5, 5)}%`
                      }}
                    >
                      <h3 className="font-bold text-amber-900 mb-2">{selectedLocation.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">Type: {selectedLocation.location_type}</p>
                      {selectedLocation.description && (
                        <p className="text-sm text-gray-700">{selectedLocation.description}</p>
                      )}
                      <Button
                        onClick={() => setSelectedLocation(null)}
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                      >
                        Close
                      </Button>
                    </div>
                  )}
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
                    locations.map((location) => (
                      <div
                        key={location.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedLocation?.id === location.id 
                            ? 'border-amber-300 bg-amber-50' 
                            : 'border-gray-200 hover:border-amber-200 hover:bg-amber-25'
                        }`}
                        onClick={() => handleLocationClick(location)}
                      >
                        <div className="flex items-center space-x-2">
                          {location.icon ? (
                            <img
                              src={location.icon.icon_url}
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
                    ))
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
                    <span className="text-gray-600">Current Zoom:</span>
                    <span className="font-medium">{zoom}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Map Status:</span>
                    <span className="font-medium">
                      {mapSettings?.map_image_url ? 'Loaded' : 'No Image'}
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
