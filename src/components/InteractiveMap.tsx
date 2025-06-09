
import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, MapPin } from 'lucide-react';
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

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  const { userRole, user } = useAuth();
  const { toast } = useToast();
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.Marker[]>([]);
  
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

  // Initialize map
  useEffect(() => {
    if (!mapRef.current) return;

    console.log('Initializing map...');
    
    // Clean up existing map
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }

    // Create map with simple configuration
    const map = L.map(mapRef.current, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 2,
      center: [0, 0],
      zoom: -2,
      zoomControl: true,
      attributionControl: false
    });

    console.log('Map created, adding image overlay...');

    // Define bounds for the 8K image (8192x4532)
    const imageWidth = 8192;
    const imageHeight = 4532;
    const imageBounds: L.LatLngBoundsExpression = [
      [0, 0],
      [imageHeight, imageWidth]
    ];
    
    // Add image overlay
    const imageUrl = '/lovable-uploads/9acc5a25-ab15-4432-ad70-c75f01712bca.png';
    const imageOverlay = L.imageOverlay(imageUrl, imageBounds, {
      opacity: 1,
      interactive: false
    });
    
    imageOverlay.addTo(map);
    
    // Set view to show the full map
    map.fitBounds(imageBounds);
    map.setMaxBounds(imageBounds);

    // Add click handler for DM users
    if (isDM) {
      map.on('click', (e: L.LeafletMouseEvent) => {
        handleMapClick(e.latlng.lat, e.latlng.lng);
      });
    }

    mapInstanceRef.current = map;
    
    // Set loading to false after a short delay to allow map to render
    setTimeout(() => {
      console.log('Map initialization complete');
      setIsLoading(false);
    }, 1000);

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [isDM]);

  // Fetch locations on component mount
  useEffect(() => {
    fetchLocations();
  }, []);

  // Update markers when locations change
  useEffect(() => {
    if (!mapInstanceRef.current || !locations.length || isLoading) return;

    console.log('Updating markers, locations count:', locations.length);

    // Clear existing markers
    markersRef.current.forEach(marker => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(marker);
      }
    });
    markersRef.current = [];

    // Add new markers
    locations.forEach(location => {
      const marker = createMarker(location);
      if (marker && mapInstanceRef.current) {
        marker.addTo(mapInstanceRef.current);
        markersRef.current.push(marker);
      }
    });
  }, [locations, isLoading]);

  const createMarker = (location: MapLocation): L.Marker | null => {
    const locationTypeData = LOCATION_TYPES.find(type => type.value === location.location_type);
    const color = locationTypeData?.color || '#A0A0A0';
    
    // Create custom marker icon
    const icon = L.divIcon({
      html: `<div style="
        background-color: ${color}; 
        width: 20px; 
        height: 20px; 
        border-radius: 50%; 
        border: 3px solid white; 
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        display: flex;
        align-items: center;
        justify-content: center;
      "></div>`,
      className: 'custom-marker',
      iconSize: [20, 20],
      iconAnchor: [10, 10],
      popupAnchor: [0, -10]
    });

    const marker = L.marker([location.y_coordinate, location.x_coordinate], { icon });
    
    // Create popup content
    let popupContent = `
      <div style="padding: 10px; min-width: 220px;">
        <h3 style="font-weight: bold; font-size: 18px; margin: 0 0 6px 0; color: #1f2937;">${location.name}</h3>
        <p style="font-size: 13px; color: #6b7280; margin: 0 0 10px 0; text-transform: capitalize;">
          ${locationTypeData?.label || location.location_type}
        </p>
    `;
    
    if (location.description) {
      popupContent += `<p style="font-size: 14px; margin: 0 0 12px 0; color: #374151; line-height: 1.4;">${location.description}</p>`;
    }
    
    if (isDM) {
      popupContent += `
        <div style="display: flex; gap: 8px; margin-top: 12px;">
          <button onclick="window.editLocation('${location.id}')" style="
            background: #3b82f6; 
            color: white; 
            border: none; 
            padding: 6px 12px; 
            border-radius: 4px; 
            font-size: 12px; 
            cursor: pointer;
            font-family: inherit;
          ">
            Edit
          </button>
          <button onclick="window.deleteLocation('${location.id}')" style="
            background: #ef4444; 
            color: white; 
            border: none; 
            padding: 6px 12px; 
            border-radius: 4px; 
            font-size: 12px; 
            cursor: pointer;
            font-family: inherit;
          ">
            Delete
          </button>
        </div>
      `;
    }
    
    popupContent += '</div>';
    
    marker.bindPopup(popupContent, {
      maxWidth: 280,
      className: 'custom-popup'
    });
    
    return marker;
  };

  // Set up global functions for popup buttons
  useEffect(() => {
    (window as any).editLocation = (locationId: string) => {
      const location = locations.find(loc => loc.id === locationId);
      if (location) {
        handleEdit(location);
      }
    };

    (window as any).deleteLocation = (locationId: string) => {
      handleDelete(locationId);
    };

    return () => {
      delete (window as any).editLocation;
      delete (window as any).deleteLocation;
    };
  }, [locations]);

  const fetchLocations = async () => {
    try {
      console.log('Fetching locations...');
      const { data, error } = await supabase
        .from('map_locations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('Fetched locations:', data?.length || 0);
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast({
        title: "Error",
        description: "Failed to load map locations",
        variant: "destructive",
      });
    }
  };

  const handleMapClick = (lat: number, lng: number) => {
    if (!isDM) return;
    
    console.log('Handling map click at:', lat, lng);
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
      setFormData({
        name: '',
        description: '',
        location_type: 'city'
      });
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
    
    console.log('Editing location:', location);
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
    
    if (!confirm('Are you sure you want to delete this location?')) return;

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <div className="text-amber-700 text-lg">Loading map...</div>
          <div className="text-amber-600 text-sm mt-2">Initializing world view...</div>
        </div>
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
                {isDM ? 'Click anywhere on the map to add a location' : 'View campaign locations'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Map Container */}
          <div className="lg:col-span-3">
            <Card className="shadow-lg">
              <CardContent className="p-0">
                <div
                  ref={mapRef}
                  className="h-[600px] w-full rounded-lg bg-gray-200"
                  style={{ minHeight: '600px' }}
                />
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            {/* Legend */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <MapPin className="h-5 w-5 mr-2" />
                  Location Types
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {LOCATION_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center space-x-3">
                      <div
                        className="w-4 h-4 rounded-full border border-gray-300 flex-shrink-0"
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="text-sm font-medium">{type.label}</span>
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
                      <Label htmlFor="name">Name *</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="Enter location name"
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="location_type">Type *</Label>
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

            {/* Info Card */}
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-gray-600">
                  <p className="mb-2">
                    <strong>Locations:</strong> {locations.length}
                  </p>
                  {isDM && (
                    <p className="text-amber-700">
                      Click anywhere on the map to add a new location.
                    </p>
                  )}
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
