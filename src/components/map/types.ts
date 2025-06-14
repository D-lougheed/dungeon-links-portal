// src/components/map/types.ts

export interface Map {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  image_path: string;
  width: number;
  height: number;
  scale_factor: number;
  scale_unit: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  thumbnail_url?: string; // Add this optional property for MapSelector
}

export interface PinType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  category: string;
  size_modifier: number;
  icon_url?: string | null; // Make this optional and nullable
  is_active: boolean;
  created_at: string;
}

// Database Pin structure (what comes from Supabase)
export interface DatabasePin {
  id: string;
  map_id: string;
  pin_type_id: string;
  name: string;
  label: string; // Add this since your database might have both
  description: string | null;
  x_normalized: number;
  y_normalized: number;
  is_visible: boolean;
  created_at: string;
  created_by: string;
  updated_at: string;
  external_link: string;
  metadata: any; // Json type from Supabase
  pin_types?: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    category: string;
    size_modifier: number;
    icon_url?: string | null;
  };
}

// Internal Pin interface (used in component)
export interface Pin {
  id: string;
  x: number;
  y: number;
  label: string;
  color: string;
  pin_type_id?: string;
  pin_type?: PinType;
  description?: string;
}

// Database DistanceMeasurement structure
export interface DatabaseDistanceMeasurement {
  id: string;
  map_id: string;
  name: string;
  points: any; // Json type from Supabase
  total_distance: number;
  unit: string;
  created_at: string;
  created_by: string;
}

// Internal DistanceMeasurement interface
export interface DistanceMeasurement {
  id: string;
  map_id: string;
  name: string;
  points: Array<{
    x: number;
    y: number;
  }>;
  total_distance: number;
  unit: string;
  created_at: string;
}
