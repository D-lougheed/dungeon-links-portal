
import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Map } from './types';

interface MapUploaderProps {
  onMapUploaded: (map: Map) => void;
  onCancel: () => void;
}

const MapUploader: React.FC<MapUploaderProps> = ({ onMapUploaded, onCancel }) => {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState<{ width: number; height: number } | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    scaleFactor: '',
    scaleUnit: 'meters'
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File",
        description: "Please select an image file (JPEG, PNG, WebP)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "File Too Large",
        description: "Please select an image smaller than 50MB",
        variant: "destructive",
      });
      return;
    }

    setSelectedFile(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);

    // Get image dimensions
    const img = new Image();
    img.onload = () => {
      setImageSize({ width: img.width, height: img.height });
      URL.revokeObjectURL(url);
    };
    img.src = url;

    // Auto-fill name if empty
    if (!formData.name) {
      const nameWithoutExtension = file.name.replace(/\.[^/.]+$/, "");
      setFormData(prev => ({ ...prev, name: nameWithoutExtension }));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !imageSize) {
      toast({
        title: "No File Selected",
        description: "Please select an image file first",
        variant: "destructive",
      });
      return;
    }

    if (!formData.name.trim()) {
      toast({
        title: "Missing Name",
        description: "Please enter a name for the map",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `maps/${fileName}`;

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('maps')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('maps')
        .getPublicUrl(filePath);

      // Create map record in database
      const mapData = {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        image_url: urlData.publicUrl,
        image_path: filePath,
        width: imageSize.width,
        height: imageSize.height,
        scale_factor: formData.scaleFactor ? parseFloat(formData.scaleFactor) : null,
        scale_unit: formData.scaleUnit,
        is_active: true
      };

      const { data: mapRecord, error: dbError } = await supabase
        .from('maps')
        .insert(mapData)
        .select()
        .single();

      if (dbError) throw dbError;

      toast({
        title: "Success",
        description: "Map uploaded successfully!",
      });

      onMapUploaded(mapRecord);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload Failed",
        description: error.message || "Failed to upload map",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const clearSelection = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setImageSize(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-gray-900 mb-2">
          Upload New Map
        </h2>
        <p className="text-gray-600">
          Upload a custom map image for your campaign
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Map Details</CardTitle>
          <CardDescription>
            Provide information about your map
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Upload */}
          <div>
            <Label htmlFor="file-upload">Map Image</Label>
            <div className="mt-1">
              {!selectedFile ? (
                <div
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">
                    Click to select an image file
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    JPEG, PNG, or WebP up to 50MB
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <img
                      src={previewUrl || ''}
                      alt="Map preview"
                      className="w-full h-64 object-contain bg-gray-100 rounded-lg"
                    />
                    <Button
                      onClick={clearSelection}
                      variant="destructive"
                      size="sm"
                      className="absolute top-2 right-2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {imageSize && (
                    <p className="text-sm text-gray-600">
                      Dimensions: {imageSize.width} × {imageSize.height} pixels
                    </p>
                  )}
                </div>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Map Name */}
          <div>
            <Label htmlFor="name">Map Name *</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Enter map name"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Optional description of the map"
              rows={3}
            />
          </div>

          {/* Scale Factor */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="scale">Scale Factor</Label>
              <Input
                id="scale"
                type="number"
                step="0.01"
                value={formData.scaleFactor}
                onChange={(e) => setFormData(prev => ({ ...prev, scaleFactor: e.target.value }))}
                placeholder="1.5"
              />
              <p className="text-xs text-gray-500 mt-1">
                Real-world units per pixel
              </p>
            </div>
            <div>
              <Label htmlFor="unit">Scale Unit</Label>
              <select
                id="unit"
                value={formData.scaleUnit}
                onChange={(e) => setFormData(prev => ({ ...prev, scaleUnit: e.target.value }))}
                className="w-full h-10 px-3 border border-gray-300 rounded-md"
              >
                <option value="meters">Meters</option>
                <option value="feet">Feet</option>
                <option value="yards">Yards</option>
                <option value="miles">Miles</option>
                <option value="kilometers">Kilometers</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-between">
        <Button 
          onClick={onCancel}
          variant="outline"
        >
          Cancel
        </Button>
        <Button 
          onClick={handleUpload}
          disabled={isUploading || !selectedFile}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {isUploading ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Uploading...
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Upload Map
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default MapUploader;
