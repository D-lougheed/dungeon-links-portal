
-- Create a table for custom region types
CREATE TABLE public.region_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL UNIQUE,
  color text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add Row Level Security (RLS)
ALTER TABLE public.region_types ENABLE ROW LEVEL SECURITY;

-- Create policies for region types
-- For now, let's make region types visible to all authenticated users
-- but only DMs can create/modify them
CREATE POLICY "Anyone can view active region types" 
  ON public.region_types 
  FOR SELECT 
  TO authenticated
  USING (is_active = true);

CREATE POLICY "DMs can create region types" 
  ON public.region_types 
  FOR INSERT 
  TO authenticated
  WITH CHECK (public.is_dm());

CREATE POLICY "DMs can update region types" 
  ON public.region_types 
  FOR UPDATE 
  TO authenticated
  USING (public.is_dm());

CREATE POLICY "DMs can delete region types" 
  ON public.region_types 
  FOR DELETE 
  TO authenticated
  USING (public.is_dm());

-- Create trigger to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_region_types_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER handle_region_types_updated_at
  BEFORE UPDATE ON public.region_types
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_region_types_updated_at();
