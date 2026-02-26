# Migration Documentation - Feb 26, 2026

## Overview
This document summarizes the database migrations applied on February 26, 2026, to fix RLS policies and improve security.

## Migrations Applied

### 1. `20260226_migrate_to_is_project_member_by_text.sql`

**Purpose**: Replace deprecated `is_project_member()` function with explicit TEXT parameter version

**Status**: ✅ Already applied to production

**Changes**:
- Created new function: `is_project_member_by_text(TEXT)`
- Updated 40+ RLS policies across multiple tables
- Removed old `is_project_member(TEXT)` function

**Affected Tables** (40+ policies):
- `progress_evidence`, `progress_logs`, `risks`
- `material_requests`, `project_members`, `purchase_orders`
- `rab_versions`, `rab_approvals`, `rab_items`, `wbs_items`
- `projects`, `notifications`, `timeline_tasks`, `task_dependencies`
- `rap_items`, `rap_data`, `inventory_items`, `inventory_transactions`
- `invoices`, `expenses`, `cashflow_projections`
- `waste_logs`, `subcon_chargebacks`, `tools_usage_logs`
- `documents`, `change_orders`, `approval_requests`
- `material_transfer_requests`, `goods_receipts`, `work_orders`
- `po_items`, `purchase_order_items`, `change_order_items`

**Migration Notes**:
This migration was manually executed on production Supabase on 2026-02-26. The migration file serves as documentation and can be applied to other environments (dev/staging).

### 2. `20260226_fix_ahsp_creation_logs_rls.sql`

**Purpose**: Fix overly permissive RLS policies on `ahsp_creation_logs` table

**Status**: ⏳ Pending application to production

**Changes**:
- ❌ Removed: `"Allow public all ahsp_creation_logs"` (permissive policy)
- ✅ Added proper policies:
  - `"View AHSP creation logs"` - SELECT for authenticated users
  - `"Insert AHSP creation logs"` - INSERT for authenticated users
  - `"Update own AHSP creation logs"` - UPDATE for creators only
  - `"Admin delete AHSP creation logs"` - DELETE for admins only

**Security Impact**:
- **Before**: All operations allowed for everyone (security risk!)
- **After**: Proper access control based on authentication and ownership

## How to Apply

### Option 1: Using SQL Editor (Recommended)
1. Go to [Supabase Dashboard](https://supabase.com/dashboard/project/gtnc3ijizj12gepmnwj0f/editor)
2. Copy contents of `20260226_fix_ahsp_creation_logs_rls.sql`
3. Execute in SQL Editor
4. Verify no errors

### Option 2: Using Script
```bash
# Set environment variable
$env:SUPABASE_SERVICE_KEY="your-service-role-key-here"

# Run migration script
node scripts/apply_feb26_migrations.mjs
```

## Verification Steps

After applying migrations, verify:

1. **Function Exists**:
```sql
SELECT proname FROM pg_proc WHERE proname = 'is_project_member_by_text';
-- Should return 1 row
```

2. **Old Function Removed**:
```sql
SELECT proname FROM pg_proc WHERE proname = 'is_project_member' AND pronargs = 1;
-- Should return 0 rows
```

3. **AHSP Logs Policies**:
```sql
SELECT policyname FROM pg_policies 
WHERE tablename = 'ahsp_creation_logs';
-- Should return 4 policies
```

4. **Test Access**:
   - Log in as regular user
   - Try accessing projects ✅
   - Try creating AHSP items ✅
   - Verify logs are created ✅

## Rollback Plan

If issues occur, rollback steps:

### For is_project_member_by_text:
```sql
-- Recreate old function (not recommended)
CREATE OR REPLACE FUNCTION public.is_project_member(p_id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin') OR
    EXISTS (SELECT 1 FROM public.projects WHERE id = p_id AND user_id = auth.uid()) OR
    EXISTS (SELECT 1 FROM public.project_members WHERE project_id = p_id AND user_id = auth.uid())
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Revert all policies (very tedious, not recommended)
```

### For AHSP RLS:
```sql
-- Revert to permissive policy (temporary only!)
DROP POLICY IF EXISTS "View AHSP creation logs" ON public.ahsp_creation_logs;
DROP POLICY IF EXISTS "Insert AHSP creation logs" ON public.ahsp_creation_logs;
DROP POLICY IF EXISTS "Update own AHSP creation logs" ON public.ahsp_creation_logs;
DROP POLICY IF EXISTS "Admin delete AHSP creation logs" ON public.ahsp_creation_logs;

CREATE POLICY "Allow public all ahsp_creation_logs" 
  ON public.ahsp_creation_logs FOR ALL USING (true);
```

## Known Issues

### Migration File Numbering
- **Issue**: Duplicate migration numbers exist (010, 031, 035, 036)
- **Impact**: No functional impact, but may cause confusion
- **Solution**: Using timestamp format for new migrations (YYYYMMDD_*)
- **Action**: Leave existing files as-is (already applied to production)

### Aggregate Function Error
When trying to scan dependencies before dropping `is_project_member`:
```
ERROR: 42809: 'array_agg' is an aggregate function
```
- **Cause**: Supabase catalog helper issue
- **Solution**: Direct DROP with IF EXISTS (safe, all references updated)

## Testing Checklist

After migration, test:
- [ ] User login and authentication
- [ ] Project access (owner/member/non-member)
- [ ] AHSP item creation (SNI/Custom/Historical)
- [ ] AHSP creation logs insertion
- [ ] RAB item operations
- [ ] Timeline task access
- [ ] Material requests
- [ ] Purchase orders
- [ ] Admin functions

## Related Files

- **Migrations**:
  - [`supabase/migrations/20260226_migrate_to_is_project_member_by_text.sql`](../supabase/migrations/20260226_migrate_to_is_project_member_by_text.sql)
  - [`supabase/migrations/20260226_fix_ahsp_creation_logs_rls.sql`](../supabase/migrations/20260226_fix_ahsp_creation_logs_rls.sql)

- **Scripts**:
  - [`scripts/apply_feb26_migrations.mjs`](./apply_feb26_migrations.mjs)

- **Legacy**:
  - [`supabase/migrations/20260223_strict_rls.sql`](../supabase/migrations/20260223_strict_rls.sql) - Original function definition
  - [`supabase/migrations/010_add_ahsp_creation_logs.sql`](../supabase/migrations/010_add_ahsp_creation_logs.sql) - Original table creation

## Timeline

- **2026-02-17**: Created `ahsp_creation_logs` table with permissive policy
- **2026-02-23**: Created `is_project_member` function in strict RLS migration
- **2026-02-26**: 
  - Manually updated 40+ policies to use `is_project_member_by_text`
  - Created documentation migration files
  - Prepared RLS fix for AHSP logs
  - Created helper scripts

## Contact

For questions or issues with these migrations, contact the development team.

---

**Last Updated**: 2026-02-26  
**Status**: Migration 1 ✅ Applied | Migration 2 ⏳ Pending
