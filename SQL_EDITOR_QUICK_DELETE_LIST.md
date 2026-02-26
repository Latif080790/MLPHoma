# 🎯 SQL Editor - Quick Delete Checklist
**Gunakan list ini sambil membuka SQL Editor untuk delete cepat**

---

## ✅ KATEGORI 1: Migration Queries (AMAN DIHAPUS)

Queries ini sudah ada di folder `supabase/migrations/` - 100% safe delete:

- [ ] ❌ Migrate to is_project_member_by_text
- [ ] ❌ Notifications & Tools Automation Migration
- [ ] ❌ Automation: Notifications & Tool Usage Logs
- [ ] ❌ AHSP Creation Logs (jika ada)
- [ ] ❌ Enforce Ownership-based RLS Across Project Schema
- [ ] ❌ Phase 3+4 Schema Extensions: Evidence, Versioning & Members
- [ ] ❌ Convert UUID IDs to TEXT and Recreate FKs
- [ ] ❌ Normalize RAP/RAB Item IDs and Add Cost & Period Fields
- [ ] ❌ AHSP 4-Level Costing & Workflow Schema v2
- [ ] ❌ Supply & Finance v3 Schema Enhancements
- [ ] ❌ Timeline, Progress & Weather Enhancements
- [ ] ❌ TKDN Items Table
- [ ] ❌ TKDN Calculator Migration with Sample Data
- [ ] ❌ Multi-Zone Pricing Migration
- [ ] ❌ Add TKDN percentage to RAB items
- [ ] ❌ Project Archival & Status Management
- [ ] ❌ Migrate Core IDs from UUID to TEXT
- [ ] ❌ Schema alignment & RLS fixes
- [ ] ❌ Enable pg_cron and pg_net extensions
- [ ] ❌ Enable cascade deletes for RAB/RAP/PO relationships
- [ ] ❌ Restore project_members permissions and add project-evidence bucket
- [ ] ❌ Link timeline_tasks to WBS
- [ ] ❌ Add unit and unit_price columns to ahsp_components
- [ ] ❌ Migration 034 — Fix Production Errors & RLS
- [ ] ❌ Fix risk table foreign key relationships
- [ ] ❌ Relax profiles.role constraint
- [ ] ❌ Curvas Analyses Permissions Fix

**Progress:** ___ / 27 deleted

---

## ✅ KATEGORI 2: Debug/Verification (SEKALI PAKAI)

Queries ini one-time debugging - tidak reusable:

- [ ] ❌ Verify migration 20260226
- [ ] ❌ Count policies per table
- [ ] ❌ Check function exists
- [ ] ❌ Debug projects visibility
- [ ] ❌ Production fix and AHSP price-history migration
- [ ] ❌ Mock Data Cleanup
- [ ] ❌ Production Fixes: AHSP Price History & Unique Codes
- [ ] ❌ AHSP Policy Audit
- [ ] ❌ Policy and Function Verification (jika sudah selesai verification)
- [ ] ❌ Remove unneeded row-level policies
- [ ] ❌ Find policies using OLD is_project_member function
- [ ] ❌ Cleanup Duplicate Row-Level Policies
- [ ] ❌ Cleanup Verification Script
- [ ] ❌ Security-related Function Inventory (jika one-time)

**Progress:** ___ / 14 deleted

---

## ✅ KATEGORI 3: Dangerous/Obsolete (DELETE IMMEDIATELY!)

Queries ini BERBAHAYA atau sudah obsolete:

- [ ] ❌ **Nuclear repair** ⚠️ DANGEROUS!
- [ ] ❌ **disable RLS** ⚠️ NEVER RUN!
- [ ] ❌ Reinstate Strict Row-Level Security (SUPERSEDED)
- [ ] ❌ AHSP Row-Level Security Policies (old version)
- [ ] ❌ Enable RLS and authenticated policies for AHSP tables (old)

**Progress:** ___ / 5 deleted

---

## ⚠️ KATEGORI 4: Review Dulu (CEK ISI QUERY)

Queries ini perlu dicek dulu - mungkin ada versi duplicate:

### Duplicates (Keep 1, Delete Others)

- [ ] 🔍 List all policies (cari berapa banyak?) → Keep newest
- [ ] 🔍 Check RLS status (cari duplicate) → Keep best version  
- [ ] 🔍 Construction Costing & Project Management Schema → Cek isi
- [ ] 🔍 MLPHoma Resource & Pricing Schema → Cek isi
- [ ] 🔍 Schema fixes and additions → Cek isi
- [ ] 🔍 Test RLS / Debug RLS → One-time? Delete. Reusable? Keep 1
- [ ] 🔍 Untitled query (3x) → Cek isi, probably delete

### Old Fixes (If Already Applied)

- [ ] 🔍 Fix Project ID Type & Consolidate Access/RLS → Cek applied?
- [ ] 🔍 Project ownership verification → Cek reusable?
- [ ] 🔍 Projects schema & audit log setup → Migration atau monitoring?

**Progress:** ___ / ~12 reviewed & decided

---

## ✅ KATEGORI 5: KEEP (Jangan Dihapus!)

Queries ini **USEFUL UTILITIES** - tetap simpan:

### Active Utilities
- [ ] ✅ Grand Total Recompute and Verification
- [ ] ✅ Recalculate AHSP grand_total and assign default division
- [ ] ✅ Seed Master AHSP Items (unless ada seed script dedicated)
- [ ] ✅ Refresh API Schema Cache
- [ ] ✅ Add user roles to profiles (jika masih useful)
- [ ] ✅ RAB item overhead & BoQ mapping
- [ ] ✅ rap_items Integration Enhancements
- [ ] ✅ Enable RLS and permissive policy for timeline_tasks
- [ ] ✅ WBS Items Quality Control Gate
- [ ] ✅ Add B-tree Indexes for Performance
- [ ] ✅ Real-time Activity & Collaboration Schema

### Recent Work (< 1 Week)
- [ ] ✅ Any queries dated 2026-02-27 (today)
- [ ] ✅ Any queries dated 2026-02-26 (yesterday)
- [ ] ✅ Any queries dated 2026-02-25 or later

**Note:** Review these after 1 week

---

## 📊 DELETION SUMMARY

```
Target Deletions:
├─ Kategori 1: 27 migrations → DELETE
├─ Kategori 2: 14 debug → DELETE
├─ Kategori 3: 5 dangerous → DELETE
├─ Kategori 4: ~12 review → ~10 DELETE
└─ TOTAL: ~56 immediate + ~10 after review = ~66 deletions

Expected Result:
├─ Before: ~105 queries
├─ After: ~35-40 queries (kept)
└─ Reduction: ~65 queries deleted
```

---

## 🚀 FASTEST DELETION METHOD

### Method 1: Search & Delete by Name Pattern

Di SQL Editor, **search box** → ketik pattern ini:

1. **Search: "migrate"** → Delete semua yang match dengan list di atas
2. **Search: "fix"** → Delete yang sudah applied (cek migration files)
3. **Search: "debug"** → Delete one-time debugs
4. **Search: "verify"** → Delete one-time verifications
5. **Search: "nuclear"** → DELETE IMMEDIATELY!
6. **Search: "test"** → Delete one-time tests
7. **Search: "mock"** → Delete yang sudah jadi file

### Method 2: Sort by Date (If Available)

1. Sort queries by creation date (oldest first)
2. Delete queries older than Feb 2026 (kecuali utilities)
3. Older queries = likely obsolete

### Method 3: Bulk Check Against Migration Files

Open terminal, run:
```powershell
# List all migration files
Get-ChildItem -Path "supabase\migrations\" -Name

# Check if query name matches migration file
# If yes → Safe to DELETE from SQL Editor
```

---

## ⏱️ TIME ESTIMATES

- **Kategori 1 (27 queries):** ~10 minutes (straightforward delete)
- **Kategori 2 (14 queries):** ~5 minutes (quick delete)
- **Kategori 3 (5 queries):** ~2 minutes (delete ASAP)
- **Kategori 4 (12 queries):** ~10 minutes (review first)
- **Kategori 5 (organize):** ~5 minutes (rename if needed)

**Total Time:** ~30-35 minutes untuk cleanup lengkap

---

## ✅ VERIFICATION AFTER CLEANUP

Setelah selesai delete, run query ini untuk verify database masih OK:

```sql
-- Quick health check
SELECT 
  (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies,
  (SELECT COUNT(*) FROM pg_proc WHERE proname LIKE '%project_member%') as security_funcs,
  (SELECT COUNT(*) FROM pg_tables WHERE schemaname = 'public' AND rowsecurity = true) as rls_enabled_tables;
```

**Expected Results:**
- `total_policies`: ~150-200
- `security_funcs`: 1 (is_project_member_by_text)
- `rls_enabled_tables`: ~40-50

**If results match → Cleanup SUCCESS! ✅**

---

## 📝 NOTES

- **Save this file** sebagai reference saat cleanup
- **Check boxes** saat delete untuk track progress
- **Jika ragu** → JANGAN delete, review dulu
- **Backup** tidak perlu karena queries sudah ada di migration files
- **After cleanup** → Organize remaining queries by category

---

**Created:** 2026-02-27  
**Purpose:** Quick reference untuk efficient SQL Editor cleanup  
**Target:** Delete ~66 obsolete queries dalam 30 menit
