# Quick Reference - Migration Feb 26, 2026

## ⚡ Quick Apply

### In Supabase SQL Editor:
1. Go to: https://supabase.com/dashboard/project/gtnc3ijizj12gepmnwj0f/editor
2. Copy & paste: `supabase/migrations/20260226_fix_ahsp_creation_logs_rls.sql`
3. Click "Run"

### Using Script:
```powershell
# Set service key (one-time)
$env:SUPABASE_SERVICE_KEY = "your-service-role-key"

# Run
node scripts/apply_feb26_migrations.mjs
```

## 📋 What Changed

### ✅ Already Applied (Production):
**Migration**: `20260226_migrate_to_is_project_member_by_text.sql`
- Function: `is_project_member()` → `is_project_member_by_text()`
- 40+ policies updated
- Old function removed

### ⏳ Needs Application:
**Migration**: `20260226_fix_ahsp_creation_logs_rls.sql`
- Fix security vulnerability
- Replace permissive policy with proper RLS

## 🔍 Quick Verify

```sql
-- Check new function exists
SELECT proname FROM pg_proc 
WHERE proname = 'is_project_member_by_text';
-- Expected: 1 row

-- Check AHSP policies
SELECT policyname FROM pg_policies 
WHERE tablename = 'ahsp_creation_logs';
-- Expected: 4 rows
```

## 🛠️ Files Created

1. **Migration 1**: [20260226_migrate_to_is_project_member_by_text.sql](../supabase/migrations/20260226_migrate_to_is_project_member_by_text.sql)
2. **Migration 2**: [20260226_fix_ahsp_creation_logs_rls.sql](../supabase/migrations/20260226_fix_ahsp_creation_logs_rls.sql)
3. **Helper**: [apply_feb26_migrations.mjs](./apply_feb26_migrations.mjs)
4. **Docs**: [MIGRATION_20260226_README.md](../supabase/migrations/MIGRATION_20260226_README.md)

## ❓ FAQ

**Q: Why duplicate migration numbers (010, 031, etc)?**  
A: Already applied to production. Leave as-is. New migrations use timestamp format.

**Q: Is it safe to apply?**  
A: Migration 1 is already applied. Migration 2 improves security (recommended).

**Q: Can I rollback?**  
A: See [MIGRATION_20260226_README.md](../supabase/migrations/MIGRATION_20260226_README.md#rollback-plan)

## 🚨 Security Note

**Before Migration 2**:
```sql
-- ❌ DANGER: Anyone can do anything!
using (true)
```

**After Migration 2**:
```sql
-- ✅ SECURE: Proper access control
is_project_member_by_text(project_id)
auth.uid() = created_by
```

## 📞 Need Help?

Read full docs: [MIGRATION_20260226_README.md](../supabase/migrations/MIGRATION_20260226_README.md)

---
**Status**: Migration 1 ✅ | Migration 2 ⏳  
**Last Updated**: 2026-02-26
