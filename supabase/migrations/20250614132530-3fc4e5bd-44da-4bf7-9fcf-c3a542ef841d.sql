
-- Update pin_types table to add missing columns that your code expects
ALTER TABLE pin_types 
ADD COLUMN IF NOT EXISTS size INTEGER DEFAULT 24;

-- The maps table already has scale_factor and scale_unit, so no changes needed there

-- Update the pins table to match your code's expectations
ALTER TABLE pins 
ADD COLUMN IF NOT EXISTS label TEXT;

-- Update existing pins to have a label if they don't have one
UPDATE pins 
SET label = name 
WHERE label IS NULL;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_pins_map_type ON pins(map_id, pin_type_id);
CREATE INDEX IF NOT EXISTS idx_pin_types_category ON pin_types(category);
