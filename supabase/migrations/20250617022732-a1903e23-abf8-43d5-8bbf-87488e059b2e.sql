
-- Add polygon coordinates column to support custom polygon shapes
ALTER TABLE public.map_areas 
ADD COLUMN IF NOT EXISTS polygon_coordinates JSONB DEFAULT NULL;

-- Create an index for polygon coordinate queries
CREATE INDEX IF NOT EXISTS idx_map_areas_polygon ON public.map_areas USING GIN (polygon_coordinates);

-- Update the RLS policies to ensure they work with the new column
-- (The existing policies should continue to work, but let's make sure)
