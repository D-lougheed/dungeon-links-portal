
-- Drop the map-related tables in the correct order (child tables first due to foreign key constraints)
DROP TABLE IF EXISTS public.map_locations;
DROP TABLE IF EXISTS public.map_icons;
DROP TABLE IF EXISTS public.map_settings;

-- Drop the storage buckets for map images and icons
DELETE FROM storage.objects WHERE bucket_id IN ('map-images', 'map-icons');
DELETE FROM storage.buckets WHERE id IN ('map-images', 'map-icons');
