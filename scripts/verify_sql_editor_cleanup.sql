-- ============================================================
-- Supabase SQL Editor Cleanup Verification Script
-- Date: 2026-02-27
-- Purpose: Help identify which saved queries are obsolete
-- ============================================================

-- NOTE: Run these queries in Supabase SQL Editor to verify
-- what can be safely deleted

-- ============================================================
-- 1. CHECK MIGRATION STATUS
-- ============================================================

-- First, find where migrations are tracked
-- Run this to see available schemas:
SELECT schema_name 
FROM information_schema.schemata 
WHERE schema_name LIKE '%migration%' 
   OR schema_name LIKE '%supabase%'
ORDER BY schema_name;

-- Then check for migration tables:
SELECT 
  schemaname, 
  tablename 
FROM pg_tables 
WHERE tablename LIKE '%migration%' 
   OR tablename LIKE '%schema_version%'
ORDER BY schemaname, tablename;

-- SKIP THIS SECTION IF NO MIGRATION TABLE FOUND
-- This is optional - Supabase may not expose migration history
-- The important checks are in sections 2-8 below

-- ============================================================
-- 2. CURRENT RLS POLICIES AUDIT
-- ============================================================

-- Count policies per table to see current state
SELECT 
  schemaname,
  tablename,
  COUNT(*) as total_policies,
  COUNT(*) FILTER (WHERE cmd = 'SELECT') as select_policies,
  COUNT(*) FILTER (WHERE cmd = 'INSERT') as insert_policies,
  COUNT(*) FILTER (WHERE cmd = 'UPDATE') as update_policies,
  COUNT(*) FILTER (WHERE cmd = 'DELETE') as delete_policies
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY total_policies DESC;

-- ============================================================
-- 3. CHECK SECURITY FUNCTIONS
-- ============================================================

-- List all security-related functions
SELECT 
  proname as function_name,
  pronargs as num_arguments,
  pg_get_function_identity_arguments(oid) as arguments,
  CASE 
    WHEN proname LIKE '%is_project_member%' THEN ' Project Security'
    WHEN proname LIKE '%is_admin%' THEN ' Admin Check'
    WHEN proname LIKE '%has_role%' THEN ' Role Check'
    ELSE 'Other'
  END as category
FROM pg_proc 
WHERE pronamespace = 'public'::regnamespace
  AND (
    proname LIKE '%project_member%' OR
    proname LIKE '%is_admin%' OR
    proname LIKE '%has_role%' OR
    proname LIKE '%security%' OR
    proname LIKE '%permission%'
  )
ORDER BY proname;

-- ============================================================
-- 4. TABLES WITH RLS ENABLED
-- ============================================================

-- Check which tables have RLS active
SELECT 
  schemaname,
  tablename,
  CASE 
    WHEN rowsecurity THEN ' RLS Enabled'
    ELSE ' RLS Disabled'
  END as rls_status
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY tablename;

-- ============================================================
-- 5. FIND POTENTIAL DUPLICATE POLICIES
-- ============================================================

-- Find tables with many policies (might have duplicates)
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) > 10 THEN ' Many policies - check for duplicates'
    WHEN COUNT(*) > 5 THEN 'Normal'
    ELSE 'Few policies'
  END as status
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY tablename
HAVING COUNT(*) > 3
ORDER BY policy_count DESC;

-- ============================================================
-- 6. CHECK SPECIFIC MIGRATIONS (Already Applied?)
-- ============================================================

-- Check if key migrations are applied
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc 
      WHERE proname = 'is_project_member_by_text'
    ) THEN ' NEW function exists (20260226 migration applied)'
    ELSE ' OLD function still in use'
  END as function_migration_status,
  
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'ahsp_creation_logs' 
        AND policyname = 'View AHSP creation logs'
    ) THEN ' AHSP RLS fix applied (20260226)'
    ELSE ' AHSP RLS not fixed'
  END as ahsp_rls_status,
  
  (
    SELECT COUNT(*) 
    FROM pg_policies 
    WHERE qual LIKE '%is_project_member_by_text%'
  ) as policies_using_new_function;

-- ============================================================
-- 7. SPECIFIC QUERY VERIFICATION
-- ============================================================

-- Verify AHSP creation logs policies (should be 4)
SELECT 
  policyname,
  cmd as operation,
  ' Keep in DB' as status
FROM pg_policies 
WHERE tablename = 'ahsp_creation_logs'
ORDER BY cmd;

-- Expected: 4 policies
-- If you see these 4, the saved query can be deleted from SQL Editor

-- ============================================================
-- 8. SUMMARY REPORT
-- ============================================================

SELECT 
  'Database Health Check' as report_type,
  (
    SELECT COUNT(*) 
    FROM pg_tables 
    WHERE schemaname = 'public' AND rowsecurity = true
  ) as tables_with_rls,
  (
    SELECT COUNT(*) 
    FROM pg_policies 
    WHERE schemaname = 'public'
  ) as total_policies,
  (
    SELECT COUNT(*) 
    FROM pg_proc 
    WHERE pronamespace = 'public'::regnamespace
      AND proname LIKE '%project%'
  ) as security_functions;

-- ============================================================
-- INTERPRETATION GUIDE
-- ============================================================

/*
HOW TO USE THIS SCRIPT:

1. Run each section separately in SQL Editor

2. Compare results with migration files:
   - If migration file exists AND query shows it's applied
    Safe to delete saved query from SQL Editor

3. Check for duplicates:
   - If same query exists in multiple saved queries
    Delete duplicates, keep latest

4. Verify critical functions:
   - is_project_member_by_text should exist
   - is_project_member (old) should NOT exist
   - If results match  migrations successful, delete old queries

5. Safety checks:
   - RLS should be enabled on project tables
   - Each main table should have 3-6 policies
   - Security functions should be present

DELETION CRITERIA:

 DELETE from SQL Editor if:
   - Query exists as migration file (.sql)
   - Query was one-time verification/audit
   - Query shows "completed" status
   - Query is duplicate

 KEEP in SQL Editor if:
   - Query is actively used for monitoring
   - Query is reusable utility
   - Query has unique logic not in migrations
*/
