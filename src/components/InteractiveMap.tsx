
import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, useMap } from 'react-leaflet';
import { Icon, LatLng } from 'leaflet';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, Edit, Trash2, Eye, EyeOff, ZoomIn, ZoomOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React Leaflet
delete (Icon.Default.prototype as any)._getIconUrl;
Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapMarker {
  id: string;
  name: string;
  x: number;
  y: number;
  layer: string;
  created_at?: string;
}

interface InteractiveMapProps {
  onBack: () => void;
}

const markerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  layer: z.string().min(1, 'Layer is required'),
});

const layers = ['Political', 'Geographic', 'Cities', 'Dungeons', 'Points of Interest'];

// Custom marker colors for different layers
const getMarkerIcon = (layer: string) => {
  const colors = {
    'Political': '#ef4444',
    'Geographic': '#22c55e',
    'Cities': '#3b82f6',
    'Dungeons': '#a855f7',
    'Points of Interest': '#eab308'
  };
  
  const color = colors[layer as keyof typeof colors] || '#6b7280';
  
  return new Icon({
    iconUrl: `data:image/svg+xml;base64,${btoa(`
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24">
        <path fill="${color}" stroke="#ffffff" stroke-width="2" d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
      </svg>
    `)}`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

// Component for handling map clicks
const MapClickHandler: React.FC<{
  isAddingMarker: boolean;
  onMapClick: (latlng: LatLng) => void;
}> = ({ isAddingMarker, onMapClick }) => {
  useMapEvents({
    click: (e) => {
      if (isAddingMarker) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
};

// Component for zoom controls
const ZoomControls: React.FC = () => {
  const map = useMap();
  
  return (
    <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
      <Button
        size="sm"
        variant="outline"
        className="bg-white shadow-lg"
        onClick={() => map.zoomIn()}
      >
        <ZoomIn className="h-4 w-4" />
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="bg-white shadow-lg"
        onClick={() => map.zoomOut()}
      >
        <ZoomOut className="h-4 w-4" />
      </Button>
    </div>
  );
};

// Calculate distance between two points (in meters)
const calculateDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
};

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  const { userRole } = useAuth();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(layers));
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [selectedMarkers, setSelectedMarkers] = useState<MapMarker[]>([]);
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMarker, setEditingMarker] = useState<MapMarker | null>(null);

  const form = useForm<z.infer<typeof markerSchema>>({
    resolver: zodResolver(markerSchema),
    defaultValues: {
      name: '',
      layer: layers[0],
    },
  });

  // Map bounds (you can adjust these based on your world map)
  const mapBounds: [[number, number], [number, number]] = [[-85, -180], [85, 180]];

  useEffect(() => {
    fetchMarkers();
  }, []);

  const fetchMarkers = async () => {
    try {
      const { data, error } = await supabase
        .from('map_markers')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setMarkers(data || []);
    } catch (error) {
      console.error('Error fetching markers:', error);
      toast.error('Failed to load markers');
    }
  };

  // Convert percentage coordinates to lat/lng
  const percentToLatLng = (x: number, y: number): [number, number] => {
    const lat = 85 - (y / 100) * 170; // Map y percentage to latitude range
    const lng = -180 + (x / 100) * 360; // Map x percentage to longitude range
    return [lat, lng];
  };

  // Convert lat/lng to percentage coordinates
  const latLngToPercent = (lat: number, lng: number): { x: number; y: number } => {
    const x = ((lng + 180) / 360) * 100;
    const y = ((85 - lat) / 170) * 100;
    return { x, y };
  };

  const handleMapClick = (latlng: LatLng) => {
    if (!isAddingMarker || userRole !== 'dm') return;

    setPendingPosition({ lat: latlng.lat, lng: latlng.lng });
    setIsDialogOpen(true);
    setIsAddingMarker(false);
  };

  const onSubmit = async (values: z.infer<typeof markerSchema>) => {
    if (!pendingPosition && !editingMarker) return;

    try {
      if (editingMarker) {
        // Update existing marker
        const { error } = await supabase
          .from('map_markers')
          .update({
            name: values.name,
            layer: values.layer,
          })
          .eq('id', editingMarker.id);

        if (error) throw error;
        toast.success('Marker updated successfully');
      } else if (pendingPosition) {
        // Create new marker - convert lat/lng back to percentage for storage
        const { x, y } = latLngToPercent(pendingPosition.lat, pendingPosition.lng);
        const { error } = await supabase
          .from('map_markers')
          .insert({
            name: values.name,
            x,
            y,
            layer: values.layer,
          });

        if (error) throw error;
        toast.success('Marker added successfully');
      }

      await fetchMarkers();
      setIsDialogOpen(false);
      setPendingPosition(null);
      setEditingMarker(null);
      form.reset();
    } catch (error) {
      console.error('Error saving marker:', error);
      toast.error('Failed to save marker');
    }
  };

  const handleEditMarker = (marker: MapMarker) => {
    setEditingMarker(marker);
    form.setValue('name', marker.name);
    form.setValue('layer', marker.layer);
    setIsDialogOpen(true);
  };

  const handleDeleteMarker = async (markerId: string) => {
    if (!confirm('Are you sure you want to delete this marker?')) return;

    try {
      const { error } = await supabase
        .from('map_markers')
        .delete()
        .eq('id', markerId);

      if (error) throw error;
      toast.success('Marker deleted successfully');
      await fetchMarkers();
    } catch (error) {
      console.error('Error deleting marker:', error);
      toast.error('Failed to delete marker');
    }
  };

  const toggleLayer = (layer: string) => {
    const newVisibleLayers = new Set(visibleLayers);
    if (newVisibleLayers.has(layer)) {
      newVisibleLayers.delete(layer);
    } else {
      newVisibleLayers.add(layer);
    }
    setVisibleLayers(newVisibleLayers);
  };

  const toggleMarkerSelection = (marker: MapMarker) => {
    setSelectedMarkers(prev => {
      const isSelected = prev.some(m => m.id === marker.id);
      if (isSelected) {
        return prev.filter(m => m.id !== marker.id);
      } else {
        return [...prev, marker];
      }
    });
  };

  const filteredMarkers = markers.filter(marker => visibleLayers.has(marker.layer));

  // Calculate distance between selected markers
  const getDistanceBetweenSelected = (): string | null => {
    if (selectedMarkers.length !== 2) return null;
    
    const [marker1, marker2] = selectedMarkers;
    const [lat1, lng1] = percentToLatLng(marker1.x, marker1.y);
    const [lat2, lng2] = percentToLatLng(marker2.x, marker2.y);
    
    const distance = calculateDistance(lat1, lng1, lat2, lng2);
    
    // Convert to appropriate units (assuming 1 meter = 1 mile for fantasy scale)
    if (distance < 1000) {
      return `${Math.round(distance)} meters`;
    } else {
      return `${(distance / 1000).toFixed(1)} km`;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-100 relative overflow-hidden">
      {/* Parchment texture overlay */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3Csvg%20width%3D%2260%22%20height%3D%2260%22%20viewBox%3D%220%200%2060%2060%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cg%20fill%3D%22none%22%20fill-rule%3D%22evenodd%22%3E%3Cg%20fill%3D%22%23D4A574%22%20fill-opacity%3D%220.08%22%3E%3Ccircle%20cx%3D%2230%22%20cy%3D%2230%22%20r%3D%222%22/%3E%3C/g%3E%3C/g%3E%3C/svg%3E')] opacity-70"></div>

      <header className="relative z-10 bg-gradient-to-r from-amber-800 to-orange-800 text-white shadow-lg">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center">
            <Button
              onClick={onBack}
              variant="outline"
              className="border-amber-200 text-amber-100 hover:bg-amber-700 hover:text-white mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <h1 className="text-2xl font-bold">Interactive Campaign Map</h1>
          </div>
          {userRole === 'dm' && (
            <Button
              onClick={() => setIsAddingMarker(!isAddingMarker)}
              className={`${
                isAddingMarker 
                  ? 'bg-red-600 hover:bg-red-700' 
                  : 'bg-green-600 hover:bg-green-700'
              } text-white`}
            >
              <Plus className="h-4 w-4 mr-2" />
              {isAddingMarker ? 'Cancel Adding' : 'Add Marker'}
            </Button>
          )}
        </div>
      </header>

      <main className="relative z-10 container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Layer Controls */}
          <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg">
            <CardHeader>
              <CardTitle className="text-amber-900">Map Layers</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {layers.map((layer) => (
                  <div key={layer} className="flex items-center space-x-2">
                    <Checkbox
                      id={layer}
                      checked={visibleLayers.has(layer)}
                      onCheckedChange={() => toggleLayer(layer)}
                    />
                    <Label htmlFor={layer} className="text-sm font-medium">
                      {layer}
                    </Label>
                    {visibleLayers.has(layer) ? (
                      <Eye className="h-4 w-4 text-green-600" />
                    ) : (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                ))}
              </div>
              
              <div className="mt-6 pt-4 border-t border-amber-200">
                <h4 className="font-medium text-amber-900 mb-2">Statistics</h4>
                <p className="text-sm text-amber-700">
                  Total Markers: {markers.length}
                </p>
                <p className="text-sm text-amber-700">
                  Visible: {filteredMarkers.length}
                </p>
                {selectedMarkers.length > 0 && (
                  <div className="mt-2 pt-2 border-t border-amber-200">
                    <p className="text-sm text-amber-700">
                      Selected: {selectedMarkers.length}
                    </p>
                    {selectedMarkers.length === 2 && (
                      <p className="text-sm text-green-700 font-medium">
                        Distance: {getDistanceBetweenSelected()}
                      </p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-1 text-xs"
                      onClick={() => setSelectedMarkers([])}
                    >
                      Clear Selection
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Map Area */}
          <div className="lg:col-span-3">
            <Card className="bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg">
              <CardHeader>
                <CardTitle className="text-amber-900">
                  Campaign World Map
                  {isAddingMarker && (
                    <span className="text-sm font-normal text-green-600 ml-2">
                      (Click anywhere to add a marker)
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="relative w-full h-96 bg-amber-50 border-2 border-amber-300 rounded-lg overflow-hidden">
                  <MapContainer
                    center={[0, 0]}
                    zoom={2}
                    style={{ height: '100%', width: '100%' }}
                    maxBounds={mapBounds}
                    maxBoundsViscosity={1.0}
                    crs={L.CRS.Simple}
                  >
                    <TileLayer
                      url="/lovable-uploads/9e267bab-8bfd-4003-b5f3-8a4ffe43aea5.png"
                      attribution="Campaign Map"
                      noWrap={true}
                    />
                    
                    <MapClickHandler 
                      isAddingMarker={isAddingMarker} 
                      onMapClick={handleMapClick} 
                    />
                    
                    <ZoomControls />

                    {filteredMarkers.map((marker) => {
                      const [lat, lng] = percentToLatLng(marker.x, marker.y);
                      const isSelected = selectedMarkers.some(m => m.id === marker.id);
                      
                      return (
                        <Marker
                          key={marker.id}
                          position={[lat, lng]}
                          icon={getMarkerIcon(marker.layer)}
                          eventHandlers={{
                            click: () => {
                              setSelectedMarker(marker);
                              toggleMarkerSelection(marker);
                            },
                          }}
                        >
                          <Popup>
                            <div className="p-2">
                              <h3 className="font-bold text-amber-900">{marker.name}</h3>
                              <p className="text-sm text-amber-700">Layer: {marker.layer}</p>
                              <p className="text-xs text-amber-600">
                                Position: {marker.x.toFixed(1)}%, {marker.y.toFixed(1)}%
                              </p>
                              {userRole === 'dm' && (
                                <div className="flex gap-2 mt-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleEditMarker(marker)}
                                  >
                                    <Edit className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-red-600 hover:text-red-700"
                                    onClick={() => handleDeleteMarker(marker.id)}
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                  </MapContainer>
                </div>
              </CardContent>
            </Card>

            {/* Selected Marker Info */}
            {selectedMarker && (
              <Card className="mt-4 bg-white/90 backdrop-blur-sm border-amber-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="text-amber-900">Marker Details</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-amber-700">Name</Label>
                      <p className="text-amber-900">{selectedMarker.name}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-amber-700">Layer</Label>
                      <p className="text-amber-900">{selectedMarker.layer}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-amber-700">Position</Label>
                      <p className="text-amber-900">
                        X: {selectedMarker.x.toFixed(1)}%, Y: {selectedMarker.y.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={() => setSelectedMarker(null)}
                    className="mt-4 bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    Close Details
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>

      {/* Add/Edit Marker Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle>
              {editingMarker ? 'Edit Marker' : 'Add New Marker'}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Marker Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Enter marker name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="layer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Layer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a layer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {layers.map((layer) => (
                          <SelectItem key={layer} value={layer}>
                            {layer}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <div className="flex justify-end space-x-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    setPendingPosition(null);
                    setEditingMarker(null);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" className="bg-amber-600 hover:bg-amber-700 text-white">
                  {editingMarker ? 'Update Marker' : 'Add Marker'}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default InteractiveMap;
