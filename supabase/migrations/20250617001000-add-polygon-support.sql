
-- Add polygon coordinates column and make bounding_box optional
ALTER TABLE public.map_areas 
ADD COLUMN IF NOT EXISTS polygon_coordinates JSONB DEFAULT NULL;

-- Update the existing areas to have polygon coordinates based on bounding_box
UPDATE public.map_areas 
SET polygon_coordinates = jsonb_build_array(
  jsonb_build_object('x', (bounding_box->>'x1')::float, 'y', (bounding_box->>'y1')::float),
  jsonb_build_object('x', (bounding_box->>'x2')::float, 'y', (bounding_box->>'y1')::float),
  jsonb_build_object('x', (bounding_box->>'x2')::float, 'y', (bounding_box->>'y2')::float),
  jsonb_build_object('x', (bounding_box->>'x1')::float, 'y', (bounding_box->>'y2')::float)
)
WHERE bounding_box IS NOT NULL AND polygon_coordinates IS NULL;

-- Create an index for polygon coordinate queries
CREATE INDEX IF NOT EXISTS idx_map_areas_polygon ON public.map_areas USING GIN (polygon_coordinates);
