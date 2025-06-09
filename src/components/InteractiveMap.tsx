import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { ArrowLeft, Plus, Edit, Trash2, Eye, EyeOff, ZoomIn, ZoomOut, RotateCcw, Layers, Settings } from 'lucide-react';
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
  const [showLayerPanel, setShowLayerPanel] = useState(true);
  const [showControlPanel, setShowControlPanel] = useState(true);
  
  // Enhanced zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

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

  // Handle image load to get natural dimensions
  const handleImageLoad = () => {
    if (imageRef.current) {
      setImageDimensions({
        width: imageRef.current.naturalWidth,
        height: imageRef.current.naturalHeight
      });
      setImageLoaded(true);
      console.log('Image loaded with dimensions:', imageRef.current.naturalWidth, 'x', imageRef.current.naturalHeight);
    }
  };

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

  const getImageDimensions = () => {
    if (!mapContainerRef.current || !imageLoaded) return { width: 8192, height: 4532 };
    
    const container = mapContainerRef.current;
    const containerAspect = container.clientWidth / container.clientHeight;
    const imageAspect = imageDimensions.width / imageDimensions.height;
    
    let displayWidth, displayHeight;
    
    if (containerAspect > imageAspect) {
      // Container is wider than image aspect ratio
      displayHeight = container.clientHeight;
      displayWidth = displayHeight * imageAspect;
    } else {
      // Container is taller than image aspect ratio
      displayWidth = container.clientWidth;
      displayHeight = displayWidth / imageAspect;
    }
    
    return { width: displayWidth, height: displayHeight };
  };

  const handleMapClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isAddingMarker || userRole !== 'dm' || isDragging) return;

    const { width, height } = getImageDimensions();
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    // Calculate the image position within the container
    const containerCenterX = rect.width / 2;
    const containerCenterY = rect.height / 2;
    const imageCenterX = containerCenterX + pan.x;
    const imageCenterY = containerCenterY + pan.y;
    
    // Calculate click position relative to image
    const imageLeft = imageCenterX - (width * zoom) / 2;
    const imageTop = imageCenterY - (height * zoom) / 2;
    
    const relativeX = (event.clientX - rect.left - imageLeft) / (width * zoom);
    const relativeY = (event.clientY - rect.top - imageTop) / (height * zoom);

    // Clamp values to ensure they're within bounds
    const clampedX = Math.max(0, Math.min(1, relativeX)) * 100;
    const clampedY = Math.max(0, Math.min(1, relativeY)) * 100;

    setPendingPosition({ x: clampedX, y: clampedY });
    setIsDialogOpen(true);
    setIsAddingMarker(false);
  };

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault();
    
    const rect = mapContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const delta = event.deltaY > 0 ? -0.2 : 0.2;
    const newZoom = Math.max(0.1, Math.min(10, zoom + delta));
    
    // Calculate zoom center point to zoom towards mouse position
    const zoomFactor = newZoom / zoom;
    const newPanX = mouseX - (mouseX - pan.x) * zoomFactor;
    const newPanY = mouseY - (mouseY - pan.y) * zoomFactor;
    
    setZoom(newZoom);
    setPan({ x: newPanX, y: newPanY });
  };

  const handleMouseDown = (event: React.MouseEvent) => {
    if (isAddingMarker) return;
    setIsDragging(true);
    setDragStart({ x: event.clientX - pan.x, y: event.clientY - pan.y });
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging || isAddingMarker) return;
    
    const newPan = {
      x: event.clientX - dragStart.x,
      y: event.clientY - dragStart.y,
    };
    
    setPan(newPan);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(10, zoom * 1.5);
    setZoom(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(0.1, zoom / 1.5);
    setZoom(newZoom);
  };

  const handleResetView = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
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
  const { width: imageDisplayWidth, height: imageDisplayHeight } = getImageDimensions();

  return (
    <div className="fixed inset-0 bg-black overflow-hidden">
      {/* Full Screen Map Container */}
      <div
        ref={mapContainerRef}
        className="absolute inset-0 w-full h-full overflow-hidden"
        style={{
          cursor: isAddingMarker ? 'crosshair' : isDragging ? 'grabbing' : 'grab',
        }}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleMapClick}
      >
        {/* High-resolution map image */}
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
            transformOrigin: 'center center',
          }}
        >
          <img
            ref={imageRef}
            src="/lovable-uploads/9e267bab-8bfd-4003-b5f3-8a4ffe43aea5.png"
            alt="Campaign Map"
            className="max-w-none select-none"
            style={{
              width: `${imageDisplayWidth * zoom}px`,
              height: `${imageDisplayHeight * zoom}px`,
              imageRendering: zoom > 2 ? 'pixelated' : 'auto',
              filter: 'contrast(1.1) saturate(1.1)',
            }}
            onLoad={handleImageLoad}
            draggable={false}
          />
        </div>

        {/* Markers overlay */}
        {imageLoaded && (
          <div
            className="absolute pointer-events-none"
            style={{
              left: '50%',
              top: '50%',
              width: `${imageDisplayWidth * zoom}px`,
              height: `${imageDisplayHeight * zoom}px`,
              transform: `translate(calc(-50% + ${pan.x}px), calc(-50% + ${pan.y}px))`,
            }}
          >
            {filteredMarkers.map((marker) => (
              <div
                key={marker.id}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 group pointer-events-auto"
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
                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                  {marker.name} ({marker.layer})
                </div>
                
                {/* Edit/Delete buttons for DM */}
                {userRole === 'dm' && (
                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 w-6 p-0 bg-white"
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
                      className="h-6 w-6 p-0 text-red-600 hover:text-red-700 bg-white"
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
        )}
      </div>

      {/* Floating Header Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button
            onClick={onBack}
            variant="outline"
            className="bg-white/90 backdrop-blur-sm border-amber-200 text-amber-900 hover:bg-white"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <h1 className="text-xl font-bold text-white bg-black/50 px-4 py-2 rounded backdrop-blur-sm">
            Interactive Campaign Map
            {isAddingMarker && (
              <span className="text-sm font-normal text-green-400 ml-2">
                (Click anywhere to add a marker)
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setShowLayerPanel(!showLayerPanel)}
            variant="outline"
            className="bg-white/90 backdrop-blur-sm"
          >
            <Layers className="h-4 w-4" />
          </Button>
          <Button
            onClick={() => setShowControlPanel(!showControlPanel)}
            variant="outline"
            className="bg-white/90 backdrop-blur-sm"
          >
            <Settings className="h-4 w-4" />
          </Button>
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
              {isAddingMarker ? 'Cancel' : 'Add Marker'}
            </Button>
          )}
        </div>
      </div>

      {/* Floating Layer Controls Panel */}
      {showLayerPanel && (
        <Card className="absolute top-20 left-4 z-20 w-80 bg-white/95 backdrop-blur-sm border-amber-200 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-900 flex items-center justify-between">
              <span className="flex items-center">
                <Layers className="h-5 w-5 mr-2" />
                Map Layers
              </span>
              <Button
                onClick={() => setShowLayerPanel(false)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </CardTitle>
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
                  <Label htmlFor={layer} className="text-sm font-medium flex-1">
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
      )}

      {/* Enhanced Zoom Controls Panel */}
      {showControlPanel && (
        <Card className="absolute top-20 right-4 z-20 w-64 bg-white/95 backdrop-blur-sm border-amber-200 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-900 flex items-center justify-between">
              <span className="flex items-center">
                <Settings className="h-5 w-5 mr-2" />
                Map Controls
              </span>
              <Button
                onClick={() => setShowControlPanel(false)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <Button
                onClick={handleZoomIn}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center"
              >
                <ZoomIn className="h-4 w-4 mr-2" />
                Zoom In
              </Button>
              <Button
                onClick={handleZoomOut}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center"
              >
                <ZoomOut className="h-4 w-4 mr-2" />
                Zoom Out
              </Button>
              <Button
                onClick={handleResetView}
                variant="outline"
                size="sm"
                className="w-full flex items-center justify-center"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset View
              </Button>
            </div>
            <div className="mt-4 text-xs text-amber-700 space-y-1">
              <div>Zoom: {Math.round(zoom * 100)}%</div>
              <div>Max Zoom: 1000%</div>
              <div className="text-amber-600">Mouse wheel: zoom | Drag: pan</div>
              {imageDimensions.width > 0 && (
                <div className="text-amber-600">
                  Image: {imageDimensions.width}×{imageDimensions.height}px
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Floating Selected Marker Info */}
      {selectedMarker && (
        <Card className="absolute bottom-4 left-4 right-4 z-20 bg-white/95 backdrop-blur-sm border-amber-200 shadow-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-amber-900 flex items-center justify-between">
              Marker Details
              <Button
                onClick={() => setSelectedMarker(null)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
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
          </CardContent>
        </Card>
      )}

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
