#  SQL Editor Cleanup Checklist
**Total Queries: 101 private queries**  
**Goal: Delete obsolete queries, keep active utilities**

---

##  STEP 1: Run Verification Script
Before deleting anything, run verification:

1. Open Supabase Dashboard  SQL Editor
2. Create new query, paste content from: `scripts\verify_sql_editor_cleanup.sql`
3. Run each section (1-8) separately
4. Save results for reference
## 🚨 CRITICAL FINDINGS (Feb 27, 2026)

### ⚠️ Old Function Still Exists!
**Problem:** `is_project_member` (old function) not dropped from database
- Expected: Only `is_project_member_by_text` should exist
- Found: Both old AND new functions exist
- **Action Required:** Run `scripts\fix_duplicate_functions_and_policies.sql` STEP 1-2

### ⚠️ Duplicate Policies Found (4 Tables)
**Problem:** Tables with excessive policies (likely duplicates)
```
ahsp_price_history:  14 policies (expected 4-6) → ~8 duplicates
notifications:       11 policies (expected 4-6) → ~5 duplicates  
wbs_items:          11 policies (expected 4-6) → ~5 duplicates
purchase_orders:    11 policies (expected 4-6) → ~5 duplicates
Total: ~23 duplicate policies to remove
```
- **Action Required:** Run `scripts\fix_duplicate_functions_and_policies.sql` STEP 3-5
---

##  PHASE 1: Safe to Delete (High Confidence)
These queries are **already migrated** to files  100% safe to delete

### Migration-Based Queries (Already in Files)
- [ ] **"Migrate to is_project_member_by_text"**  
   File: `supabase/migrations/20260226_migrate_to_is_project_member_by_text.sql`  
   Status:  Applied to production  
   Action: DELETE from SQL Editor

- [ ] **"Fix AHSP creation logs RLS"**  
   File: `supabase/migrations/20260226_fix_ahsp_creation_logs_rls.sql`  
   Status:  Applied, verified 4 policies exist  
   Action: DELETE from SQL Editor

- [ ] **"Strict RLS policies"** (old version)  
   File: Archived as `_archive/migrations/SUPERSEDED_20260223_strict_rls.sql`  
   Reason: Superseded by newer migration  
   Action: DELETE from SQL Editor

- [ ] **"Nuclear repair"** / "disable RLS"  
   File: Archived as `_archive/migrations/DANGEROUS_20260218_nuclear_repair.sql`  
   Reason: Dangerous, never re-apply  
   Action: DELETE from SQL Editor

- [ ] **"Debug projects visibility"**  
   File: Was `028_temp_debug_projects.sql` (now deleted)  
   Reason: One-time debug query  
   Action: DELETE from SQL Editor

### One-Time Verification Queries
- [ ] **"Verify migration 20260226"**  
   Purpose: Checked if migration applied  
   Result: Already verified   
   Action: DELETE

- [ ] **"Count policies per table"**  
   Purpose: Audit RLS policies  
   Result: Completed, logged in reports  
   Action: DELETE

- [ ] **"Check function exists"**  
   Purpose: Verify is_project_member_by_text  
   Result:  Confirmed in production  
   Action: DELETE

---

##  PHASE 2: Review & Delete (Check First)
Review these before deleting - might have unique logic

### Potential Duplicates
- [ ] **Multiple "List all policies"** queries  
   Action: Keep 1 latest, delete older versions  
   How: Check creation date, keep newest

- [ ] **Multiple "Check RLS status"** queries  
   Action: Keep 1, delete duplicates

- [ ] **Similar schema audit queries**  
   Action: Consolidate into 1 query, delete rest

### Superseded Queries
- [ ] **Queries using old function "is_project_member(UUID)"**  
   Reason: Function replaced with is_project_member_by_text(TEXT)  
   Action: DELETE (no longer valid)

- [ ] **Old "Fix" queries dated before 2026-02-26**  
   Check: If newer fix exists  DELETE old  
   Keep: Latest version only

### Test/Debug Queries
- [ ] **"Test RLS"** / "Debug RLS"** queries  
   Review: One-time test or reusable?  
   If one-time  DELETE  
   If reusable  Keep 1 best version

---

##  PHASE 3: Keep (Do NOT Delete)
These are **active utilities** - keep them

### Active Monitoring Queries
- [ ] **"Check database health"**  KEEP  
   Reason: Reusable monitoring query  
   Used for: Regular system checks

- [ ] **"List all security functions"**  KEEP  
   Reason: Audit utility  
   Used for: Security reviews

- [ ] **"Audit RLS policies summary"**  KEEP  
   Reason: Quick overview tool  
   Used for: Regular audits

### Utility Queries
- [ ] **"Count records by table"**  KEEP  
   Reason: Database statistics  
   Used for: Monitoring data growth

- [ ] **"Check migration status"**  KEEP  
   Reason: Track what's applied  
   Used for: Deployment verification

### Recent Work in Progress
- [ ] **Queries dated 2026-02-27 or later**  KEEP  
   Reason: Current work  
   Review: After 1 week, evaluate if still needed

---

##  Execution Guide

### Before Deleting
1.  Run verification script (`scripts\verify_sql_editor_cleanup.sql`)
2.  Check if migration file exists for the query
3.  Verify migration was applied via query results

### How to Delete in SQL Editor
1. Open Supabase Dashboard  SQL Editor
2. Find query by name/content
3. Click "..." menu  Delete
4. Confirm deletion
5. Check box in this list 

### Safety Rules
-  DO NOT delete if unsure
-  DO NOT delete queries dated < 1 week old
-  DO delete if migration file exists AND applied
-  DO delete obvious duplicates
-  DO keep monitoring/utility queries

### Progress Tracking
`
Phase 1: ___ / ~15 deleted (Safe)
Phase 2: ___ / ~30 deleted (Reviewed)
Phase 3: ___ / ~10 kept (Active)
Remaining: ___ queries
`

---

##  Expected Final State
After cleanup:
- **Remaining: ~20-30 queries** (useful utilities + recent work)
- **Deleted: ~70-80 queries** (migrated + obsolete)
- **Organized: By category** (Monitoring, Utilities, Work in Progress)

---

##  Quick Reference: Migration Files
Cross-check with these existing migration files:

\\\
supabase/migrations/
 20260226_migrate_to_is_project_member_by_text.sql 
 20260226_fix_ahsp_creation_logs_rls.sql 
 20260218_add_budget_locking.sql
 20260217_gap_matrix_v2_rollout.sql
 20260216_add_change_order_tables.sql
... (52 total files)

_archive/migrations/
 DANGEROUS_20260218_nuclear_repair.sql 
 SUPERSEDED_20260223_strict_rls.sql 
\\\

If a saved query matches a migration filename  **Safe to DELETE**

---

##  Verification After Cleanup
Run this query to confirm database is healthy:

\\\sql
-- Quick health check
SELECT 
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
  (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%project_member%') as security_funcs,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) as rls_enabled_tables;
\\\

Expected:
- total_policies: 150-200
- security_funcs: 1 (is_project_member_by_text)
- rls_enabled_tables: 40-50

---

**Date Created:** 2026-02-27 01:59  
**Purpose:** Clean up 101 private SQL Editor queries  
**Strategy:** Delete migrated/obsolete, keep active utilities
