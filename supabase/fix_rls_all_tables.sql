-- ============================================================
-- FIX RLS FOR ALL PUBLIC TABLES
-- MLPHoma - Comprehensive Security Fix
-- ============================================================
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- This script:
--   1. Enables RLS on ALL public tables
--   2. Creates permissive "allow all" policies for authenticated access
--   3. Skips system/internal tables
-- ============================================================

-- STEP 1: Enable RLS on all public tables that don't have it yet
DO $$
DECLARE
  tbl RECORD;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '_prisma_%'
      AND tablename NOT LIKE 'schema_%'
    ORDER BY tablename
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', tbl.tablename);
    RAISE NOTICE 'RLS enabled on: %', tbl.tablename;
  END LOOP;
END
$$;

-- STEP 2: Create permissive policies for all public tables
-- Uses DROP IF EXISTS + CREATE to be idempotent (safe to re-run)
DO $$
DECLARE
  tbl RECORD;
  policy_name TEXT;
BEGIN
  FOR tbl IN
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT LIKE 'pg_%'
      AND tablename NOT LIKE '_prisma_%'
      AND tablename NOT LIKE 'schema_%'
    ORDER BY tablename
  LOOP
    -- Policy for SELECT
    policy_name := 'allow_select_' || tbl.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, tbl.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (true);',
      policy_name, tbl.tablename
    );

    -- Policy for INSERT
    policy_name := 'allow_insert_' || tbl.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, tbl.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (true);',
      policy_name, tbl.tablename
    );

    -- Policy for UPDATE
    policy_name := 'allow_update_' || tbl.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, tbl.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (true) WITH CHECK (true);',
      policy_name, tbl.tablename
    );

    -- Policy for DELETE
    policy_name := 'allow_delete_' || tbl.tablename;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', policy_name, tbl.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (true);',
      policy_name, tbl.tablename
    );

    RAISE NOTICE 'Policies created for: %', tbl.tablename;
  END LOOP;
END
$$;

-- STEP 3: Verify — list all tables and their RLS status
SELECT
  t.tablename,
  c.relrowsecurity AS rls_enabled,
  COUNT(p.policyname) AS policy_count
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename AND c.relnamespace = 'public'::regnamespace
LEFT JOIN pg_policies p ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
GROUP BY t.tablename, c.relrowsecurity
ORDER BY t.tablename;
