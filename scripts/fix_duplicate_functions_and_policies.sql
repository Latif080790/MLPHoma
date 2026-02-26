-- ============================================================
-- Fix Duplicate Functions & Policies
-- Date: 2026-02-27
-- Purpose: Clean up old function and duplicate policies
-- ============================================================

-- WARNING: Run these queries ONE BY ONE in Supabase SQL Editor
-- DO NOT run all at once!

-- ============================================================
-- STEP 1: Check which function is being used
-- ============================================================

-- Find policies using OLD function (should be 0)
SELECT 
  tablename,
  policyname,
  'OLD function (UUID)' as function_type
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    qual LIKE '%is_project_member(projects.id)%' OR
    qual LIKE '%is_project_member(project_id)%' OR
    with_check LIKE '%is_project_member(projects.id)%' OR
    with_check LIKE '%is_project_member(project_id)%'
  );

-- Find policies using NEW function (should be many)
SELECT 
  COUNT(*) as policies_using_new_function
FROM pg_policies 
WHERE schemaname = 'public'
  AND (
    qual LIKE '%is_project_member_by_text%' OR
    with_check LIKE '%is_project_member_by_text%'
  );

-- ============================================================
-- STEP 2: Drop OLD function (if not used)
-- ============================================================

-- ONLY RUN THIS IF STEP 1 SHOWS 0 policies using old function!

-- Check function signature first
SELECT 
  proname,
  pg_get_function_identity_arguments(oid) as signature
FROM pg_proc 
WHERE proname LIKE '%is_project_member%'
ORDER BY proname;

-- Drop old function (TEXT version - this is the wrong one if it exists with wrong signature)
-- DROP FUNCTION IF EXISTS public.is_project_member(p_id text);

-- Drop old function (UUID version - if it exists)
-- DROP FUNCTION IF EXISTS public.is_project_member(uuid);

-- UNCOMMENT AND RUN ONLY AFTER VERIFYING NO POLICIES USE IT!

-- ============================================================
-- STEP 3: Find duplicate policies in problem tables
-- ============================================================

-- Check ahsp_price_history (14 policies, expected 4-6)
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual LIKE '%is_project_member_by_text%' THEN '✅ NEW function'
    WHEN qual LIKE '%is_project_member(%' THEN '⚠️ OLD function'
    WHEN qual = '' OR qual IS NULL THEN 'No USING clause'
    ELSE 'Other'
  END as function_used,
  qual as using_clause,
  with_check as with_check_clause
FROM pg_policies 
WHERE tablename = 'ahsp_price_history'
ORDER BY cmd, policyname;

-- Check notifications (11 policies, expected 4-6)
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual LIKE '%is_project_member_by_text%' THEN '✅ NEW function'
    WHEN qual LIKE '%is_project_member(%' THEN '⚠️ OLD function'
    WHEN qual LIKE '%is_admin%' THEN '👑 Admin-only'
    ELSE 'Other'
  END as function_used,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'notifications'
ORDER BY cmd, policyname;

-- Check wbs_items (11 policies, expected 4-6)
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual LIKE '%is_project_member_by_text%' THEN '✅ NEW function'
    WHEN qual LIKE '%is_project_member(%' THEN '⚠️ OLD function'
    ELSE 'Other'
  END as function_used,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'wbs_items'
ORDER BY cmd, policyname;

-- Check purchase_orders (11 policies, expected 4-6)
SELECT 
  policyname,
  cmd as operation,
  CASE 
    WHEN qual LIKE '%is_project_member_by_text%' THEN '✅ NEW function'
    WHEN qual LIKE '%is_project_member(%' THEN '⚠️ OLD function'
    ELSE 'Other'
  END as function_used,
  qual as using_clause
FROM pg_policies 
WHERE tablename = 'purchase_orders'
ORDER BY cmd, policyname;

-- ============================================================
-- STEP 4: Identify exact duplicates
-- ============================================================

-- Find policies with same table + operation + similar names
WITH policy_analysis AS (
  SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
      WHEN policyname LIKE '%_old%' OR policyname LIKE '%backup%' THEN '⚠️ Likely duplicate (old)'
      WHEN policyname LIKE '%_new%' OR policyname LIKE '%_2' THEN '⚠️ Likely duplicate (new)'
      WHEN policyname LIKE '%temp%' OR policyname LIKE '%test%' THEN '🗑️ Test policy'
      ELSE '✅ Legit'
    END as status
  FROM pg_policies 
  WHERE tablename IN ('ahsp_price_history', 'notifications', 'wbs_items', 'purchase_orders')
)
SELECT * FROM policy_analysis
WHERE status != '✅ Legit'
ORDER BY tablename, cmd;

-- ============================================================
-- STEP 5: Safe deletion template
-- ============================================================

/*
AFTER IDENTIFYING DUPLICATES FROM STEP 3-4, USE THIS TEMPLATE:

-- Delete duplicate policy (example)
DROP POLICY IF EXISTS "policy_name_here" ON public.table_name_here;

IMPORTANT:
1. Only drop policies marked as OLD, temp, test, or clear duplicates
2. Keep policies using is_project_member_by_text
3. Test after each deletion
4. Document deletions below:

DELETION LOG:
- [ ] Date: ____ | Table: ____ | Policy: ____ | Reason: ____
- [ ] Date: ____ | Table: ____ | Policy: ____ | Reason: ____
- [ ] Date: ____ | Table: ____ | Policy: ____ | Reason: ____
*/

-- ============================================================
-- STEP 6: Verify cleanup
-- ============================================================

-- Count policies per table after cleanup
SELECT 
  tablename,
  COUNT(*) as policy_count,
  CASE 
    WHEN COUNT(*) > 10 THEN '⚠️ Still too many'
    WHEN COUNT(*) BETWEEN 4 AND 9 THEN '✅ Normal'
    WHEN COUNT(*) < 4 THEN '⚠️ Too few (might be broken)'
    ELSE '?'
  END as status
FROM pg_policies 
WHERE schemaname = 'public'
  AND tablename IN ('ahsp_price_history', 'notifications', 'wbs_items', 'purchase_orders')
GROUP BY tablename
ORDER BY policy_count DESC;

-- Final count
SELECT 
  COUNT(*) as total_policies,
  COUNT(*) FILTER (WHERE tablename IN ('ahsp_price_history', 'notifications', 'wbs_items', 'purchase_orders')) as problem_table_policies
FROM pg_policies 
WHERE schemaname = 'public';

-- ============================================================
-- INTERPRETATION GUIDE
-- ============================================================

/*
EXPECTED RESULTS AFTER CLEANUP:

1. Old function DROPPED:
   - is_project_member (text) should NOT exist
   - Only is_project_member_by_text should exist

2. Policy counts normalized:
   - ahsp_price_history: 4-6 policies (down from 14)
   - notifications: 4-6 policies (down from 11)
   - wbs_items: 4-6 policies (down from 11)
   - purchase_orders: 4-6 policies (down from 11)

3. Total policies reduced:
   - From: ~566 policies
   - To: ~520-540 policies (delete ~26-46 duplicate policies)

4. All policies should use:
   - is_project_member_by_text(TEXT) ✅
   - NOT is_project_member(UUID) ❌

SAFETY RULES:

✅ SAFE TO DELETE:
- Policies named with "_old", "_backup", "_temp", "_test"
- Policies using old function is_project_member(UUID)
- Obvious duplicates with same USING clause

❌ DO NOT DELETE:
- Policies using is_project_member_by_text
- Policies with unique USING/WITH CHECK logic
- Admin-only policies (is_admin)
- If unsure, ASK FIRST!
*/
