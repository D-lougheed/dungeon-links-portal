
-- Create a table to track user invitations
CREATE TABLE public.user_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role app_role NOT NULL,
  invited_by UUID REFERENCES auth.users(id) NOT NULL,
  invitation_token UUID DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email, role)
);

-- Enable RLS on user_invitations
ALTER TABLE public.user_invitations ENABLE ROW LEVEL SECURITY;

-- Policy: Only DMs can manage invitations
CREATE POLICY "DMs can manage user invitations"
ON public.user_invitations
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() AND role = 'dm'
  )
);

-- Add is_active column to profiles table for user deactivation
ALTER TABLE public.profiles ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;

-- Create function to check if user is admin/dm
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'dm'
  )
$$;

-- Create function to deactivate user
CREATE OR REPLACE FUNCTION public.deactivate_user(target_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow DMs to deactivate users
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can deactivate users';
  END IF;
  
  -- Prevent DMs from deactivating themselves
  IF target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot deactivate your own account';
  END IF;
  
  -- Update the user's active status
  UPDATE public.profiles
  SET is_active = false
  WHERE id = target_user_id;
  
  RETURN FOUND;
END;
$$;

-- Create function to reactivate user
CREATE OR REPLACE FUNCTION public.reactivate_user(target_user_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only allow DMs to reactivate users
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only administrators can reactivate users';
  END IF;
  
  -- Update the user's active status
  UPDATE public.profiles
  SET is_active = true
  WHERE id = target_user_id;
  
  RETURN FOUND;
END;
$$;
