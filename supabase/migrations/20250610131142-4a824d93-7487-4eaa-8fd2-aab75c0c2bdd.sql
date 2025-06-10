
-- Remove any remaining map-related tables and data
DROP TABLE IF EXISTS public.map_markers CASCADE;
DROP TABLE IF EXISTS public.map_locations CASCADE;
DROP TABLE IF EXISTS public.map_icons CASCADE;
DROP TABLE IF EXISTS public.map_settings CASCADE;

-- Remove any map-related storage buckets and objects
DELETE FROM storage.objects WHERE bucket_id IN ('map-images', 'map-icons');
DELETE FROM storage.buckets WHERE id IN ('map-images', 'map-icons');
