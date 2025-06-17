
-- Create a table to store map area analysis results
CREATE TABLE public.map_areas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  map_id UUID NOT NULL,
  area_name TEXT NOT NULL,
  area_type TEXT NOT NULL, -- 'terrain', 'landmark', 'region', etc.
  description TEXT,
  terrain_features JSONB DEFAULT '[]'::jsonb, -- Array of terrain types like ['forest', 'mountains', 'water']
  landmarks JSONB DEFAULT '[]'::jsonb, -- Array of landmark descriptions
  general_location TEXT, -- 'northwest', 'center', 'southeast', etc.
  bounding_box JSONB, -- Store rough area boundaries as {x1, y1, x2, y2} normalized coordinates
  confidence_score NUMERIC(3,2), -- 0.00 to 1.00 confidence in the analysis
  analysis_metadata JSONB DEFAULT '{}'::jsonb, -- Store additional AI analysis data
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (map_id) REFERENCES public.maps(id) ON DELETE CASCADE
);

-- Create an index for quick lookups by map
CREATE INDEX idx_map_areas_map_id ON public.map_areas(map_id);

-- Create an index for area type filtering
CREATE INDEX idx_map_areas_type ON public.map_areas(area_type);

-- Enable RLS (assuming DMs should have full access, players read-only)
ALTER TABLE public.map_areas ENABLE ROW LEVEL SECURITY;

-- Policy for DMs to have full access
CREATE POLICY "DMs can manage map areas" 
  ON public.map_areas 
  FOR ALL 
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles 
      WHERE user_id = auth.uid() AND role = 'dm'
    )
  );

-- Policy for players to view map areas
CREATE POLICY "Players can view map areas" 
  ON public.map_areas 
  FOR SELECT 
  USING (true); -- All authenticated users can view

-- Create a function to trigger updated_at on changes
CREATE OR REPLACE FUNCTION public.handle_map_areas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER handle_map_areas_updated_at
  BEFORE UPDATE ON public.map_areas
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_map_areas_updated_at();
