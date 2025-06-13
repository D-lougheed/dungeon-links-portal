
-- Create table for map pins
CREATE TABLE public.map_pins (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    x DECIMAL NOT NULL,
    y DECIMAL NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    user_id UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.map_pins ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to manage their own pins
CREATE POLICY "Users can manage their own pins" ON public.map_pins
    FOR ALL USING (auth.uid() = user_id);

-- Policy for DMs to manage all pins
CREATE POLICY "DMs can manage all pins" ON public.map_pins
    FOR ALL USING (public.is_dm(auth.uid()));

-- Create storage bucket for map images
INSERT INTO storage.buckets (id, name, public)
VALUES ('map-images', 'map-images', true);

-- Allow public access to map images
CREATE POLICY "Public Access" ON storage.objects
FOR SELECT USING (bucket_id = 'map-images');

-- Allow authenticated users to upload map images
CREATE POLICY "Authenticated users can upload map images" ON storage.objects
FOR INSERT WITH CHECK (bucket_id = 'map-images' AND auth.role() = 'authenticated');
