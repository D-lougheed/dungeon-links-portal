
-- Remove the map_pins table and related storage
DROP TABLE IF EXISTS public.map_pins CASCADE;

-- Remove the map-images storage bucket and its contents
DELETE FROM storage.objects WHERE bucket_id = 'map-images';
DELETE FROM storage.buckets WHERE id = 'map-images';
