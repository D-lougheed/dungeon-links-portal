import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Eye, Square } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import MapSelector from './map/MapSelector';
import MapAreasCanvas from './map/MapAreasCanvas';
import MapAreasManager from './map/MapAreasManager';
import { Map, MapArea, Point } from './map/types';

interface MapAreasManagementProps {
  onBack: () => void;
}

const MapAreasManagement: React.FC<MapAreasManagementProps> = ({ onBack }) => {
  const { user, userRole } = useAuth();
  const { toast } = useToast();
  
  const [maps, setMaps] = useState<Map[]>([]);
  const [selectedMap, setSelectedMap] = useState<Map | null>(null);
  const [mapAreas, setMapAreas] = useState<MapArea[]>([]);
  const [activeMode, setActiveMode] = useState<'view' | 'area'>('view');
  const [isLoading, setIsLoading] = useState(true);
  
  // New state for region types and visibility
  const [regionTypes, setRegionTypes] = useState<{ id: string; name: string; color: string; is_active: boolean }[]>([]);
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set());

  // Load maps on component mount
  useEffect(() => {
    loadMaps();
  }, []);

  // Load data when map is selected
  useEffect(() => {
    if (selectedMap) {
      loadMapAreas();
      loadRegionTypes();
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

  const loadMapAreas = async () => {
    if (!selectedMap) return;

    try {
      const { data, error } = await supabase
        .from('map_areas')
        .select('*')
        .eq('map_id', selectedMap.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data to match our MapArea interface
      const transformedData: MapArea[] = (data || []).map(area => {
        // Handle polygon_coordinates by casting to any first to bypass TypeScript limitations
        const areaWithPolygon = area as any;
        let polygonCoordinates: Point[] | null = null;
        
        if (areaWithPolygon.polygon_coordinates) {
          if (Array.isArray(areaWithPolygon.polygon_coordinates)) {
            polygonCoordinates = areaWithPolygon.polygon_coordinates.filter((point): point is Point => 
              point && typeof point === 'object' && 
              typeof point.x === 'number' && typeof point.y === 'number'
            );
          }
        }

        return {
          ...area,
          terrain_features: Array.isArray(area.terrain_features) 
            ? area.terrain_features.filter((item): item is string => typeof item === 'string')
            : [],
          landmarks: Array.isArray(area.landmarks) 
            ? area.landmarks.filter((item): item is string => typeof item === 'string')
            : [],
          bounding_box: area.bounding_box && typeof area.bounding_box === 'object' && 
            'x1' in area.bounding_box && 'y1' in area.bounding_box && 
            'x2' in area.bounding_box && 'y2' in area.bounding_box
            ? area.bounding_box as { x1: number; y1: number; x2: number; y2: number }
            : null,
          polygon_coordinates: polygonCoordinates,
          // is_visible is now included from the database query, so we don't need to set a default
        };
      });
      
      setMapAreas(transformedData);
    } catch (error) {
      console.error('Error loading map areas:', error);
      toast({
        title: "Error",
        description: "Failed to load map areas",
        variant: "destructive",
      });
    }
  };

  // Load custom region types (for now, we'll store them in local state)
  const loadRegionTypes = () => {
    // For now, we'll use local storage to persist custom types
    // In a real app, you'd want to store these in the database
    const storedTypes = localStorage.getItem(`regionTypes_${selectedMap?.id}`);
    if (storedTypes) {
      try {
        setRegionTypes(JSON.parse(storedTypes));
      } catch (error) {
        console.error('Error parsing stored region types:', error);
        setRegionTypes([]);
      }
    } else {
      setRegionTypes([]);
    }
  };

  // Save region types to local storage
  const saveRegionTypes = (types: typeof regionTypes) => {
    if (selectedMap) {
      localStorage.setItem(`regionTypes_${selectedMap.id}`, JSON.stringify(types));
    }
  };

  // Get color for area type (including custom types)
  const getAreaColor = (areaType: string) => {
    // Check custom types first
    const customType = regionTypes.find(type => type.name === areaType && type.is_active);
    if (customType) {
      return customType.color;
    }

    // Default colors
    const colors: { [key: string]: string } = {
      'terrain': '#22c55e',
      'landmark': '#3b82f6',
      'region': '#f59e0b',
      'settlement': '#8b5cf6',
      'water': '#06b6d4',
      'forest': '#16a34a',
      'mountain': '#78716c',
      'desert': '#eab308',
      'default': '#ef4444'
    };
    return colors[areaType] || colors.default;
  };

  // Handle adding custom region type
  const handleAddRegionType = (name: string, color: string) => {
    const newType = {
      id: `custom_${Date.now()}`,
      name,
      color,
      is_active: true
    };
    const updatedTypes = [...regionTypes, newType];
    setRegionTypes(updatedTypes);
    saveRegionTypes(updatedTypes);
    
    toast({
      title: "Success",
      description: "Region type added successfully",
    });
  };

  // Handle updating custom region type
  const handleUpdateRegionType = (id: string, updates: Partial<typeof regionTypes[0]>) => {
    const updatedTypes = regionTypes.map(type => 
      type.id === id ? { ...type, ...updates } : type
    );
    setRegionTypes(updatedTypes);
    saveRegionTypes(updatedTypes);
    
    toast({
      title: "Success",
      description: "Region type updated successfully",
    });
  };

  // Handle deleting custom region type
  const handleDeleteRegionType = (id: string) => {
    const updatedTypes = regionTypes.filter(type => type.id !== id);
    setRegionTypes(updatedTypes);
    saveRegionTypes(updatedTypes);
    
    toast({
      title: "Success",
      description: "Region type deleted successfully",
    });
  };

  // Handle toggling individual area visibility
  const handleToggleAreaVisibility = async (areaId: string) => {
    const area = mapAreas.find(a => a.id === areaId);
    if (!area) return;

    const newVisibility = !area.is_visible;
    await handleAreaUpdate(areaId, { is_visible: newVisibility });
  };

  // Handle toggling type visibility
  const handleToggleTypeVisibility = (typeName: string) => {
    const newHiddenTypes = new Set(hiddenTypes);
    if (hiddenTypes.has(typeName)) {
      newHiddenTypes.delete(typeName);
    } else {
      newHiddenTypes.add(typeName);
    }
    setHiddenTypes(newHiddenTypes);
  };

  // Handle toggling all visibility
  const handleToggleAllVisibility = () => {
    const allVisible = mapAreas.every(area => area.is_visible !== false) && hiddenTypes.size === 0;
    
    if (allVisible) {
      // Hide all
      setHiddenTypes(new Set(Array.from(new Set(mapAreas.map(area => area.area_type)))));
    } else {
      // Show all
      setHiddenTypes(new Set());
      // Also make sure all individual areas are visible
      mapAreas.forEach(area => {
        if (area.is_visible === false) {
          handleAreaUpdate(area.id, { is_visible: true });
        }
      });
    }
  };

  const handleAreaAdd = async (coordinates: Point[], areaName: string, areaType: string, description?: string) => {
    if (!selectedMap || !user) return;

    try {
      // Convert Point[] to Json-compatible format
      const polygonJson = coordinates.map(point => ({ x: point.x, y: point.y }));

      const { error } = await supabase
        .from('map_areas')
        .insert({
          map_id: selectedMap.id,
          area_name: areaName,
          area_type: areaType,
          description: description || null,
          polygon_coordinates: polygonJson as any, // Cast to any to satisfy Json type
          created_by: user.id,
          is_visible: true // Default to visible
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Map area added successfully",
      });

      loadMapAreas();
    } catch (error) {
      console.error('Error adding map area:', error);
      toast({
        title: "Error",
        description: "Failed to add map area",
        variant: "destructive",
      });
    }
  };

  const handleAreaUpdate = async (areaId: string, updates: Partial<MapArea>) => {
    try {
      // Convert the updates to be compatible with Supabase types
      const supabaseUpdates: any = { ...updates };
      
      // Convert polygon_coordinates if it exists
      if (updates.polygon_coordinates) {
        supabaseUpdates.polygon_coordinates = updates.polygon_coordinates.map(point => ({ 
          x: point.x, 
          y: point.y 
        }));
      }

      const { error } = await supabase
        .from('map_areas')
        .update(supabaseUpdates)
        .eq('id', areaId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Map area updated successfully",
      });

      loadMapAreas();
    } catch (error) {
      console.error('Error updating map area:', error);
      toast({
        title: "Error",
        description: "Failed to update map area",
        variant: "destructive",
      });
    }
  };

  // Handle deleting map area
  const handleAreaDelete = async (areaId: string) => {
    try {
      const { error } = await supabase
        .from('map_areas')
        .delete()
        .eq('id', areaId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Map area deleted successfully",
      });

      loadMapAreas();
    } catch (error) {
      console.error('Error deleting map area:', error);
      toast({
        title: "Error",
        description: "Failed to delete map area",
        variant: "destructive",
      });
    }
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
            <h1 className="text-2xl font-bold">Map Areas Management</h1>
          </div>
          
          {selectedMap && userRole === 'dm' && (
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
                onClick={() => setActiveMode('area')}
                variant={activeMode === 'area' ? 'default' : 'outline'}
                size="sm"
                className={activeMode === 'area' 
                  ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' 
                  : 'border-amber-200 text-amber-100 hover:bg-amber-700'
                }
              >
                <Square className="h-4 w-4 mr-2" />
                Add Area
              </Button>
            </div>
          )}
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {!selectedMap ? (
          <div className="space-y-6">
            <div>
              <h2 className="text-3xl font-bold text-amber-900 mb-2">Choose a Map to Manage Areas</h2>
              <p className="text-amber-700">
                Select a map below to add and manage territorial areas with custom polygon shapes.
              </p>
            </div>
            
            <MapSelector
              maps={maps}
              onMapSelect={setSelectedMap}
              userRole={userRole}
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Main map area */}
            <div className="lg:col-span-3 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold text-amber-900">{selectedMap.name}</h2>
                <Button
                  onClick={() => setSelectedMap(null)}
                  variant="outline"
                  className="border-amber-300 text-amber-800 hover:bg-amber-100"
                >
                  Choose Different Map
                </Button>
              </div>
              
              {selectedMap.description && (
                <p className="text-amber-700">{selectedMap.description}</p>
              )}

              <MapAreasCanvas
                map={selectedMap}
                mapAreas={mapAreas}
                activeMode={activeMode}
                onAreaAdd={handleAreaAdd}
                userRole={userRole}
                regionTypes={regionTypes}
                hiddenTypes={hiddenTypes}
                getAreaColor={getAreaColor}
              />
            </div>

            {/* Sidebar */}
            <div className="space-y-4">
              <MapAreasManager
                mapAreas={mapAreas}
                onAreaUpdate={handleAreaUpdate}
                onAreaDelete={handleAreaDelete}
                userRole={userRole}
                activeMode={activeMode}
                regionTypes={regionTypes}
                onAddRegionType={handleAddRegionType}
                onUpdateRegionType={handleUpdateRegionType}
                onDeleteRegionType={handleDeleteRegionType}
                hiddenTypes={hiddenTypes}
                onToggleAreaVisibility={handleToggleAreaVisibility}
                onToggleTypeVisibility={handleToggleTypeVisibility}
                onToggleAllVisibility={handleToggleAllVisibility}
                getAreaColor={getAreaColor}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MapAreasManagement;
