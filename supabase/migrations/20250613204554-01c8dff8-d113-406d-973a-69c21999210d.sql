
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User roles enum (only create if it doesn't exist)
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('dm', 'player');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Maps table for storing custom map images
CREATE TABLE IF NOT EXISTS public.maps (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT NOT NULL, -- Supabase Storage URL
    image_path TEXT NOT NULL, -- Storage bucket path
    thumbnail_url TEXT, -- Optimized thumbnail
    width INTEGER NOT NULL, -- Image width in pixels
    height INTEGER NOT NULL, -- Image height in pixels
    scale_factor NUMERIC(10,4), -- Real-world units per pixel
    scale_unit TEXT DEFAULT 'meters', -- Unit of measurement
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Pin types table for reusable pin categories
CREATE TABLE IF NOT EXISTS public.pin_types (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon_url TEXT, -- Supabase Storage URL for custom icon
    icon_path TEXT, -- Storage bucket path
    color VARCHAR(7) DEFAULT '#FF0000', -- Hex color code
    size_modifier NUMERIC(3,2) DEFAULT 1.0, -- Size multiplier
    category TEXT, -- Optional grouping category
    metadata JSONB DEFAULT '{}',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

-- Pins table for individual pin instances
CREATE TABLE IF NOT EXISTS public.pins (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    map_id UUID REFERENCES public.maps(id) ON DELETE CASCADE NOT NULL,
    pin_type_id UUID REFERENCES public.pin_types(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    -- Normalized coordinates (0-1 range) for device independence
    x_normalized NUMERIC(10,8) NOT NULL, -- X position as percentage of image width
    y_normalized NUMERIC(10,8) NOT NULL, -- Y position as percentage of image height
    external_link TEXT, -- Optional external URL
    metadata JSONB DEFAULT '{}',
    is_visible BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Distance measurements table
CREATE TABLE IF NOT EXISTS public.distance_measurements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    map_id UUID REFERENCES public.maps(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    points JSONB NOT NULL, -- Array of normalized coordinate points
    total_distance NUMERIC(10,4), -- Calculated distance
    unit TEXT DEFAULT 'meters',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Performance indexes (create if not exists)
CREATE INDEX IF NOT EXISTS idx_pins_map_visible ON public.pins(map_id, is_visible) WHERE is_visible = TRUE;
CREATE INDEX IF NOT EXISTS idx_maps_active ON public.maps(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_pins_coordinates ON public.pins(x_normalized, y_normalized);

-- Enable RLS on all tables
ALTER TABLE public.maps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pin_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distance_measurements ENABLE ROW LEVEL SECURITY;

-- Helper function to check user role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS user_role
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
  RETURN (
    SELECT role 
    FROM public.user_roles 
    WHERE user_id = auth.uid()
  );
END;
$$;

-- Function to check if user is DM
CREATE OR REPLACE FUNCTION is_dm()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT (get_user_role() = 'dm');
$$;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "DMs can manage all maps" ON public.maps;
DROP POLICY IF EXISTS "Players can view active maps" ON public.maps;
DROP POLICY IF EXISTS "DMs can manage pin types" ON public.pin_types;
DROP POLICY IF EXISTS "All users can view active pin types" ON public.pin_types;
DROP POLICY IF EXISTS "Users can view pins on active maps" ON public.pins;
DROP POLICY IF EXISTS "DMs can manage pins" ON public.pins;
DROP POLICY IF EXISTS "DMs can manage distance measurements" ON public.distance_measurements;

-- Maps policies
CREATE POLICY "DMs can manage all maps" ON public.maps
    FOR ALL TO authenticated
    USING (is_dm())
    WITH CHECK (is_dm());

CREATE POLICY "Players can view active maps" ON public.maps
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Pin types policies
CREATE POLICY "DMs can manage pin types" ON public.pin_types
    FOR ALL TO authenticated
    USING (is_dm())
    WITH CHECK (is_dm());

CREATE POLICY "All users can view active pin types" ON public.pin_types
    FOR SELECT TO authenticated
    USING (is_active = true);

-- Pins policies
CREATE POLICY "Users can view pins on active maps" ON public.pins
    FOR SELECT TO authenticated
    USING (
        is_visible = true 
        AND EXISTS (
            SELECT 1 FROM public.maps 
            WHERE maps.id = pins.map_id 
            AND maps.is_active = true
        )
    );

CREATE POLICY "DMs can manage pins" ON public.pins
    FOR ALL TO authenticated
    USING (is_dm())
    WITH CHECK (is_dm());

-- Distance measurements policies
CREATE POLICY "DMs can manage distance measurements" ON public.distance_measurements
    FOR ALL TO authenticated
    USING (is_dm())
    WITH CHECK (is_dm());

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('maps', 'maps', false, 52428800, '{"image/jpeg","image/png","image/webp"}'),
  ('pin-icons', 'pin-icons', true, 2097152, '{"image/png","image/svg+xml","image/webp"}')
ON CONFLICT (id) DO NOTHING;

-- Drop existing storage policies if they exist
DROP POLICY IF EXISTS "DMs can upload map images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view maps they have access to" ON storage.objects;
DROP POLICY IF EXISTS "DMs can manage pin icons" ON storage.objects;

-- Storage policies
CREATE POLICY "DMs can upload map images" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'maps' AND is_dm());

CREATE POLICY "Users can view maps they have access to" ON storage.objects
    FOR SELECT TO authenticated
    USING (bucket_id = 'maps');

CREATE POLICY "DMs can manage pin icons" ON storage.objects
    FOR ALL TO authenticated
    USING (bucket_id = 'pin-icons' AND is_dm())
    WITH CHECK (bucket_id = 'pin-icons' AND is_dm());

-- Insert default pin types
INSERT INTO public.pin_types (name, description, color, category)
VALUES 
  ('City', 'Major settlement or city', '#FF6B35', 'settlement'),
  ('Town', 'Small town or village', '#F7931E', 'settlement'),
  ('Dungeon', 'Dungeon or underground location', '#8B4513', 'location'),
  ('Castle', 'Castle or fortress', '#4A90E2', 'structure'),
  ('Forest', 'Forest or wooded area', '#228B22', 'terrain'),
  ('Mountain', 'Mountain or peak', '#8B7355', 'terrain'),
  ('River', 'River or waterway', '#4169E1', 'terrain'),
  ('Point of Interest', 'General point of interest', '#9B59B6', 'misc')
ON CONFLICT DO NOTHING;
