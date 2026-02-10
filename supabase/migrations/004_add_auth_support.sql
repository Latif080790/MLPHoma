-- ============================================================
-- Migration: 004_add_auth_support.sql
-- Purpose: Add authentication support, profiles table, and RLS policies
-- Idempotent: Uses IF NOT EXISTS and DROP IF EXISTS patterns
-- ============================================================

-- 1. Add user_id column to projects table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE public.projects
    ADD COLUMN user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- 2. Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  avatar_url text,
  role text DEFAULT 'user' CHECK (role IN ('admin', 'manager', 'user')),
  company text,
  phone text,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

-- Enable RLS on profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for profiles: users can only access their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- 3. Create handle_new_user trigger function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 4. Drop dev-only public policies
DROP POLICY IF EXISTS "Allow public all projects" ON public.projects;
DROP POLICY IF EXISTS "Allow public all wbs_items" ON public.wbs_items;
DROP POLICY IF EXISTS "Allow public all timeline_tasks" ON public.timeline_tasks;
DROP POLICY IF EXISTS "Allow public all task_dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "Allow public all rap_data" ON public.rap_data;
DROP POLICY IF EXISTS "Allow public select resources" ON public.rab_items;
DROP POLICY IF EXISTS "Allow public insert resources" ON public.rab_items;
DROP POLICY IF EXISTS "Allow public update resources" ON public.rab_items;
DROP POLICY IF EXISTS "Allow public delete resources" ON public.rab_items;

-- 5. Create production RLS policies for projects
DROP POLICY IF EXISTS "Users can view own projects" ON public.projects;
CREATE POLICY "Users can view own projects" ON public.projects
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own projects" ON public.projects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own projects" ON public.projects
  FOR DELETE USING (auth.uid() = user_id);

-- 6. Create RLS policies for wbs_items (check project ownership)
DROP POLICY IF EXISTS "Users can view own wbs_items" ON public.wbs_items;
CREATE POLICY "Users can view own wbs_items" ON public.wbs_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = wbs_items.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own wbs_items" ON public.wbs_items;
CREATE POLICY "Users can insert own wbs_items" ON public.wbs_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = wbs_items.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own wbs_items" ON public.wbs_items;
CREATE POLICY "Users can update own wbs_items" ON public.wbs_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = wbs_items.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own wbs_items" ON public.wbs_items;
CREATE POLICY "Users can delete own wbs_items" ON public.wbs_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = wbs_items.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- 7. Create RLS policies for timeline_tasks (check project ownership)
DROP POLICY IF EXISTS "Users can view own timeline_tasks" ON public.timeline_tasks;
CREATE POLICY "Users can view own timeline_tasks" ON public.timeline_tasks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timeline_tasks.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own timeline_tasks" ON public.timeline_tasks;
CREATE POLICY "Users can insert own timeline_tasks" ON public.timeline_tasks
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timeline_tasks.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own timeline_tasks" ON public.timeline_tasks;
CREATE POLICY "Users can update own timeline_tasks" ON public.timeline_tasks
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timeline_tasks.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own timeline_tasks" ON public.timeline_tasks;
CREATE POLICY "Users can delete own timeline_tasks" ON public.timeline_tasks
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = timeline_tasks.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- 8. Create RLS policies for task_dependencies (check project ownership)
DROP POLICY IF EXISTS "Users can view own task_dependencies" ON public.task_dependencies;
CREATE POLICY "Users can view own task_dependencies" ON public.task_dependencies
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = task_dependencies.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own task_dependencies" ON public.task_dependencies;
CREATE POLICY "Users can insert own task_dependencies" ON public.task_dependencies
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = task_dependencies.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own task_dependencies" ON public.task_dependencies;
CREATE POLICY "Users can update own task_dependencies" ON public.task_dependencies
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = task_dependencies.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own task_dependencies" ON public.task_dependencies;
CREATE POLICY "Users can delete own task_dependencies" ON public.task_dependencies
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = task_dependencies.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- 9. Create RLS policies for rap_data (check project ownership)
DROP POLICY IF EXISTS "Users can view own rap_data" ON public.rap_data;
CREATE POLICY "Users can view own rap_data" ON public.rap_data
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = rap_data.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own rap_data" ON public.rap_data;
CREATE POLICY "Users can insert own rap_data" ON public.rap_data
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = rap_data.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own rap_data" ON public.rap_data;
CREATE POLICY "Users can update own rap_data" ON public.rap_data
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = rap_data.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own rap_data" ON public.rap_data;
CREATE POLICY "Users can delete own rap_data" ON public.rap_data
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = rap_data.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- 10. Create RLS policies for rab_items (check project ownership)
DROP POLICY IF EXISTS "Users can view own rab_items" ON public.rab_items;
CREATE POLICY "Users can view own rab_items" ON public.rab_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = rab_items.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert own rab_items" ON public.rab_items;
CREATE POLICY "Users can insert own rab_items" ON public.rab_items
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = rab_items.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update own rab_items" ON public.rab_items;
CREATE POLICY "Users can update own rab_items" ON public.rab_items
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = rab_items.project_id
      AND projects.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete own rab_items" ON public.rab_items;
CREATE POLICY "Users can delete own rab_items" ON public.rab_items
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = rab_items.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Note: Keep existing public policies on resources, ahsp_items, and ahsp_components
-- as these are shared reference data that should be accessible to all authenticated users.
