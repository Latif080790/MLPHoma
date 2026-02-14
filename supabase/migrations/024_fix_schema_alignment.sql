-- 024_fix_schema_alignment.sql
-- Purpose: Align database schema with application code expectations.
-- Fixes:
--   1. Ensure risks table has probability/impact/risk_score columns
--   2. Ensure profiles table has a permissive read policy for authenticated users
--   3. Ensure timeline_tasks RLS allows public access (dev)
--   4. Ensure risks table has public dev policy

-- ============================================================
-- 1. Ensure risks table has the correct columns
-- ============================================================
DO $$
BEGIN
  -- Add probability if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'probability'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN probability integer DEFAULT 1 CHECK (probability >= 1 AND probability <= 5);
  END IF;

  -- Add impact if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'impact'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN impact integer DEFAULT 1 CHECK (impact >= 1 AND impact <= 5);
  END IF;

  -- Add risk_score if missing (NOT generated — we compute it in a trigger instead, since generated columns require base cols to exist first)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'risk_score'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN risk_score integer DEFAULT 1;
  END IF;

  -- Add description if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN description text;
  END IF;

  -- Add category if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'category'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN category text;
  END IF;

  -- Add mitigation_plan if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'mitigation_plan'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN mitigation_plan text;
  END IF;

  -- Add owner if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'owner'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN owner text;
  END IF;

  -- Add status if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'risks' AND column_name = 'status'
  ) THEN
    ALTER TABLE public.risks ADD COLUMN status text DEFAULT 'OPEN';
  END IF;
END $$;

-- Backfill risk_score from probability * impact for any existing rows
UPDATE public.risks SET risk_score = COALESCE(probability, 1) * COALESCE(impact, 1)
WHERE risk_score IS NULL OR risk_score = 1;

-- Create trigger to auto-calculate risk_score on insert/update
CREATE OR REPLACE FUNCTION public.calc_risk_score()
RETURNS TRIGGER AS $$
BEGIN
  NEW.risk_score := COALESCE(NEW.probability, 1) * COALESCE(NEW.impact, 1);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_calc_risk_score ON public.risks;
CREATE TRIGGER trg_calc_risk_score
  BEFORE INSERT OR UPDATE OF probability, impact ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.calc_risk_score();

-- ============================================================
-- 2. Ensure profiles table exists, then fix RLS
-- ============================================================
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

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can manage their own profile
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Also allow all authenticated users to read (for team features)
DROP POLICY IF EXISTS "Allow authenticated read profiles" ON public.profiles;
CREATE POLICY "Allow authenticated read profiles" ON public.profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Auto-create profile on new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- 3. Re-add public dev policies for timeline_tasks if missing
-- ============================================================
DROP POLICY IF EXISTS "Allow public all timeline_tasks" ON public.timeline_tasks;
CREATE POLICY "Allow public all timeline_tasks" ON public.timeline_tasks
  FOR ALL USING (true);

-- ============================================================
-- 4. Ensure risks table has public dev policy
-- ============================================================
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public all risks" ON public.risks;
CREATE POLICY "Allow public all risks" ON public.risks
  FOR ALL USING (true);

-- ============================================================
-- 5. Add missing columns to timeline_tasks
-- ============================================================
DO $$
BEGIN
  -- priority
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'timeline_tasks' AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.timeline_tasks ADD COLUMN priority text DEFAULT 'medium';
  END IF;

  -- dependencies
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'timeline_tasks' AND column_name = 'dependencies'
  ) THEN
    ALTER TABLE public.timeline_tasks ADD COLUMN dependencies jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- rab_id
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'timeline_tasks' AND column_name = 'rab_id'
  ) THEN
    ALTER TABLE public.timeline_tasks ADD COLUMN rab_id text;
  END IF;

  -- baseline_start_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'timeline_tasks' AND column_name = 'baseline_start_date'
  ) THEN
    ALTER TABLE public.timeline_tasks ADD COLUMN baseline_start_date date;
  END IF;

  -- baseline_end_date
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'timeline_tasks' AND column_name = 'baseline_end_date'
  ) THEN
    ALTER TABLE public.timeline_tasks ADD COLUMN baseline_end_date date;
  END IF;

  -- assigned_resources
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'timeline_tasks' AND column_name = 'assigned_resources'
  ) THEN
    ALTER TABLE public.timeline_tasks ADD COLUMN assigned_resources jsonb DEFAULT '[]'::jsonb;
  END IF;

  -- description
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'timeline_tasks' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.timeline_tasks ADD COLUMN description text;
  END IF;
END $$;

-- ============================================================
-- 6. Backfill profiles for existing auth users
-- ============================================================
INSERT INTO public.profiles (id, full_name, updated_at)
SELECT id, COALESCE(raw_user_meta_data->>'full_name', email), NOW()
FROM auth.users
WHERE id NOT IN (SELECT id FROM public.profiles)
ON CONFLICT (id) DO NOTHING;
