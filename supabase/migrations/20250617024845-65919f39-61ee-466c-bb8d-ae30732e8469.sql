
-- Add is_visible column to map_areas table
ALTER TABLE public.map_areas 
ADD COLUMN is_visible boolean NOT NULL DEFAULT true;
