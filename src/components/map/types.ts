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
  thumbnail_url?: string; // Add this for MapSelector compatibility
}

export interface PinType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  category: string;
  size_modifier: number;
  icon_url?: string | null;
  is_active: boolean;
  created_at: string;
}

// Database Pin structure (what comes from Supabase with all fields)
export interface DatabasePin {
  id: string;
  map_id: string;
  pin_type_id: string;
  name: string;
  label: string;
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

// Database DistanceMeasurement structure
export interface DatabaseDistanceMeasurement {
  id: string;
  map_id: string;
  name: string;
  points: any; // Json type from Supabase - will be parsed
  total_distance: number;
  unit: string;
  created_at: string;
  created_by: string;
}

// Simplified Pin interface for component use
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

// Simplified DistanceMeasurement interface 
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
