
-- Drop the map-related tables in the correct order (child tables first due to foreign key constraints)
DROP TABLE IF EXISTS public.map_markers;

-- Drop any map-related storage buckets if they exist
DELETE FROM storage.objects WHERE bucket_id IN ('map-images', 'map-icons');
DELETE FROM storage.buckets WHERE id IN ('map-images', 'map-icons');
