# 🚀 Manual Migration Guide - Feb 26-27, 2026

## Status
- ✅ Migration 1: `20260226_migrate_to_is_project_member_by_text.sql` - **Already Applied** di production
- ⏳ Migration 2: `20260226_fix_ahsp_creation_logs_rls.sql` - **Perlu Manual Apply**

## Why Manual?
Supabase tidak mengizinkan raw SQL execution via JavaScript client untuk keamanan. Migration harus dijalankan via SQL Editor.

---

## 📋 Migration 2: AHSP RLS Security Fix

### Step-by-Step Instructions:

#### 1. Buka Supabase SQL Editor
🔗 https://supabase.com/dashboard/project/gtpcjjjzjjzpgpxwjzqf/editor

#### 2. Copy SQL Migration
File: [`supabase/migrations/20260226_fix_ahsp_creation_logs_rls.sql`](../supabase/migrations/20260226_fix_ahsp_creation_logs_rls.sql)

#### 3. SQL yang Perlu Dijalankan:

```sql
-- Migration: Fix AHSP Creation Logs RLS Policies
-- Date: 2026-02-26
-- Description: Replace overly permissive policy with proper project-based access control

-- Drop the old permissive policy
DROP POLICY IF EXISTS "Allow public all ahsp_creation_logs" ON public.ahsp_creation_logs;

-- Create proper RLS policies for ahsp_creation_logs
-- Users can view logs for AHSP items they have access to
CREATE POLICY "View AHSP creation logs" ON public.ahsp_creation_logs
  FOR SELECT
  USING (
    -- Allow viewing logs for any AHSP item (AHSP is global resource)
    -- Or restrict to project members if AHSP is linked to project
    EXISTS (
      SELECT 1 FROM public.ahsp_items a
      WHERE a.id = ahsp_id
    )
  );

-- Only authenticated users can insert creation logs
CREATE POLICY "Insert AHSP creation logs" ON public.ahsp_creation_logs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
  );

-- Users can update their own creation log entries
CREATE POLICY "Update own AHSP creation logs" ON public.ahsp_creation_logs
  FOR UPDATE
  USING (created_by = auth.uid()::text)
  WITH CHECK (created_by = auth.uid()::text);

-- Admins can delete logs
CREATE POLICY "Admin delete AHSP creation logs" ON public.ahsp_creation_logs
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Add comment for context
COMMENT ON TABLE public.ahsp_creation_logs IS 
  'Tracks how AHSP items were created (SNI, Custom, Historical). 
   Access controlled via RLS - authenticated users can view/insert, 
   only creators can update their entries, admins can delete.';
```

#### 4. Klik "Run" di SQL Editor

#### 5. Verifikasi Success ✅

Jalankan query ini untuk memastikan policies terbuat:

```sql
-- Check policies
SELECT policyname, cmd, qual 
FROM pg_policies 
WHERE tablename = 'ahsp_creation_logs';
```

**Expected Result**: 4 policies:
- View AHSP creation logs
- Insert AHSP creation logs
- Update own AHSP creation logs
- Admin delete AHSP creation logs

---

## ⚠️ Security Impact

### Before Migration:
```sql
-- ❌ DANGEROUS: Anyone can do ANYTHING!
CREATE POLICY "Allow public all ahsp_creation_logs" 
ON public.ahsp_creation_logs FOR ALL USING (true);
```

### After Migration:
```sql
-- ✅ SECURE: Proper access control
SELECT: Anyone can view (AHSP is global resource)
INSERT: Only authenticated users
UPDATE: Only entry creators
DELETE: Only admins
```

---

## 🔍 Testing After Migration

### Test 1: View Access (as regular user)
```sql
SELECT * FROM ahsp_creation_logs LIMIT 5;
-- Should work ✅
```

### Test 2: Insert Access (as authenticated user)
```sql
INSERT INTO ahsp_creation_logs (ahsp_id, creation_mode, created_by)
VALUES ('test-id', 'custom', auth.uid()::text);
-- Should work ✅
```

### Test 3: Update Own Entry
```sql
UPDATE ahsp_creation_logs
SET metadata = '{"test": true}'::jsonb
WHERE created_by = auth.uid()::text;
-- Should work ✅
```

### Test 4: Update Others' Entry (should fail)
```sql
UPDATE ahsp_creation_logs
SET metadata = '{"test": true}'::jsonb
WHERE created_by != auth.uid()::text;
-- Should fail ❌ (unless you're admin)
```

---

## 🔙 Rollback (if needed)

If something goes wrong, rollback to permissive policy:

```sql
-- EMERGENCY ROLLBACK ONLY!
DROP POLICY IF EXISTS "View AHSP creation logs" ON public.ahsp_creation_logs;
DROP POLICY IF EXISTS "Insert AHSP creation logs" ON public.ahsp_creation_logs;
DROP POLICY IF EXISTS "Update own AHSP creation logs" ON public.ahsp_creation_logs;
DROP POLICY IF EXISTS "Admin delete AHSP creation logs" ON public.ahsp_creation_logs;

-- Temporary permissive policy
CREATE POLICY "Allow public all ahsp_creation_logs" 
ON public.ahsp_creation_logs FOR ALL USING (true);
```

---

## 📊 Summary Checklist

Before migration:
- [x] Service key secured in .env
- [x] .env added to .gitignore
- [x] Migration files created
- [x] Documentation prepared

Apply migration:
- [ ] Open Supabase SQL Editor
- [ ] Copy SQL from file
- [ ] Execute migration
- [ ] Verify 4 policies created

After migration:
- [ ] Test SELECT access ✅
- [ ] Test INSERT access ✅
- [ ] Test UPDATE own entries ✅
- [ ] Test UPDATE others' entries (should fail) ✅
- [ ] Test DELETE as admin ✅

---

## 🆘 Need Help?

**Error saat apply?**
- Check if table `ahsp_creation_logs` exists
- Check if old policy name matches exactly
- Check for syntax errors

**Policies tidak bekerja?**
- Verify RLS is enabled: `SELECT relrowsecurity FROM pg_class WHERE relname = 'ahsp_creation_logs';`
- Check auth.uid() is not null
- Verify user has proper role in profiles table

**Questions?**
Contact dev team atau check full documentation: [`MIGRATION_20260226_README.md`](../supabase/migrations/MIGRATION_20260226_README.md)

---

**Last Updated**: 2026-02-27  
**Status**: Ready for manual application  
**Priority**: High (Security Fix)
