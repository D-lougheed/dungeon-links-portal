import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Types for our pin data
interface MapPinData {
  id: string;
  x: number;
  y: number;
  title: string;
  description: string;
  created_at: string;
  user_id: string | null;
}

interface AdminMapEditorProps {
  onBack: () => void;
}

const AdminMapEditor: React.FC<AdminMapEditorProps> = ({ onBack }) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [pins, setPins] = useState<MapPinData[]>([]);
  const [selectedPin, setSelectedPin] = useState<MapPinData | null>(null);
  const [isAddingPin, setIsAddingPin] = useState(false);
  const [newPin, setNewPin] = useState({ title: '', description: '' });
  const [pendingLocation, setPendingLocation] = useState<{ x: number; y: number } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mapImageUrl, setMapImageUrl] = useState<string>('');
  const [mapInitialized, setMapInitialized] = useState(false);
  const { toast } = useToast();

  // Get the map image URL from Supabase storage
  useEffect(() => {
    const getMapImageUrl = () => {
      const { data } = supabase.storage
        .from('map-images')
        .getPublicUrl('The Slumbering Ancients 100+ Large.jpg');
      
      console.log('Map image URL:', data.publicUrl);
      setMapImageUrl(data.publicUrl);
    };

    getMapImageUrl();
  }, []);

  // Load Leaflet libraries
  useEffect(() => {
    const loadLeaflet = () => {
      // Check if Leaflet is already loaded
      if ((window as any).L) {
        console.log('Leaflet already loaded');
        return Promise.resolve();
      }

      return new Promise<void>((resolve, reject) => {
        // Load CSS first
        if (!document.querySelector('link[href*="leaflet.css"]')) {
          const link = document.createElement('link');
          link.rel = 'stylesheet';
          link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
          link.onload = () => console.log('Leaflet CSS loaded');
          link.onerror = () => console.error('Failed to load Leaflet CSS');
          document.head.appendChild(link);
        }

        // Load JS
        if (!document.querySelector('script[src*="leaflet.js"]')) {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => {
            console.log('Leaflet JS loaded');
            resolve();
          };
          script.onerror = () => {
            console.error('Failed to load Leaflet JS');
            reject(new Error('Failed to load Leaflet'));
          };
          document.head.appendChild(script);
        } else if ((window as any).L) {
          resolve();
        }
      });
    };

    loadLeaflet().catch(error => {
      console.error('Error loading Leaflet:', error);
      toast({
        title: "Error",
        description: "Failed to load map library",
        variant: "destructive",
      });
    });
  }, []);

  // Initialize map when both Leaflet and image URL are ready
  useEffect(() => {
    if (!mapRef.current || !mapImageUrl || mapInitialized) return;
    
    // Wait a bit for Leaflet to be fully loaded
    const initTimer = setTimeout(() => {
      if ((window as any).L) {
        console.log('Initializing map with image URL:', mapImageUrl);
        initializeMap();
        setMapInitialized(true);
      } else {
        console.error('Leaflet not available for map initialization');
      }
    }, 500);

    return () => clearTimeout(initTimer);
  }, [mapImageUrl, mapInitialized]);

  // Load pins from database
  useEffect(() => {
    loadPins();
  }, []);

  const initializeMap = () => {
    if (!(window as any).L || !mapRef.current || !mapImageUrl) {
      console.error('Map initialization failed - missing requirements:', {
        leaflet: !!(window as any).L,
        mapRef: !!mapRef.current,
        mapImageUrl: !!mapImageUrl
      });
      return;
    }

    try {
      const L = (window as any).L;
      console.log('Creating map with L:', L);

      // Use actual image dimensions: 8192x4532
      const imageWidth = 8192;
      const imageHeight = 4532;
      
      // Define image bounds using actual dimensions
      const imageBounds: [[number, number], [number, number]] = [[0, 0], [imageHeight, imageWidth]];
      console.log('Image bounds:', imageBounds);

      // Create map with CRS.Simple for image coordinates
      const map = L.map(mapRef.current, {
        crs: L.CRS.Simple,
        minZoom: -3,
        maxZoom: 2,
        zoomControl: true,
        attributionControl: false
      });

      console.log('Map created, adding image overlay...');

      // Add the fantasy map image as an overlay
      const mapOverlay = L.imageOverlay(mapImageUrl, imageBounds);
      mapOverlay.addTo(map);

      console.log('Image overlay added, fitting bounds...');

      // Set view to show entire map
      map.fitBounds(imageBounds);

      // Add click handler for adding pins
      map.on('click', (e: any) => {
        if (isAddingPin) {
          const { lat, lng } = e.latlng;
          console.log('Pin location clicked:', { x: lng, y: lat });
          setPendingLocation({ x: lng, y: lat });
        }
      });

      mapInstanceRef.current = map;
      console.log('Map initialization complete');
      
      // Add existing pins to map after a short delay
      setTimeout(() => {
        addPinsToMap();
      }, 100);

    } catch (error) {
      console.error('Error initializing map:', error);
      toast({
        title: "Error",
        description: "Failed to initialize map",
        variant: "destructive",
      });
    }
  };

  const loadPins = async () => {
    try {
      const { data, error } = await supabase
        .from('map_pins')
        .select('*')
        .order('created_at', { ascending: true });

      if (error) throw error;
      console.log('Loaded pins:', data);
      setPins(data || []);
    } catch (error) {
      console.error('Error loading pins:', error);
      toast({
        title: "Error",
        description: "Failed to load map pins",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addPinsToMap = () => {
    if (!mapInstanceRef.current || !(window as any).L || pins.length === 0) {
      console.log('Cannot add pins to map:', {
        mapInstance: !!mapInstanceRef.current,
        leaflet: !!(window as any).L,
        pinsCount: pins.length
      });
      return;
    }

    const L = (window as any).L;
    console.log('Adding pins to map:', pins.length);

    pins.forEach(pin => {
      const marker = L.marker([pin.y, pin.x], {
        icon: L.divIcon({
          className: 'custom-pin',
          html: `<div class="w-6 h-6 bg-red-500 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                   <svg class="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                     <path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/>
                   </svg>
                 </div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        })
      }).addTo(mapInstanceRef.current);

      marker.on('click', () => {
        setSelectedPin(pin);
      });
    });
  };

  const savePin = async () => {
    if (!pendingLocation || !newPin.title.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('map_pins')
        .insert({
          x: pendingLocation.x,
          y: pendingLocation.y,
          title: newPin.title,
          description: newPin.description || null,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Pin added successfully",
      });

      setNewPin({ title: '', description: '' });
      setPendingLocation(null);
      setIsAddingPin(false);
      await loadPins();
      
      // Refresh map pins
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.eachLayer((layer: any) => {
            if (layer.options && layer.options.icon) {
              mapInstanceRef.current.removeLayer(layer);
            }
          });
          addPinsToMap();
        }
      }, 100);
    } catch (error) {
      console.error('Error saving pin:', error);
      toast({
        title: "Error",
        description: "Failed to save pin",
        variant: "destructive",
      });
    }
  };

  const deletePin = async (pinId: string) => {
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

      setPins(pins.filter(p => p.id !== pinId));
      setSelectedPin(null);
      
      // Refresh map
      setTimeout(() => {
        if (mapInstanceRef.current) {
          mapInstanceRef.current.eachLayer((layer: any) => {
            if (layer.options && layer.options.icon) {
              mapInstanceRef.current.removeLayer(layer);
            }
          });
          addPinsToMap();
        }
      }, 100);
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

        <div className="w-full h-[calc(100vh-200px)] flex bg-gray-50 rounded-lg overflow-hidden shadow-lg">
          {/* Map Container */}
          <div className="flex-1 relative">
            <div ref={mapRef} className="w-full h-full bg-gray-200" />
            
            {/* Debug info */}
            {!mapInitialized && (
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-white p-4 rounded-lg shadow-lg">
                <p className="text-sm text-gray-600">Initializing map...</p>
                <p className="text-xs text-gray-400">Image URL: {mapImageUrl ? 'Loaded' : 'Loading...'}</p>
                <p className="text-xs text-gray-400">Leaflet: {(window as any).L ? 'Ready' : 'Loading...'}</p>
              </div>
            )}
            
            {/* Map Controls */}
            <div className="absolute top-4 left-4 z-[1000]">
              <Button
                onClick={() => setIsAddingPin(!isAddingPin)}
                className={`${
                  isAddingPin 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                <Plus className="w-4 h-4 mr-2" />
                {isAddingPin ? 'Cancel Adding' : 'Add Pin'}
              </Button>
            </div>

            {/* Instructions */}
            {isAddingPin && (
              <div className="absolute top-16 left-4 z-[1000] bg-white p-4 rounded-lg shadow-lg border max-w-sm">
                <p className="text-sm text-gray-600 mb-2">Click anywhere on the map to place a pin</p>
                {pendingLocation && (
                  <p className="text-xs text-green-600">📍 Pin location selected! Fill out the form to save.</p>
                )}
              </div>
            )}
          </div>

          <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto">
            {/* Add Pin Form */}
            {isAddingPin && pendingLocation && (
              <Card className="m-4">
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Add New Pin
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                    <input
                      type="text"
                      value={newPin.title}
                      onChange={(e) => setNewPin({ ...newPin, title: e.target.value })}
                      placeholder="Enter pin title..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={newPin.description}
                      onChange={(e) => setNewPin({ ...newPin, description: e.target.value })}
                      placeholder="Enter description..."
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={savePin}
                      disabled={!newPin.title.trim()}
                      className="flex-1 bg-green-600 hover:bg-green-700"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Pin
                    </Button>
                    <Button
                      onClick={() => {
                        setPendingLocation(null);
                        setNewPin({ title: '', description: '' });
                        setIsAddingPin(false);
                      }}
                      variant="outline"
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected Pin Details */}
            {selectedPin && (
              <Card className="m-4">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center">
                      <MapPin className="w-5 h-5 mr-2" />
                      Pin Details
                    </CardTitle>
                    <Button
                      onClick={() => deletePin(selectedPin.id)}
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <h4 className="font-semibold text-lg mb-2">{selectedPin.title}</h4>
                  {selectedPin.description && (
                    <p className="text-gray-600 mb-3">{selectedPin.description}</p>
                  )}
                  <div className="text-xs text-gray-400 mb-3">
                    <p>Coordinates: ({selectedPin.x.toFixed(2)}, {selectedPin.y.toFixed(2)})</p>
                    <p>Created: {new Date(selectedPin.created_at).toLocaleDateString()}</p>
                  </div>
                  <Button
                    onClick={() => setSelectedPin(null)}
                    variant="outline"
                    className="w-full"
                  >
                    Close
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Pins List */}
            <div className="p-4">
              <h2 className="font-semibold text-lg mb-3">All Pins ({pins.length})</h2>
              <div className="space-y-2">
                {pins.length === 0 ? (
                  <p className="text-gray-500 text-sm italic">No pins added yet. Click "Add Pin" to get started!</p>
                ) : (
                  pins.map(pin => (
                    <div
                      key={pin.id}
                      className="p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => setSelectedPin(pin)}
                    >
                      <h4 className="font-medium">{pin.title}</h4>
                      {pin.description && (
                        <p className="text-sm text-gray-600 mt-1 line-clamp-2">{pin.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-2">
                        {new Date(pin.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMapEditor;
