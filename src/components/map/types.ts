// This file should be placed at src/components/map/types.ts

// Database types (from Supabase schema)
export interface Map {
  id: string;
  name: string;
  description?: string | null;
  image_url: string;
  image_path?: string;
  thumbnail_url?: string | null;
  width?: number;
  height?: number;
  scale_factor?: number;
  scale_unit?: string;
  is_active?: boolean;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
}

export interface PinType {
  id: string;
  name: string;
  description?: string | null;
  color: string;
  category: string;
  size_modifier?: number;
  icon_url?: string | null;
  is_active?: boolean;
  created_at?: string;
}

// This is the Pin type that matches your existing usage in MapCanvas and PinManager
export interface Pin {
  id: string;
  x: number;  // pixel coordinates
  y: number;  // pixel coordinates
  label: string;
  color: string;
  pin_type_id?: string;
  pin_type?: PinType;
  description?: string;
  
  // Additional properties that might be used by MapCanvas/PinManager
  map_id?: string;
  name?: string;  // alias for label
  is_visible?: boolean;
  x_normalized?: number;  // normalized coordinates (0-1)
  y_normalized?: number;  // normalized coordinates (0-1)
  pin_types?: PinType;  // alias for pin_type (used by database queries)
}

// Database Pin type - matches the Supabase schema exactly
export interface DatabasePin {
  id: string;
  map_id: string;
  pin_type_id?: string;
  name: string;
  description?: string | null;
  x_normalized: number;
  y_normalized: number;
  is_visible?: boolean;
  label?: string;
  external_link?: string | null;
  metadata?: any;
  created_at?: string;
  created_by?: string;
  updated_at?: string;
  // Relations
  pin_types?: PinType;
}

export interface DistanceMeasurement {
  id: string;
  map_id: string;
  name?: string;
  points: { x: number; y: number }[];
  total_distance?: number;
  unit?: string;
  created_at?: string;
  created_by?: string;
}

// Point type for polygon coordinates
export interface Point {
  x: number;
  y: number;
}

// Map Area type - updated to support visibility and custom region types
export interface MapArea {
  id: string;
  map_id: string;
  area_name: string;
  area_type: string;
  description?: string | null;
  terrain_features?: string[] | null;
  landmarks?: string[] | null;
  general_location?: string | null;
  bounding_box?: { x1: number; y1: number; x2: number; y2: number } | null;
  polygon_coordinates?: Point[] | null;
  confidence_score?: number | null;
  analysis_metadata?: any;
  created_at?: string;
  created_by?: string | null;
  updated_at?: string;
  is_visible?: boolean;
}

// Custom Region Type interface - now matches database schema
export interface RegionType {
  id: string;
  name: string;
  color: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  is_active: boolean;
}

// UI types for components that need pixel coordinates
export interface UIPin {
  id: string;
  x: number;  // pixel coordinates
  y: number;  // pixel coordinates
  label: string;
  color: string;
  pin_type_id?: string;
  pin_type?: PinType;
  description?: string;
}

// Conversion functions
export function convertDatabasePinToPin(dbPin: DatabasePin, mapWidth: number, mapHeight: number): Pin {
  return {
    id: dbPin.id,
    x: dbPin.x_normalized * mapWidth,
    y: dbPin.y_normalized * mapHeight,
    label: dbPin.name,
    name: dbPin.name,
    color: dbPin.pin_types?.color || '#FF0000',
    pin_type_id: dbPin.pin_type_id,
    pin_type: dbPin.pin_types,
    pin_types: dbPin.pin_types,
    description: dbPin.description || undefined,
    map_id: dbPin.map_id,
    is_visible: dbPin.is_visible,
    x_normalized: dbPin.x_normalized,
    y_normalized: dbPin.y_normalized
  };
}

export function convertPinToDatabasePin(pin: Pin, mapId: string, mapWidth: number, mapHeight: number): Partial<DatabasePin> {
  return {
    map_id: mapId,
    pin_type_id: pin.pin_type_id,
    name: pin.label || pin.name || 'Unnamed Pin',
    description: pin.description || null,
    x_normalized: pin.x_normalized || (pin.x / mapWidth),
    y_normalized: pin.y_normalized || (pin.y / mapHeight),
    is_visible: pin.is_visible !== false
  };
}
