
export interface Map {
  id: string;
  name: string;
  description: string | null;
  image_url: string;
  image_path: string;
  thumbnail_url: string | null;
  width: number;
  height: number;
  scale_factor: number | null;
  scale_unit: string | null;
  metadata: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface Pin {
  id: string;
  map_id: string;
  pin_type_id: string | null;
  name: string;
  description: string | null;
  x_normalized: number;
  y_normalized: number;
  external_link: string | null;
  metadata: any;
  is_visible: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  pin_types?: {
    id: string;
    name: string;
    description: string | null;
    color: string;
    category: string | null;
    size_modifier: number;
  };
}

export interface PinType {
  id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  icon_path: string | null;
  color: string;
  size_modifier: number;
  category: string | null;
  metadata: any;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface DistanceMeasurement {
  id: string;
  map_id: string;
  name: string;
  points: { x: number; y: number }[];
  total_distance: number | null;
  unit: string;
  created_by: string | null;
  created_at: string;
}

// Database response types that need transformation
export interface DatabaseDistanceMeasurement {
  id: string;
  map_id: string;
  name: string;
  points: any; // Json type from database
  total_distance: number | null;
  unit: string;
  created_by: string | null;
  created_at: string;
}
