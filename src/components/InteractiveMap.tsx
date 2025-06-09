
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, Edit, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { toast } from 'sonner';

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

const InteractiveMap: React.FC<InteractiveMapProps> = ({ onBack }) => {
  const { userRole } = useAuth();
  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [visibleLayers, setVisibleLayers] = useState<Set<string>>(new Set(layers));
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);
  const [isAddingMarker, setIsAddingMarker] = useState(false);
  const [pendingPosition, setPendingPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingMarker, setEditingMarker] = useState<MapMarker | null>(null);

  const form = useForm<z.infer<typeof markerSchema>>({
    resolver: zodResolver(markerSchema),
    defaultValues: {
      name: '',
      layer: layers[0],
    },
  });

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

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingMarker || userRole !== 'dm') return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    setPendingPosition({ x, y });
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
        // Create new marker
        const { error } = await supabase
          .from('map_markers')
          .insert({
            name: values.name,
            x: pendingPosition.x,
            y: pendingPosition.y,
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

  const filteredMarkers = markers.filter(marker => visibleLayers.has(marker.layer));

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
                <div
                  className="relative w-full h-96 bg-amber-50 border-2 border-amber-300 rounded-lg overflow-hidden cursor-crosshair"
                  onClick={handleMapClick}
                  style={{
                    backgroundImage: "url('/lovable-uploads/70382beb-0456-4b0e-b550-a587cc615789.png')",
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                  }}
                >
                  {filteredMarkers.map((marker) => (
                    <div
                      key={marker.id}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 group"
                      style={{
                        left: `${marker.x}%`,
                        top: `${marker.y}%`,
                      }}
                    >
                      <div
                        className={`w-4 h-4 rounded-full cursor-pointer transition-all duration-200 border-2 border-white shadow-lg hover:scale-150 ${
                          marker.layer === 'Political' ? 'bg-red-500' :
                          marker.layer === 'Geographic' ? 'bg-green-500' :
                          marker.layer === 'Cities' ? 'bg-blue-500' :
                          marker.layer === 'Dungeons' ? 'bg-purple-500' :
                          'bg-yellow-500'
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMarker(marker);
                        }}
                      />
                      
                      {/* Marker tooltip */}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                        {marker.name} ({marker.layer})
                      </div>
                      
                      {/* Edit/Delete buttons for DM */}
                      {userRole === 'dm' && (
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditMarker(marker);
                            }}
                          >
                            <Edit className="h-3 w-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 w-6 p-0 text-red-600 hover:text-red-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteMarker(marker.id);
                            }}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
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
