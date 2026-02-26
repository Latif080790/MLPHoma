# 🗑️ Cleanup Obsolete Files - Instructions

**Script:** `scripts/cleanup_obsolete_files.ps1`  
**Purpose:** Safely delete SQL scripts dan files yang tidak terpakai  
**Safety:** Built-in dry-run mode + automatic backup

---

## 🚀 QUICK START

### Step 1: Preview (Dry Run - AMAN)

Lihat apa saja yang akan dihapus tanpa actually menghapus:

```powershell
.\scripts\cleanup_obsolete_files.ps1
```

**Output:** List file yang akan dihapus + alasannya

### Step 2: Execute Cleanup (With Backup)

Hapus files dengan backup otomatis:

```powershell
.\scripts\cleanup_obsolete_files.ps1 -DryRun:$false
```

**Result:** 
- ✅ Files dihapus
- 💾 Backup dibuat di `_archive/cleanup_backup_[timestamp]/`
- 📊 Summary report

### Step 3: Execute Without Backup (Permanent)

Hapus files tanpa backup (hemat space):

```powershell
.\scripts\cleanup_obsolete_files.ps1 -DryRun:$false -Backup:$false
```

⚠️ **Warning:** Permanent deletion!

---

## 📋 WHAT WILL BE DELETED?

### A. Obsolete Scripts (5 files)

| File | Reason | Safe? |
|------|--------|-------|
| `apply_feb26_migrations.mjs` | One-time migration runner | ✅ Yes |
| `apply_creation_logs_migration.mjs` | One-time migration | ✅ Yes |
| `rollback_ahsp_fix.mjs` | Old rollback (superseded) | ✅ Yes |
| `check_schema_fix.js` | One-time check (completed) | ✅ Yes |
| `debug_project_visibility.js` | One-time debug (resolved) | ✅ Yes |

**Total:** ~5 files

### B. Temporary Files (Auto-detected)

| Pattern | Description |
|---------|-------------|
| `test_log*.txt` | Test output logs |
| `tsc_log.txt` | TypeScript compilation log |
| `build_output.txt` | Build output log |

**Total:** ~4-6 files (varies)

---

## 🔒 WHAT WILL BE KEPT?

### Active Scripts (DO NOT DELETE)

✅ **scripts/** (11 files to keep):
- `build.mjs` - Build script
- `clear_and_seed_ahsp.mjs` - AHSP seeding utility
- `debug_user.ts` - User debugging utility
- `fix_ahsp_mode_integration.mjs` - AHSP fixes
- `fix_duplicate_functions_and_policies.sql` - RLS cleanup (just used!)
- `parse_ahs_detailed.py` - AHS parser
- `reset_password.ts` - Password reset utility
- `seed_ahsp_supabase.mjs` - AHSP seeding
- `seed_dkh.mjs` - DKH seeding
- `verify_costing_logic.ts` - Costing verification
- `verify_sql_editor_cleanup.sql` - SQL Editor audit

✅ **supabase/** (5 files to keep):
- `clear_mock_data.sql` - Mock data cleanup utility
- `fix_rls_all_tables.sql` - RLS fix utility
- `fix_schema_cache.sql` - Cache refresh utility
- `seed_mock_data.sql` - Mock data seeding
- `PRODUCTION_FIX.sql` - Emergency fix reference

✅ **_archive/** (Already archived - safe):
- `DANGEROUS_20260218_nuclear_repair.sql`
- `SUPERSEDED_20260223_strict_rls.sql`

---

## 📊 EXPECTED RESULTS

### Before Cleanup:
```
scripts/
├─ Active utilities: 11 files
├─ Obsolete scripts: 5 files ❌
└─ Total: 16 files

Root/
├─ Temp logs: 4-6 files ❌
└─ Documentation: kept ✅
```

### After Cleanup:
```
scripts/
├─ Active utilities: 11 files ✅
└─ Total: 11 files (clean!)

Root/
├─ Temp logs: 0 files ✅
└─ Documentation: kept ✅

_archive/cleanup_backup_[timestamp]/
└─ Deleted files backup: 9-11 files 💾
```

**Space saved:** ~50-100 KB (small files, but cleaner workspace)

---

## 🛡️ SAFETY FEATURES

### 1. Dry Run Mode (Default)
- **Enabled by default**
- Shows what WOULD be deleted
- No actual deletion
- Zero risk

### 2. Automatic Backup
- Creates timestamped backup folder
- Copies files before deletion
- Easy restore if needed
- Only ~100KB overhead

### 3. Explicit Keep List
- Scripts whitelist active utilities
- Will NEVER delete production files
- Will NEVER touch migrations
- Will NEVER touch _archive

### 4. Detailed Reporting
- Shows each file processed
- Reason for deletion
- File sizes
- Summary statistics

---

## 🔄 RESTORE FROM BACKUP

If you deleted something by mistake:

### Option 1: Restore All
```powershell
# Find backup folder
Get-ChildItem _archive/cleanup_backup_* | Sort-Object Name -Descending | Select-Object -First 1

# Restore all files
$backup = (Get-ChildItem _archive/cleanup_backup_* | Sort-Object Name -Descending)[0].FullName
Copy-Item "$backup\*" -Destination "." -Recurse -Force
```

### Option 2: Restore Specific File
```powershell
# Example: restore debug_project_visibility.js
$backup = (Get-ChildItem _archive/cleanup_backup_* | Sort-Object Name -Descending)[0].FullName
Copy-Item "$backup\scripts\debug_project_visibility.js" -Destination "scripts\" -Force
```

---

## 📝 USAGE EXAMPLES

### Example 1: Safe Preview
```powershell
# Default: dry run
.\scripts\cleanup_obsolete_files.ps1

# Output:
# [DRY RUN] Would delete: scripts/apply_feb26_migrations.mjs (2.45 KB)
#           Reason: One-time migration runner - no longer needed
# [DRY RUN] Would delete: scripts/rollback_ahsp_fix.mjs (3.12 KB)
#           Reason: Old rollback script - superseded
# ...
# Files processed: 5
```

### Example 2: Execute with Backup
```powershell
.\scripts\cleanup_obsolete_files.ps1 -DryRun:$false

# Output:
# 💾 Backed up: scripts/apply_feb26_migrations.mjs
# ✅ Deleted: scripts/apply_feb26_migrations.mjs (2.45 KB)
#            Reason: One-time migration runner - no longer needed
# ...
# ✅ Cleanup completed successfully!
# 💾 Backup location: D:\...\MLPHoma\_archive\cleanup_backup_20260227_233045
```

### Example 3: Permanent Deletion (No Backup)
```powershell
.\scripts\cleanup_obsolete_files.ps1 -DryRun:$false -Backup:$false

# Output:
# ✅ Deleted: scripts/apply_feb26_migrations.mjs (2.45 KB)
#            Reason: One-time migration runner - no longer needed
# ...
# ✅ Cleanup completed successfully!
# Files permanently deleted
```

---

## 🎯 RECOMMENDED WORKFLOW

### For First-Time Cleanup:

1. **Preview** (1 min)
   ```powershell
   .\scripts\cleanup_obsolete_files.ps1
   ```
   - Review list of files
   - Confirm they're safe to delete

2. **Execute with Backup** (1 min)
   ```powershell
   .\scripts\cleanup_obsolete_files.ps1 -DryRun:$false
   ```
   - Backup created automatically
   - Safe to proceed

3. **Verify** (30 sec)
   ```powershell
   # Check scripts folder
   Get-ChildItem scripts\
   
   # Should see 11 active files only
   ```

4. **Test System** (5 min)
   - Run `npm run build`
   - Check if everything works
   - If issues → restore from backup

5. **Delete Backup** (optional, after 1 week)
   ```powershell
   # If everything OK after 1 week
   Remove-Item _archive/cleanup_backup_* -Recurse -Force
   ```

---

## ⚠️ TROUBLESHOOTING

### Issue: "File not found"
**Cause:** File already deleted manually  
**Solution:** Ignore - this is fine

### Issue: "Access denied"
**Cause:** File in use by another process  
**Solution:** Close VS Code, terminals, then retry

### Issue: "Script execution disabled"
**Cause:** PowerShell execution policy  
**Solution:** 
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\scripts\cleanup_obsolete_files.ps1
```

### Issue: "Accidentally deleted wrong file"
**Cause:** User error (rare - script has safeguards)  
**Solution:** Restore from backup (see section above)

---

## 📦 WHAT ABOUT SQL EDITOR CLEANUP?

This script handles **local files only**.

For **Supabase SQL Editor queries** (the 105 saved queries), use:
- [SQL_EDITOR_QUICK_DELETE_LIST.md](SQL_EDITOR_QUICK_DELETE_LIST.md) - Quick reference
- [SQL_EDITOR_CLEANUP_ANALYSIS.md](SQL_EDITOR_CLEANUP_ANALYSIS.md) - Detailed analysis
- [SQL_EDITOR_SCREENSHOT_MAPPING.md](SQL_EDITOR_SCREENSHOT_MAPPING.md) - Query mapping

**Manual process** (must delete via Supabase Dashboard UI)

---

## 🎯 SUMMARY

| Action | Command | Risk | Time |
|--------|---------|------|------|
| **Preview** | `.\scripts\cleanup_obsolete_files.ps1` | None | 30s |
| **Cleanup (Safe)** | `.\scripts\cleanup_obsolete_files.ps1 -DryRun:$false` | Very Low | 1min |
| **Cleanup (Fast)** | `.\scripts\cleanup_obsolete_files.ps1 -DryRun:$false -Backup:$false` | Low | 30s |

**Recommendation:** Use "Cleanup (Safe)" for first-time cleanup.

---

**Created:** 2026-02-27  
**Purpose:** Guide for safely cleaning up obsolete files  
**Status:** Ready to use
