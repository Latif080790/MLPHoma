-- Migration: 043_fix_role_constraint_error.sql
-- Description: Drop the restrictive CHECK constraint on the profiles table 
-- that was causing signup 500 errors when inserting 'PROJECT_MANAGER' or 'ENGINEER'.

-- 1. Find and drop the check constraint on the role column.
-- In PostgreSQL, constraints are typically named table_column_check. 
-- Since it was added inside a CREATE TABLE, it might be auto-named.
-- The safest way to drop the constraint without knowing its name is via PL/pgSQL.
DO $$ 
DECLARE 
  constraint_name text;
BEGIN
  -- Find the constraint named on the `role` column in `public.profiles`
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  INNER JOIN pg_class rel ON rel.oid = con.conrelid
  INNER JOIN pg_namespace nsp ON nsp.oid = con.connamespace
  INNER JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = ANY(con.conkey)
  WHERE nsp.nspname = 'public' 
    AND rel.relname = 'profiles' 
    AND att.attname = 'role' 
    AND con.contype = 'c';

  IF constraint_name IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public.profiles DROP CONSTRAINT ' || quote_ident(constraint_name);
  END IF;
END $$;

-- 2. Modify the role column to simply be TEXT without the restrictive check.
-- We also ensure it can hold our enterprise roles.
-- Optional: If you strictly want a new CHECK, you can add it, but for a fast-evolving MVP, relying on the application UI (Select box) is fine.
-- Let's just create a looser check constraint.
ALTER TABLE public.profiles 
  ADD CONSTRAINT profiles_role_check 
  CHECK (role IN ('ADMIN', 'PROJECT_MANAGER', 'QC_ENGINEER', 'FINANCE', 'ENGINEER', 'admin', 'manager', 'user'));

-- 3. Restore/Update the trigger to ensure it works properly with the new roles.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, role)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'ENGINEER')
  );
  RETURN new;
END;
$$;
