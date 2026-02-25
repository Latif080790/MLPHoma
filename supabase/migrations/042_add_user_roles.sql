-- Migration: 042_add_user_roles.sql
-- Description: Add roles to profiles and configure registration trigger.

-- 1. Ensure the 'role' column exists in public.profiles.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role text;

-- 2. Drop the existing trigger and function if they exist to allow clean replacement.
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Create or replace the function to handle new auth users.
-- This function reads the 'role' from raw_user_meta_data if provided.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'full_name',
    -- Default to 'ENGINEER' if no role is explicitly provided during registration
    COALESCE(new.raw_user_meta_data->>'role', 'ENGINEER')
  );
  RETURN new;
END;
$$;

-- 4. Re-create the trigger.
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
