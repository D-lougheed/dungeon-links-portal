
-- Create table for map configuration (background image, zoom settings, etc.)
CREATE TABLE IF NOT EXISTS public.map_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_image_url TEXT,
  default_zoom INTEGER DEFAULT 2,
  max_zoom INTEGER DEFAULT 18,
  min_zoom INTEGER DEFAULT 1,
  center_lat NUMERIC DEFAULT 0,
  center_lng NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for custom marker icons
CREATE TABLE IF NOT EXISTS public.map_icons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tag_type TEXT NOT NULL, -- City, Village, etc.
  icon_url TEXT NOT NULL,
  icon_size_width INTEGER DEFAULT 25,
  icon_size_height INTEGER DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Update existing map_locations table to reference custom icons (only if columns don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'map_locations' AND column_name = 'icon_id') THEN
    ALTER TABLE public.map_locations ADD COLUMN icon_id UUID REFERENCES public.map_icons(id);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'map_locations' AND column_name = 'zoom_level') THEN
    ALTER TABLE public.map_locations ADD COLUMN zoom_level INTEGER DEFAULT 2;
  END IF;
END $$;

-- Enable RLS on new tables
ALTER TABLE public.map_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.map_icons ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate them
DROP POLICY IF EXISTS "Everyone can view map settings" ON public.map_settings;
DROP POLICY IF EXISTS "DMs can manage map settings" ON public.map_settings;
DROP POLICY IF EXISTS "Everyone can view map icons" ON public.map_icons;
DROP POLICY IF EXISTS "DMs can manage map icons" ON public.map_icons;
DROP POLICY IF EXISTS "Everyone can view map locations" ON public.map_locations;
DROP POLICY IF EXISTS "DMs can manage map locations" ON public.map_locations;

-- RLS policies for map_settings (DMs can manage, everyone can view)
CREATE POLICY "Everyone can view map settings" 
  ON public.map_settings 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "DMs can manage map settings" 
  ON public.map_settings 
  FOR ALL 
  TO authenticated
  USING (public.has_role(auth.uid(), 'dm'));

-- RLS policies for map_icons (DMs can manage, everyone can view)
CREATE POLICY "Everyone can view map icons" 
  ON public.map_icons 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "DMs can manage map icons" 
  ON public.map_icons 
  FOR ALL 
  TO authenticated
  USING (public.has_role(auth.uid(), 'dm'));

-- RLS policies for map_locations (everyone can view, DMs can manage)
CREATE POLICY "Everyone can view map locations" 
  ON public.map_locations 
  FOR SELECT 
  TO authenticated
  USING (true);

CREATE POLICY "DMs can manage map locations" 
  ON public.map_locations 
  FOR ALL 
  TO authenticated
  USING (public.has_role(auth.uid(), 'dm'));

-- Insert default map settings if none exist
INSERT INTO public.map_settings (id) 
SELECT gen_random_uuid() 
WHERE NOT EXISTS (SELECT 1 FROM public.map_settings);
