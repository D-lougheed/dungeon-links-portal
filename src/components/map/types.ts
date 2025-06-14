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
}

export interface PinType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  category: string;
  size_modifier: number;
  icon_url?: string; // Add this optional property
  is_active: boolean;
  created_at: string;
}

export interface Pin {
  id: string;
  map_id: string;
  pin_type_id: string;
  name: string;
  description: string | null;
  x_normalized: number;
  y_normalized: number;
  is_visible: boolean;
  created_at: string;
  pin_types?: PinType; // This should match the Supabase join result
}

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
