# 🗑️ Evaluasi File SQL Editor - Yang Bisa Dihapus
**Tanggal:** 27 Februari 2026  
**Total Queries di SQL Editor:** ~105 queries  
**Target:** Hapus 70-80 queries yang sudah obsolete

---

## ✅ SUDAH SELESAI (Tidak Perlu Dihapus Lagi)

### Cleanup Duplicate Policies - COMPLETED ✅
Ini sudah dikerjakan hari ini (27 Feb 2026):
- ✅ Dropped function `is_project_member(p_id text)` 
- ✅ Cleaned `ahsp_price_history`: 14→4 policies (10 deleted)
- ✅ Cleaned `notifications`: 11→4 policies (7 deleted)
- ✅ Cleaned `wbs_items`: 11→4 policies (7 deleted)
- ✅ Cleaned `purchase_orders`: 11→4 policies (7 deleted)

**Action:** Queries ini bisa DIHAPUS dari SQL Editor:
- ❌ "Find policies using OLD is_project_member function"
- ❌ "Cleanup Duplicate Row-Level Policies"
- ❌ "Cleanup Verification Script"
- ❌ "Security-related Function Inventory"

---

## 🚨 FASE 1: AMAN DIHAPUS (100% Confidence)

### A. Migration Queries (Sudah Jadi File Migration)

Query-query ini **sudah ada di folder** `supabase/migrations/`, jadi safe untuk dihapus:

#### 1. ❌ **"Migrate to is_project_member_by_text"**
- **File:** `20260226_migrate_to_is_project_member_by_text.sql`
- **Status:** ✅ Sudah applied ke production
- **Alasan:** Migration sudah berjalan, query tidak diperlukan lagi
- **Action:** DELETE dari SQL Editor

#### 2. ❌ **"Fix AHSP creation logs RLS"**
- **File:** `20260226_fix_ahsp_creation_logs_rls.sql` 
- **Status:** ✅ Sudah applied, verified working
- **Alasan:** RLS policies sudah fix (4 policies exist)
- **Action:** DELETE dari SQL Editor

#### 3. ❌ **"Notifications & Tools Automation Migration"**
- **File:** `029_notification_approval_audit.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Migration file lebih lengkap
- **Action:** DELETE dari SQL Editor

#### 4. ❌ **"AHSP Creation Logs"**
- **File:** `010_add_ahsp_creation_logs.sql`
- **Status:** ✅ Sudah applied sejak lama
- **Alasan:** Schema sudah exist di database
- **Action:** DELETE dari SQL Editor

#### 5. ❌ **"Automation: Notifications & Tool Usage Logs"**
- **File:** `035_automation_schema.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Automation tables sudah ada
- **Action:** DELETE dari SQL Editor

#### 6. ❌ **"Reinstate Strict Row-Level Security"**
- **File:** `_archive/SUPERSEDED_20260223_strict_rls.sql` (ARCHIVED!)
- **Status:** ⚠️ SUPERSEDED by newer migrations
- **Alasan:** Query ini obsolete, jangan di-run lagi
- **Action:** DELETE dari SQL Editor

#### 7. ❌ **"Enable cascade deletes for RAB/RAP/PO relationships"**
- **File:** `021_fix_rap_items_and_project_consistency.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Cascade deletes sudah working
- **Action:** DELETE dari SQL Editor

#### 8. ❌ **"Restore project_members permissions and add project-evidence bucket"**
- **File:** `036_fix_project_members_and_storage.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Permissions + storage sudah fix
- **Action:** DELETE dari SQL Editor

#### 9. ❌ **"Enforce Ownership-based RLS Across Project Schema"**
- **File:** `041_rbac_hardening.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** RBAC hardening sudah done
- **Action:** DELETE dari SQL Editor

#### 10. ❌ **"Phase 3+4 Schema Extensions: Evidence, Versioning & Members"**
- **File:** `030_fase3_4_extensions.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Schema extensions complete
- **Action:** DELETE dari SQL Editor

#### 11. ❌ **"Convert UUID IDs to TEXT and Recreate FKs"**
- **File:** `022_fix_id_types_cascade.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** ID types sudah converted
- **Action:** DELETE dari SQL Editor

#### 12. ❌ **"Normalize RAP/RAB Item IDs and Add Cost & Period Fields"**
- **File:** Multiple migrations (025, 031_fix_missing_text_ids.sql)
- **Status:** ✅ Sudah applied
- **Alasan:** Normalization complete
- **Action:** DELETE dari SQL Editor

#### 13. ❌ **"AHSP 4-Level Costing & Workflow Schema v2"**
- **File:** `019_ahsp_history_and_refinement.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** AHSP schema v2 sudah live
- **Action:** DELETE dari SQL Editor

#### 14. ❌ **"Supply & Finance v3 Schema Enhancements"**
- **File:** `010_supply_finance_v3.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** V3 enhancements complete
- **Action:** DELETE dari SQL Editor

#### 15. ❌ **"Timeline, Progress & Weather Enhancements"**
- **File:** `009_timeline_progress_v3.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Timeline v3 working
- **Action:** DELETE dari SQL Editor

#### 16. ❌ **"TKDN Items Table"** / **"TKDN Calculator Migration with Sample Data"**
- **File:** `032_tkdn_module.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** TKDN module complete
- **Action:** DELETE dari SQL Editor

#### 17. ❌ **"Multi-Zone Pricing Migration"**
- **File:** `018_zone_based_pricing.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Zone pricing working
- **Action:** DELETE dari SQL Editor

#### 18. ❌ **"Add TKDN percentage to RAB items"**
- **File:** Covered in `032_tkdn_module.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** TKDN fields exist
- **Action:** DELETE dari SQL Editor

#### 19. ❌ **"Project Archival & Status Management"**
- **File:** `016_archive_system.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Archive system working
- **Action:** DELETE dari SQL Editor

#### 20. ❌ **"Migrate Core IDs from UUID to TEXT"**
- **File:** `022_fix_id_types_cascade.sql` + `025_fix_all_remaining_id_types.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** All IDs migrated to TEXT
- **Action:** DELETE dari SQL Editor

#### 21. ❌ **"MLPHoma Mock Data Seeding V3.2"**
- **File:** `supabase/seed_mock_data.sql`
- **Status:** ✅ Ada file dedicated
- **Alasan:** Use seeding file instead
- **Action:** DELETE dari SQL Editor

#### 22. ❌ **"Schema alignment & RLS fixes"**
- **File:** `024_fix_schema_alignment.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Schema aligned
- **Action:** DELETE dari SQL Editor

#### 23. ❌ **"AHSP Row-Level Security Policies"** (yang lama)
- **File:** `20260217_fix_ahsp_policies.sql`
- **Status:** ✅ Sudah replaced dengan yang lebih baru
- **Alasan:** Policies sudah diupdate
- **Action:** DELETE dari SQL Editor

#### 24. ❌ **"Enable RLS and authenticated policies for AHSP tables"**
- **File:** Multiple migrations (019, 026, 034)
- **Status:** ✅ Sudah applied across multiple migrations
- **Alasan:** AHSP RLS complete
- **Action:** DELETE dari SQL Editor

#### 25. ❌ **"Enable pg_cron and pg_net extensions"**
- **File:** `036_enable_cron_extensions.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Extensions enabled
- **Action:** DELETE dari SQL Editor

### B. One-Time Debug/Verification Queries

Query-query ini untuk debugging sekali pakai, tidak reusable:

#### 26. ❌ **"Verify migration 20260226"**
- **Purpose:** Check if migration applied
- **Status:** ✅ Already verified (working in production)
- **Action:** DELETE - one-time check

#### 27. ❌ **"Count policies per table"**
- **Purpose:** Audit RLS policies
- **Status:** ✅ Audit complete, logged in reports
- **Action:** DELETE - one-time audit

#### 28. ❌ **"Check function exists"**
- **Purpose:** Verify `is_project_member_by_text` exists
- **Status:** ✅ Confirmed in production
- **Action:** DELETE - one-time check

#### 29. ❌ **"Debug projects visibility"**
- **Purpose:** Debug project access issues
- **Status:** ✅ Issue resolved
- **Action:** DELETE - one-time debug

#### 30. ❌ **"Production fix and AHSP price-history migration"**
- **Purpose:** Fix production errors
- **Status:** ✅ Fixed in `034_fix_production_errors.sql`
- **Action:** DELETE - already in migration file

#### 31. ❌ **"Mock Data Cleanup"**
- **Purpose:** Clear test data
- **Status:** ✅ Done, use `clear_mock_data.sql` instead
- **Action:** DELETE - jika perlu cleanup lagi, ada file dedicated

#### 32. ❌ **"Production Fixes: AHSP Price History & Unique Codes"**
- **Purpose:** Fix production bugs
- **Status:** ✅ Fixed in multiple migrations
- **Action:** DELETE - bugs sudah resolved

#### 33. ❌ **"AHSP Policy Audit"**
- **Purpose:** Audit AHSP policies
- **Status:** ✅ Audit done, cleanup complete (just now!)
- **Action:** DELETE - audit finished

#### 34. ❌ **"Policy and Function Verification"**
- **Purpose:** Verify policies after cleanup
- **Status:** ✅ Verification complete (27 Feb 2026)
- **Action:** DELETE - already verified

#### 35. ❌ **"Remove unneeded row-level policies"**
- **Purpose:** Clean duplicate policies
- **Status:** ✅ JUST COMPLETED (27 Feb 2026)
- **Action:** DELETE - cleanup done!

### C. Dangerous/Obsolete Queries

Query-query ini BERBAHAYA atau sudah obsolete:

#### 36. ❌ **"Nuclear repair"** / **"disable RLS"**
- **File:** `_archive/DANGEROUS_20260218_nuclear_repair.sql` (ARCHIVED!)
- **Status:** ⚠️ DANGEROUS - disables all RLS!
- **Alasan:** **JANGAN PERNAH DI-RUN LAGI**
- **Action:** DELETE IMMEDIATELY

#### 37. ❌ **"Mock Project Data Seed (V3.2)"** (old version)
- **Purpose:** Seed test project
- **Status:** ⚠️ Superseded by newer V3.2
- **Alasan:** Keep only latest version
- **Action:** DELETE old versions

#### 38. ❌ **"Link timeline_tasks to WBS"**
- **File:** `027_add_wbs_to_timeline.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** WBS linkage working
- **Action:** DELETE dari SQL Editor

#### 39. ❌ **"Add unit and unit_price columns to ahsp_components"**
- **File:** `026_add_ahsp_component_columns.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Columns exist
- **Action:** DELETE dari SQL Editor

#### 40. ❌ **"Migration 034 — Fix Production Errors & RLS"**
- **File:** `034_fix_production_errors.sql`
- **Status:** ✅ Sudah applied
- **Alasan:** Production errors fixed
- **Action:** DELETE dari SQL Editor

---

## ⚠️ FASE 2: REVIEW DULU (Medium Confidence)

Query-query ini perlu dicek dulu sebelum dihapus - mungkin ada logic unik:

### D. Potential Duplicates

#### 41. 🔍 **Multiple "List all policies"** queries
- **Check:** Berapa banyak query dengan nama serupa?
- **Action:** Keep 1 latest (pakai yang terbaru), DELETE sisanya
- **How:** Sort by creation date, keep newest

#### 42. 🔍 **Multiple "Check RLS status"** queries
- **Check:** Apakah ada perbedaan query logic?
- **Action:** Keep 1 best version, DELETE duplicates

#### 43. 🔍 **Similar schema audit queries**
- **Examples:** 
  - "Construction Costing & Project Management Schema"
  - "MLPHoma Resource & Pricing Schema"
  - "Schema fixes and additions"
- **Check:** Apakah ini migration atau monitoring?
- **Action:** If migration → DELETE (should be in files)
           If monitoring → Keep 1 best version

### E. Old "Fix" Queries

#### 44. 🔍 **"Fix Project ID Type & Consolidate Access/RLS"**
- **File:** `022_fix_id_types_cascade.sql` + later fixes
- **Check:** Apakah sudah covered by newer migrations?
- **Action:** If yes → DELETE, If unique logic → KEEP

#### 45. 🔍 **"Fix risk table foreign key relationships"**
- **File:** `038_fix_risk_foreign_keys.sql`
- **Check:** Sudah applied?
- **Action:** If yes → DELETE

#### 46. 🔍 **"Relax profiles.role constraint"**
- **File:** `043_fix_role_constraint_error.sql`
- **Check:** Constraint sudah fixed?
- **Action:** If yes → DELETE

#### 47. 🔍 **"Curvas Analyses Permissions Fix"**
- **File:** `035_fix_curva_analyses_perms.sql`
- **Check:** Permissions working?
- **Action:** If yes → DELETE

### F. Test/Debug Queries

#### 48. 🔍 **"Test RLS"** / **"Debug RLS"** queries
- **Check:** One-time test atau reusable utility?
- **Action:** If one-time → DELETE
           If reusable → Keep 1 best version

#### 49. 🔍 **"Untitled query"** (3 queries dengan nama sama)
- **Check:** Isi querynya apa?
- **Action:** If empty atau test → DELETE
           If useful → Rename & keep

#### 50. 🔍 **"Project ownership verification"**
- **Check:** Reusable monitoring atau one-time debug?
- **Action:** If one-time → DELETE
           If monitoring → KEEP

#### 51. 🔍 **"Projects schema & audit log setup"**
- **Check:** Apakah ini migration atau monitoring?
- **Action:** If migration (sudah applied) → DELETE
           If useful monitoring → KEEP

---

## ✅ FASE 3: KEEP (Jangan Dihapus!)

Query-query ini **REUSABLE UTILITIES** - tetap simpan:

### G. Active Monitoring Queries

#### 52. ✅ **"Grand Total Recompute and Verification"**
- **Reason:** Reusable untuk verify calculation logic
- **Used for:** Testing costing calculations
- **Action:** KEEP

#### 53. ✅ **"Recalculate AHSP grand_total and assign default division"**
- **Reason:** Utility untuk fix data inconsistencies
- **Used for:** Maintenance tasks
- **Action:** KEEP

#### 54. ✅ **"Seed Master AHSP Items"**
- **Reason:** Utility untuk seed AHSP catalog
- **Used for:** Re-seeding AHSP data when needed
- **Action:** KEEP (unless you have dedicated seed script)

#### 55. ✅ **"AHSP Classification & PUPR Division Migration"**
- **Reason:** May need to re-run for new data
- **Used for:** Data classification
- **Action:** KEEP (mungkin perlu untuk data baru)

#### 56. ✅ **"Policy and Function Verification"** (if frequently used)
- **Reason:** Audit utility
- **Used for:** Security reviews
- **Action:** KEEP if used regularly

### H. Utility Queries

#### 57. ✅ **"Refresh API Schema Cache"**
- **Reason:** Utility untuk refresh PostgREST schema
- **Used for:** After schema changes
- **Action:** KEEP

#### 58. ✅ **"Add user roles to profiles"**
- **Reason:** Utility untuk assign roles
- **Used for:** User management
- **Action:** KEEP if still useful

#### 59. ✅ **"RAB item overhead & BoQ mapping"**
- **Reason:** May need for data fixes
- **Used for:** RAB data maintenance
- **Action:** KEEP

#### 60. ✅ **"rap_items Integration Enhancements"**
- **Reason:** Utility untuk enhance RAP data
- **Used for:** RAP module maintenance
- **Action:** KEEP if still relevant

#### 61. ✅ **"Enable RLS and permissive policy for timeline_tasks"**
- **Reason:** May need to re-apply if RLS issues
- **Used for:** Troubleshooting timeline permissions
- **Action:** KEEP

#### 62. ✅ **"WBS Items Quality Control Gate"**
- **Reason:** Utility untuk QC workflows
- **Used for:** Quality control processes
- **Action:** KEEP

#### 63. ✅ **"Add B-tree Indexes for Performance"**
- **Reason:** May need for optimization
- **Used for:** Performance tuning
- **Action:** KEEP

#### 64. ✅ **"Real-time Activity & Collaboration Schema"**
- **Reason:** Schema reference for real-time features
- **Used for:** Development reference
- **Action:** KEEP if actively developing

### I. Recent Work (< 1 Week)

#### 65. ✅ **Queries dated 2026-02-27** (today!)
- **Reason:** Current work in progress
- **Action:** KEEP for now, review after 1 week

#### 66. ✅ **Queries dated 2026-02-26** (yesterday)
- **Reason:** Very recent changes
- **Action:** KEEP for now, review after 1 week

---

## 📊 SUMMARY STATISTICS

### Expected Deletion Count

| Category | Queries | Action |
|----------|---------|--------|
| **Fase 1: Migration Queries** | ~40 | ❌ DELETE |
| **Fase 1: Debug Queries** | ~15 | ❌ DELETE |
| **Fase 1: Dangerous/Obsolete** | ~5 | ❌ DELETE ASAP |
| **Fase 2: Review First** | ~15 | 🔍 REVIEW → DELETE |
| **Fase 3: Active Utilities** | ~15 | ✅ KEEP |
| **Fase 3: Recent Work** | ~15 | ✅ KEEP (for now) |
| **Total** | ~105 | |

### Target Results
- **Safe to DELETE Immediately:** ~60 queries (Fase 1)
- **Review & DELETE:** ~15 queries (Fase 2)
- **KEEP:** ~30 queries (Fase 3)
- **Final Count:** ~30 queries remaining

---

## 🛠️ EXECUTION PLAN

### Step 1: Delete Fase 1 (Safe Deletions)
1. Open Supabase Dashboard → SQL Editor
2. Cari queries berdasarkan nama di list di atas
3. Untuk setiap query:
   - Klik "..." menu → Delete
   - Confirm deletion
4. Progress: Delete ~60 queries

### Step 2: Review Fase 2
1. Buka setiap query di Fase 2
2. Cek isi querynya
3. Compare dengan migration files
4. Jika sudah ada di migration → DELETE
5. Jika unique utility → KEEP
6. Progress: Review 15 queries → Delete ~10-12

### Step 3: Organize Fase 3
1. Queries yang di-KEEP → organize by category
2. Rename query names agar jelas (jika perlu)
3. Add descriptions/comments
4. Progress: Organize ~30 queries

### Expected Final State
```
Before: 105 queries (messy)
After:  ~30 queries (organized)
Deleted: ~75 queries
```

---

## 🔍 QUICK SEARCH TIPS

Cara cepat cari query di SQL Editor:

1. **By Migration File Name:**
   - Search: "migrate to is_project_member_by_text"
   - Search: "AHSP creation logs"
   - Search: "TKDN"

2. **By Category:**
   - Search: "fix" → many old fix queries
   - Search: "migration" → migration queries
   - Search: "debug" → debug queries
   - Search: "test" → test queries

3. **By Date (if visible):**
   - Look for queries dated before Feb 2026
   - Those are likely obsolete

---

## ⚠️ SAFETY RULES

Before deleting any query:

1. ✅ **DO** delete if migration file exists AND applied
2. ✅ **DO** delete if one-time debug/verification
3. ✅ **DO** delete obvious duplicates
4. ✅ **DO** delete queries from `_archive/`
5. ❌ **DON'T** delete if unsure
6. ❌ **DON'T** delete queries < 1 week old
7. ❌ **DON'T** delete monitoring/utility queries
8. ❌ **DON'T** delete if unique logic not in files

---

## 📋 PROGRESS TRACKING

```markdown
### Deletion Progress

#### Fase 1: Safe Deletions (Target: 60)
- [ ] Migration Queries: ___ / 40 deleted
- [ ] Debug Queries: ___ / 15 deleted
- [ ] Dangerous Queries: ___ / 5 deleted

#### Fase 2: After Review (Target: 12)
- [ ] Reviewed: ___ / 15 queries
- [ ] Deleted: ___ / 12 queries
- [ ] Kept: ___ / 3 queries

#### Fase 3: Organizing Kept Queries
- [ ] Utilities organized: ___ / 15
- [ ] Recent work reviewed: ___ / 15

### Final State
- Starting: 105 queries
- Deleted: ___ queries
- Remaining: ___ queries
- Status: [ ] Complete
```

---

## 🎯 NEXT ACTIONS

1. **Immediate (Today):**
   - [ ] Delete Fase 1A: Migration Queries (1-25) → ~25 deletions
   - [ ] Delete Fase 1B: Debug Queries (26-35) → ~10 deletions
   - [ ] Delete Fase 1C: Dangerous Queries (36-40) → ~5 deletions
   - **Progress Check:** Should have ~65 queries left

2. **Within 1 Hour:**
   - [ ] Review Fase 2: Duplicates & Old Fixes (41-51) → ~10 deletions
   - **Progress Check:** Should have ~55 queries left

3. **End of Day:**
   - [ ] Organize Fase 3: Kept Queries (52-66) → Rename & categorize
   - **Final Check:** Should have ~30 organized queries

4. **Verification:**
   - [ ] Run health check query (from checklist)
   - [ ] Confirm database still working
   - [ ] Document final state

---

**Created:** 2026-02-27 23:30  
**Purpose:** Komprehensif evaluasi SQL Editor queries untuk cleanup  
**Expected Result:** 105 → 30 queries (75 deletions)
