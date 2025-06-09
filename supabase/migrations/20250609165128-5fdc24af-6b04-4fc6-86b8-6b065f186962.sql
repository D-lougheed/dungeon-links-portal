
-- Create storage buckets for map images and icons
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('map-images', 'map-images', true),
  ('map-icons', 'map-icons', true);

-- Create RLS policies for map-images bucket
CREATE POLICY "Everyone can view map images" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'map-images');

CREATE POLICY "DMs can upload map images" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'map-images' AND public.has_role(auth.uid(), 'dm'));

CREATE POLICY "DMs can update map images" 
  ON storage.objects 
  FOR UPDATE 
  USING (bucket_id = 'map-images' AND public.has_role(auth.uid(), 'dm'));

CREATE POLICY "DMs can delete map images" 
  ON storage.objects 
  FOR DELETE 
  USING (bucket_id = 'map-images' AND public.has_role(auth.uid(), 'dm'));

-- Create RLS policies for map-icons bucket
CREATE POLICY "Everyone can view map icons" 
  ON storage.objects 
  FOR SELECT 
  USING (bucket_id = 'map-icons');

CREATE POLICY "DMs can upload map icons" 
  ON storage.objects 
  FOR INSERT 
  WITH CHECK (bucket_id = 'map-icons' AND public.has_role(auth.uid(), 'dm'));

CREATE POLICY "DMs can update map icons" 
  ON storage.objects 
  FOR UPDATE 
  USING (bucket_id = 'map-icons' AND public.has_role(auth.uid(), 'dm'));

CREATE POLICY "DMs can delete map icons" 
  ON storage.objects 
  FOR DELETE 
  USING (bucket_id = 'map-icons' AND public.has_role(auth.uid(), 'dm'));

-- Update map_settings table to store file path instead of URL
ALTER TABLE public.map_settings 
ADD COLUMN IF NOT EXISTS map_image_path TEXT;

-- Update map_icons table to store file path instead of URL
ALTER TABLE public.map_icons 
ADD COLUMN IF NOT EXISTS icon_file_path TEXT;

-- We'll keep the existing URL columns for backward compatibility during transition
-- but prioritize file_path columns when available
