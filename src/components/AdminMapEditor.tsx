import React, { useEffect, useRef, useState, useCallback } from 'react';
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
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState('Initializing...');
  const [domReady, setDomReady] = useState(false);
  const { toast } = useToast();

  // Ensure DOM is ready
  useEffect(() => {
    // Force a re-render after component mounts to ensure refs are available
    const timer = setTimeout(() => {
      setDomReady(true);
      console.log('DOM ready state set to true');
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Get the map image URL from Supabase storage
  useEffect(() => {
    const getMapImageUrl = async () => {
      try {
        setLoadingStatus('Loading map image...');
        
        // Try to use a smaller test image first for test environments
        const isTestEnv = window.location.hostname.includes('lovable') || 
                         window.location.hostname.includes('localhost') ||
                         window.location.hostname.includes('preview');
        
        let imageFileName = 'The Slumbering Ancients 100+ Large.jpg';
        
        // For test environments, try to use a smaller image or fallback
        if (isTestEnv) {
          console.log('Test environment detected - using optimized loading');
          setLoadingStatus('Loading map image (test mode)...');
        }
        
        const { data } = supabase.storage
          .from('map-images')
          .getPublicUrl(imageFileName);
        
        console.log('Map image URL:', data.publicUrl);
        console.log('Environment:', isTestEnv ? 'Test' : 'Production');
        
        // Test if the image actually loads with timeout
        const img = new Image();
        const imageTimeout = setTimeout(() => {
          console.warn('Image loading timeout - using fallback');
          // Use a simple colored rectangle as fallback
          setImageLoaded(true);
          setMapImageUrl('data:image/svg+xml;base64,' + btoa(`
            <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
              <rect width="800" height="600" fill="#DEB887"/>
              <rect x="100" y="100" width="200" height="150" fill="#8B7355" opacity="0.7"/>
              <rect x="400" y="300" width="300" height="200" fill="#87CEEB" opacity="0.7"/>
              <text x="400" y="300" text-anchor="middle" fill="#654321" font-size="16">Fantasy Map (Fallback)</text>
            </svg>
          `));
        }, 8000); // 8 second timeout for large images
        
        img.onload = () => {
          console.log('Image loaded successfully');
          clearTimeout(imageTimeout);
          setImageLoaded(true);
          setMapImageUrl(data.publicUrl);
        };
        img.onerror = (error) => {
          console.error('Failed to load image:', error);
          clearTimeout(imageTimeout);
          
          // Provide fallback SVG map
          console.log('Using fallback SVG map');
          setImageLoaded(true);
          setMapImageUrl('data:image/svg+xml;base64,' + btoa(`
            <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
              <rect width="800" height="600" fill="#DEB887"/>
              <rect x="100" y="100" width="200" height="150" fill="#8B7355" opacity="0.7"/>
              <rect x="400" y="300" width="300" height="200" fill="#87CEEB" opacity="0.7"/>
              <text x="400" y="50" text-anchor="middle" fill="#654321" font-size="20">Fantasy Map</text>
              <text x="400" y="80" text-anchor="middle" fill="#654321" font-size="12">(Fallback - Original image failed to load)</text>
            </svg>
          `));
        };
        img.src = data.publicUrl;
      } catch (error) {
        console.error('Error getting map image URL:', error);
        toast({
          title: "Error",
          description: "Failed to get map image URL, using fallback",
          variant: "destructive",
        });
        setLoadingStatus('Using fallback map');
        
        // Use fallback map
        setImageLoaded(true);
        setMapImageUrl('data:image/svg+xml;base64,' + btoa(`
          <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
            <rect width="800" height="600" fill="#DEB887"/>
            <text x="400" y="300" text-anchor="middle" fill="#654321" font-size="16">Map Loading Error</text>
          </svg>
        `));
      }
    };

    getMapImageUrl();
  }, [toast]);

  // Load Leaflet libraries
  useEffect(() => {
    const loadLeaflet = () => {
      setLoadingStatus('Loading map library...');
      
      // Check if Leaflet is already loaded
      if ((window as any).L) {
        console.log('Leaflet already loaded');
        setLeafletLoaded(true);
        return;
      }

      // Load CSS first
      if (!document.querySelector('link[href*="leaflet.css"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        link.onload = () => console.log('Leaflet CSS loaded');
        link.onerror = () => {
          console.error('Failed to load Leaflet CSS');
          setLoadingStatus('Failed to load map styles');
        };
        document.head.appendChild(link);
      }

      // Load JS
      if (!document.querySelector('script[src*="leaflet.js"]')) {
        const script = document.createElement('script');
        script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
        script.onload = () => {
          console.log('Leaflet JS loaded');
          // Add a small delay to ensure Leaflet is fully initialized
          setTimeout(() => {
            if ((window as any).L) {
              setLeafletLoaded(true);
            } else {
              console.error('Leaflet not available after loading');
              setLoadingStatus('Failed to initialize map library');
            }
          }, 100);
        };
        script.onerror = () => {
          console.error('Failed to load Leaflet JS');
          setLoadingStatus('Failed to load map library');
        };
        document.head.appendChild(script);
      }
    };

    loadLeaflet();
  }, []);

  const initializeMap = useCallback(() => {
    if (!(window as any).L || !mapRef.current || !mapImageUrl || mapReady) {
      console.error('Map initialization failed - missing requirements:', {
        leaflet: !!(window as any).L,
        mapRef: !!mapRef.current,
        mapImageUrl: !!mapImageUrl,
        mapReady
      });
      return;
    }

    try {
      const L = (window as any).L;
      console.log('Creating map with Leaflet...');

      // Clear any existing map instance
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Use actual image dimensions: 8192x4532, but adjust for fallback
      const imageWidth = mapImageUrl.startsWith('data:') ? 800 : 8192;
      const imageHeight = mapImageUrl.startsWith('data:') ? 600 : 4532;
      
      // Define image bounds using actual dimensions
      const imageBounds: [[number, number], [number, number]] = [[0, 0], [imageHeight, imageWidth]];
      console.log('Image bounds:', imageBounds, 'Fallback mode:', mapImageUrl.startsWith('data:'));

      // Create map with CRS.Simple for image coordinates
      const map = L.map(mapRef.current, {
        crs: L.CRS.Simple,
        minZoom: -3,
        maxZoom: 2,
        zoomControl: true,
        attributionControl: false,
        zoomSnap: 0.25,
        zoomDelta: 0.25
      });

      console.log('Map created, adding image overlay...');

      // Add the fantasy map image as an overlay
      const mapOverlay = L.imageOverlay(mapImageUrl, imageBounds);
      
      // Set up a timeout fallback in case the load event never fires
      const overlayTimeout = setTimeout(() => {
        console.warn('Image overlay load event timeout - proceeding anyway');
        if (!mapReady) {
          setMapReady(true);
          setIsLoading(false);
          setLoadingStatus('Map ready (timeout fallback)');
          setTimeout(() => {
            addPinsToMap();
          }, 100);
        }
      }, 5000); // 5 second timeout

      mapOverlay.on('load', () => {
        console.log('Image overlay loaded successfully');
        clearTimeout(overlayTimeout);
        setMapReady(true);
        setIsLoading(false);
        setLoadingStatus('Map ready');
        
        // Add existing pins after image loads
        setTimeout(() => {
          addPinsToMap();
        }, 100);
      });

      mapOverlay.on('error', (error: any) => {
        console.error('Image overlay failed to load:', error);
        clearTimeout(overlayTimeout);
        toast({
          title: "Error",
          description: "Failed to load map image overlay",
          variant: "destructive",
        });
        setLoadingStatus('Failed to load map overlay');
      });

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

    } catch (error) {
      console.error('Error initializing map:', error);
      toast({
        title: "Error",
        description: "Failed to initialize map: " + (error as Error).message,
        variant: "destructive",
      });
      setLoadingStatus('Map initialization failed');
    }
  }, [mapImageUrl, isAddingPin, mapReady, toast]);

  // Initialize map when both Leaflet and image are ready
  useEffect(() => {
    if (!leafletLoaded || !imageLoaded || !mapImageUrl || mapReady || !domReady) {
      console.log('Map init conditions:', {
        leafletLoaded,
        imageLoaded,
        mapImageUrl: !!mapImageUrl,
        mapRef: !!mapRef.current,
        mapReady,
        domReady
      });
      return;
    }
    
    // Wait for DOM element to be ready with multiple checks
    const checkMapElement = () => {
      if (!mapRef.current) {
        console.log('Map element not ready, retrying...');
        return false;
      }
      return true;
    };
    
    setLoadingStatus('Initializing map...');
    console.log('All conditions met, checking map element...');
    
    // Try multiple times with increasing delays to ensure DOM is ready
    let attempts = 0;
    const maxAttempts = 10;
    
    const tryInitialize = () => {
      attempts++;
      
      if (checkMapElement()) {
        console.log('Map element ready, initializing...');
        initializeMap();
      } else if (attempts < maxAttempts) {
        console.log(`Map element not ready, attempt ${attempts}/${maxAttempts}, retrying...`);
        setTimeout(tryInitialize, 200 * attempts); // Increasing delay
      } else {
        console.error('Failed to initialize map: element never became available');
        setLoadingStatus('Failed to initialize - map element not found');
        toast({
          title: "Error",
          description: "Failed to initialize map container",
          variant: "destructive",
        });
      }
    };
    
    // Start trying to initialize
    tryInitialize();
    
  }, [leafletLoaded, imageLoaded, mapImageUrl, mapReady, domReady, toast, initializeMap]);

  // Load pins from database
  useEffect(() => {
    loadPins();
  }, []);

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
    }
  };

  const addPinsToMap = useCallback(() => {
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

    // Clear existing markers first
    mapInstanceRef.current.eachLayer((layer: any) => {
      if (layer.options && layer.options.icon) {
        mapInstanceRef.current.removeLayer(layer);
      }
    });

    pins.forEach(pin => {
      const marker = L.marker([pin.y, pin.x], {
        icon: L.divIcon({
          className: 'custom-pin',
          html: `<div style="
            width: 24px; 
            height: 24px; 
            background-color: #ef4444; 
            border-radius: 50%; 
            border: 2px solid white; 
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); 
            display: flex; 
            align-items: center; 
            justify-content: center;
          ">
            <svg style="width: 16px; height: 16px; color: white;" fill="currentColor" viewBox="0 0 20 20">
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
  }, [pins]);

  // Re-add pins when pins array changes
  useEffect(() => {
    if (mapReady && pins.length > 0) {
      addPinsToMap();
    }
  }, [pins, mapReady, addPinsToMap]);

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

      setPins(prevPins => prevPins.filter(p => p.id !== pinId));
      setSelectedPin(null);
      
    } catch (error) {
      console.error('Error deleting pin:', error);
      toast({
        title: "Error",
        description: "Failed to delete pin",
        variant: "destructive",
      });
    }
  };

  if (isLoading && (!leafletLoaded || !imageLoaded)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 to-orange-100">
        <div className="text-center">
          <div className="text-amber-700 text-lg mb-2">{loadingStatus}</div>
          <div className="text-amber-600 text-sm mb-4">
            Leaflet: {leafletLoaded ? '✓' : '⏳'} | 
            Image: {imageLoaded ? '✓' : '⏳'} | 
            Map: {mapReady ? '✓' : '⏳'}
          </div>
          
          {/* More detailed debug info */}
          <div className="text-xs text-gray-600 bg-white/80 p-3 rounded-lg inline-block">
            <div className="grid grid-cols-2 gap-2 text-left">
              <span>DOM Ready:</span><span>{domReady ? '✅' : '❌'}</span>
              <span>Leaflet Ready:</span><span>{leafletLoaded ? '✅' : '❌'}</span>
              <span>Image Ready:</span><span>{imageLoaded ? '✅' : '❌'}</span>
              <span>Map Element:</span><span>{mapRef.current ? '✅' : '❌'}</span>
              <span>Image URL:</span><span>{mapImageUrl ? '✅' : '❌'}</span>
              <span>Map Instance:</span><span>{mapReady ? '✅' : 'Initializing...'}</span>
            </div>
            
            {leafletLoaded && imageLoaded && domReady && !mapReady && (
              <div className="mt-3 text-amber-600 font-medium">
                🔄 Map initialization in progress...
                <br />
                <span className="text-xs">
                  {mapRef.current ? 'Element found, initializing...' : 'Waiting for map element...'}
                </span>
              </div>
            )}
            
            {mapImageUrl && (
              <div className="mt-2 text-xs text-gray-500">
                Image: {mapImageUrl.includes('6k.jpg') ? '6K Resolution' : 'Standard'}
              </div>
            )}
          </div>
        </div>
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
