
-- Add player_viewable column to map_areas table
ALTER TABLE public.map_areas 
ADD COLUMN player_viewable BOOLEAN NOT NULL DEFAULT false;

-- Add comment to describe the column
COMMENT ON COLUMN public.map_areas.player_viewable IS 'Whether this area is visible to players (not just DMs)';
