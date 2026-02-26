# 🎯 SQL Editor - Query Mapping (From Screenshots)

**Mapping queries yang terlihat di screenshot ke action yang jelas**

---

## 📸 DARI SCREENSHOT - SQL EDITOR SIDEBAR

Berdasarkan queries yang terlihat di screenshots, ini action per query:

### Row 1-20 (Top of List)

| Query Name | Action | Reason |
|------------|--------|--------|
| **Find policies using OLD is_project_member function** | ❌ DELETE | Sudah selesai cleanup hari ini |
| **Cleanup Duplicate Row-Level Policies** | ❌ DELETE | Sudah selesai cleanup (27 Feb 2026) |
| **Security-related Function Inventory** | ❌ DELETE | One-time audit, sudah complete |
| **Cleanup Verification Script** | ❌ DELETE | Verification done |
| **Remove unneeded row-level policies** | ❌ DELETE | Already removed today |
| **AHSP Policy Audit** | ❌ DELETE | Audit complete |
| **Policy and Function Verification** | ❌ DELETE | Verification done |
| **AHSP Creation Logs RLS Enforcement** | ❌ DELETE | In file: `20260226_fix_ahsp_creation_logs_rls.sql` |
| **Add missing rab_items foreign key constraints** | ❌ DELETE | Sudah applied di migration |
| **RAB item overhead & BoQ mapping** | ✅ KEEP | Utility untuk data fixes |
| **Relax profiles.role constraint** | ❌ DELETE | File: `043_fix_role_constraint_error.sql` |
| **Add user roles to profiles** | ✅ KEEP | Useful utility |
| **RBAC Row-Level Security Policies** | ❌ DELETE | File: `041_rbac_hardening.sql` |
| **Project Baseline Snapshots** | ❌ DELETE | File: `040_project_snapshots.sql` |
| **End-to-End WBS Propagation & Immutable Audit Triggers** | ❌ DELETE | File: `039_sprint2_traceability.sql` |
| **Curvas Analyses Permissions Fix** | ❌ DELETE | File: `035_fix_curva_analyses_perms.sql` |
| **Fix risk table foreign key relationships** | ❌ DELETE | File: `038_fix_risk_foreign_keys.sql` |
| **Enable cascade deletes for RAB/RAP/PO relationships** | ❌ DELETE | File: `021_fix_rap_items_and_project_consistency.sql` |
| **Notifications & Tools Automation Migration** | ❌ DELETE | File: `029_notification_approval_audit.sql` |
| **Automation: Notifications & Tool Usage Logs** | ❌ DELETE | File: `035_automation_schema.sql` |

### Row 21-40 (Middle Section)

| Query Name | Action | Reason |
|------------|--------|--------|
| **Reinstate Strict Row-Level Security** | ❌ DELETE | SUPERSEDED - in `_archive/` |
| **Restore project_members permissions and add project-evidence bucket** | ❌ DELETE | File: `036_fix_project_members_and_storage.sql` |
| **Enable pg_cron and pg_net extensions** | ❌ DELETE | File: `036_enable_cron_extensions.sql` |
| **AHSP Creation Logs** | ❌ DELETE | File: `010_add_ahsp_creation_logs.sql` |
| **Production fix and AHSP price-history migration** | ❌ DELETE | File: `034_fix_production_errors.sql` |
| **Enable RLS and authenticated policies for AHSP tables** | ❌ DELETE | Multiple migrations (019, 026, 034) |
| **Mock Data Cleanup** | ❌ DELETE | Use file: `clear_mock_data.sql` |
| **AHSP Price History** | ❌ DELETE | File: `999_add_ahsp_price_history.sql` |
| **MR→PO Traceability & Immutable Audit** | ❌ DELETE | File: `039_sprint2_traceability.sql` |
| **Universal Dev RLS Bypass & Schema Fix** | ❌ DELETE | Dangerous/obsolete |
| **Row-Level Security Policies for Project-Scoped Records** | ❌ DELETE | File: `041_rbac_hardening.sql` |
| **Construction Costing & Project Management Schema** | 🔍 REVIEW | Migration atau monitoring? |
| **AHSP Creation Logs** (duplicate?) | ❌ DELETE | Already handled above |
| **Enforce Ownership-based RLS Across Project Schema** | ❌ DELETE | File: `041_rbac_hardening.sql` |
| **Phase 3+4 Schema Extensions: Evidence, Versioning & Members** | ❌ DELETE | File: `030_fase3_4_extensions.sql` |
| **Convert UUID IDs to TEXT and Recreate FKs** | ❌ DELETE | File: `022_fix_id_types_cascade.sql` |
| **Add unit and unit_price columns to ahsp_components** | ❌ DELETE | File: `026_add_ahsp_component_columns.sql` |
| **Soft-delete Prisma service interceptor** | ✅ KEEP | Development utility |
| **Transactional Projects Service** | ✅ KEEP | Development reference |
| **Prisma Soft Delete Extension** | ✅ KEEP | Development utility |

### Row 41-60 (Lower Middle)

| Query Name | Action | Reason |
|------------|--------|--------|
| **Project Management Schema** | 🔍 REVIEW | Migration atau reference? |
| **MLPHOMA Enterprise Schema Initialization** | ❌ DELETE | Schema sudah initialized |
| **Untitled query** (1st) | 🔍 REVIEW | Check content |
| **Untitled query** (2nd) | 🔍 REVIEW | Check content |
| **Untitled query** (3rd) | 🔍 REVIEW | Check content |
| **Inventory, Procurement & Documents Schema** | 🔍 REVIEW | Migration atau reference? |
| **Inventory Movements Log** | ❌ DELETE | Jika sudah ada di migration |
| **RLS Policy Updates for AHSP Tables** | ❌ DELETE | Updates sudah applied |
| **Grand Total Recompute and Verification** | ✅ KEEP | Useful utility |
| **Seed Master AHSP Items** | ✅ KEEP | Useful untuk re-seeding |
| **Recalculate AHSP grand_total and assign default division** | ✅ KEEP | Data fix utility |
| **AHSP Classification & PUPR Division Migration** | ✅ KEEP | May need for new data |
| **AHSP 4-Level Costing & Workflow Schema v2** | ❌ DELETE | File: `019_ahsp_history_and_refinement.sql` |
| **Real-time Activity Feed & Collaboration Schema** | ✅ KEEP | Development reference |
| **Real-time Activity & Collaboration Schema** | ✅ KEEP | Duplicate? Keep best version |
| **MLPHoma Resource & Pricing Schema** | 🔍 REVIEW | Migration atau reference? |
| **Import/Export Staging & Template System** | ✅ KEEP | Development reference |
| **TKDN Calculator Migration with Sample Data** | ❌ DELETE | File: `032_tkdn_module.sql` |
| **Carbon Footprint, Price-Anomaly Detection & Marketplace Integration** | ✅ KEEP | Development reference |
| **Resource Dependency Cascade** | ❌ DELETE | If in migration file |

### Row 61-80 (Lower Section)

| Query Name | Action | Reason |
|------------|--------|--------|
| **Schema fix: add missing columns and support tables** | ❌ DELETE | Fixes sudah applied |
| **Schema fixes and additions** | ❌ DELETE | Fixes sudah applied |
| **Real-time Activity Feed & Collaboration Schema** (dup?) | 🔍 DELETE | Keep only 1 version |
| **Projects schema & audit log setup** | 🔍 REVIEW | Migration atau monitoring? |
| **Soft-delete Prisma service interceptor** (dup?) | 🔍 DELETE | Keep only 1 version |
| **Add B-tree Indexes for Performance** | ✅ KEEP | Useful untuk optimization |
| **Real-time Activity & Collaboration Schema** (dup?) | 🔍 DELETE | Keep only 1 version |
| **Price Zones, AHSP Price History & Project Locking** | ❌ DELETE | File: `018_zone_based_pricing.sql` |
| **Lean & MLPHoma v5.0 Ultra Schema Migration** | ❌ DELETE | Schema sudah migrated |
| **Enable RLS and Harden Function Search Path** | ❌ DELETE | Already applied |
| **Global Permission Fixes & RLS Policy Enforcement** | ❌ DELETE | Fixes sudah applied |
| **WBS Items Quality Control Gate** | ✅ KEEP | QC workflow utility |
| **AHSP Row-Level Security Policies** | ❌ DELETE | File: `20260217_fix_ahsp_policies.sql` |
| **Supply & Finance v3 Schema Enhancements** | ❌ DELETE | File: `010_supply_finance_v3.sql` |
| **Timeline, Progress & Weather Enhancements** | ❌ DELETE | File: `009_timeline_progress_v3.sql` |
| **Price Zones, AHSP Price History & Project Locking** (dup?) | ❌ DELETE | Already counted above |
| **Project Archival & Status Management** | ❌ DELETE | File: `016_archive_system.sql` |
| **Add TKDN percentage to RAB items** | ❌ DELETE | File: `032_tkdn_module.sql` |
| **Multi-Zone Pricing Migration** | ❌ DELETE | File: `018_zone_based_pricing.sql` |
| **AHSP Price History & Item Cost Split** | ❌ DELETE | File: `019_ahsp_history_and_refinement.sql` |

### Row 81-105 (Bottom Section)

| Query Name | Action | Reason |
|------------|--------|--------|
| **Schema and Permissions Fixes** | ❌ DELETE | Fixes sudah applied |
| **Normalize RAP/RAB Item IDs and Add Cost & Period Fields** | ❌ DELETE | Multiple migrations |
| **Convert UUID IDs to text and restore cascading FKs** | ❌ DELETE | File: `022_fix_id_types_cascade.sql` |
| **Project Code and ID Auto-Generator** | ❌ DELETE | File: `023_project_auto_id.sql` |
| **AHSP Classification & PUPR Division Migration** (dup?) | 🔍 DELETE | Keep only 1 version |
| **Schema fix: add missing columns and support tables** (dup?) | ❌ DELETE | Already counted |
| **Schema fixes and additions** (dup?) | ❌ DELETE | Already counted |
| **Resource Dependency Cascade** (dup?) | ❌ DELETE | Already counted |
| **Link timeline_tasks to WBS** | ❌ DELETE | File: `027_add_wbs_to_timeline.sql` |
| **Mock Project Data Seed (V3.2)** | ❌ DELETE | Use file: `seed_mock_data.sql` |
| **Project ownership verification** | 🔍 REVIEW | Reusable atau one-time? |
| **Force-assign project owner** | ✅ KEEP | Admin utility |
| **Notification, Approval & Audit Trail Migration** | ❌ DELETE | File: `029_notification_approval_audit.sql` |
| **Phase 3+4 Schema Extensions: Evidence, Versioning & Members** (dup?) | ❌ DELETE | Already counted |
| **Convert UUID IDs to TEXT and Recreate FKs** (dup?) | ❌ DELETE | Already counted |
| **Add unit and unit_price columns to ahsp_components** (dup?) | ❌ DELETE | Already counted |
| **Refresh API Schema Cache** | ✅ KEEP | Useful utility |
| **Enable RLS and permissive policy for timeline_tasks** | ✅ KEEP | May need for troubleshooting |
| **rap_items Integration Enhancements** | ✅ KEEP | RAP maintenance utility |
| **TKDN Items Table** | ❌ DELETE | File: `032_tkdn_module.sql` |
| **Add missing updated_at to timeline_tasks** | ❌ DELETE | File: `033_add_updated_at_to_timeline_tasks.sql` |
| **Untitled query** (another one) | 🔍 REVIEW | Check content |
| **Migration 034 — Fix Production Errors & RLS** | ❌ DELETE | File: `034_fix_production_errors.sql` |
| **MLPHoma Mock Data Seeding V3.2** | ❌ DELETE | Use file: `seed_mock_data.sql` |
| **Schema alignment & RLS fixes** | ❌ DELETE | File: `024_fix_schema_alignment.sql` |

---

## 📊 SUMMARY BY ACTION

### ❌ IMMEDIATE DELETE (Safe) - ~65 queries
Queries yang sudah ada di migration files atau one-time debug.

### 🔍 REVIEW FIRST - ~15 queries
- "Untitled query" (3-4 instances) → Check content
- "Construction Costing & Project Management Schema" → Check type
- "Project Management Schema" → Check type
- "MLPHOMA Enterprise Schema Initialization" → Probably delete
- "Inventory, Procurement & Documents Schema" → Check type
- "MLPHoma Resource & Pricing Schema" → Check type
- "Projects schema & audit log setup" → Check type
- Duplicate "Real-time Activity & Collaboration Schema" → Keep 1
- Duplicate "Soft-delete Prisma service interceptor" → Keep 1
- Duplicate "AHSP Classification & PUPR Division Migration" → Keep 1
- "Project ownership verification" → Check reusability
- Other potential duplicates

### ✅ KEEP - ~20 queries
Useful utilities dan development references:
- RAB item overhead & BoQ mapping
- Add user roles to profiles
- Soft-delete Prisma service interceptor (1x)
- Transactional Projects Service
- Prisma Soft Delete Extension
- Grand Total Recompute and Verification
- Seed Master AHSP Items
- Recalculate AHSP grand_total
- AHSP Classification & PUPR Division Migration (1x)
- Real-time schemas (keep best version)
- Import/Export Staging & Template System
- Carbon Footprint schemas
- Add B-tree Indexes for Performance
- WBS Items Quality Control Gate
- Force-assign project owner
- Refresh API Schema Cache
- Enable RLS for timeline_tasks
- rap_items Integration Enhancements
- Recent queries (< 1 week)

---

## 🚀 RECOMMENDED DELETION ORDER

### Round 1: Low-Hanging Fruit (~30 queries, 10 mins)
Delete all queries that exactly match migration file names:
1. All "Fix" queries that have migration files
2. All "Migration" queries that have migration files
3. All "Add [column]" queries that are done
4. All policy cleanup queries (done today)

### Round 2: Schema Migrations (~20 queries, 5 mins)
Delete all schema initialization queries:
1. "Phase 3+4 Schema Extensions"
2. "Convert UUID IDs"
3. "Supply & Finance v3"
4. "Timeline, Progress & Weather"
5. "TKDN" related
6. "Multi-Zone Pricing"
7. "Project Archival"
8. All AHSP schema migrations

### Round 3: Debug/Verification (~15 queries, 5 mins)
Delete all one-time debug queries:
1. All "verify" queries
2. All "debug" queries
3. All "check" queries
4. "Mock Data Cleanup"
5. "Production fix" queries

### Round 4: Review Unknowns (~15 queries, 10 mins)
Review and decide:
1. All "Untitled query"
2. Duplicate versions
3. Schema reference queries
4. Potentially useful utilities

---

## ✅ AFTER CLEANUP

Expected final state:
- **Started:** ~105 queries
- **Deleted:** ~65-70 queries
- **Reviewed:** ~15 queries → Delete ~10-12
- **Kept:** ~20-25 queries (organized)

**Total time:** ~30-40 minutes

---

**Created:** 2026-02-27  
**Purpose:** Map screenshot queries to specific actions  
**Source:** SQL Editor sidebar screenshots
