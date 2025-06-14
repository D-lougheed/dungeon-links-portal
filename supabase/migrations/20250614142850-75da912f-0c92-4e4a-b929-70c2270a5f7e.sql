
-- Add icon_url column to pin_types if it doesn't exist
ALTER TABLE pin_types ADD COLUMN IF NOT EXISTS icon_url TEXT;

-- Ensure all required columns exist
ALTER TABLE maps ADD COLUMN IF NOT EXISTS scale_factor FLOAT DEFAULT 1;
ALTER TABLE maps ADD COLUMN IF NOT EXISTS scale_unit VARCHAR DEFAULT 'meters';
