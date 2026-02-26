# ============================================================
# Cleanup Obsolete SQL Files
# Date: 2026-02-27
# Purpose: Remove SQL files that are no longer needed
# ============================================================

param(
    [switch]$DryRun = $true,  # Default: dry run (safe mode)
    [switch]$Force = $false,   # Skip confirmation
    [switch]$Backup = $true    # Create backup before delete
)

$ErrorActionPreference = "Stop"
$WorkspaceRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host "  CLEANUP OBSOLETE SQL FILES" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# ============================================================
# CONFIGURATION
# ============================================================

# Files to delete from scripts/
$ObsoleteScripts = @(
    "apply_feb26_migrations.mjs",           # One-time migration runner
    "apply_creation_logs_migration.mjs",    # One-time migration
    "rollback_ahsp_fix.mjs",                # Old rollback (not needed)
    "check_schema_fix.js",                  # One-time check
    "debug_project_visibility.js"           # One-time debug
)

# Files already in _archive (informational only - don't touch)
$ArchivedFiles = @(
    "_archive/migrations/DANGEROUS_20260218_nuclear_repair.sql",
    "_archive/migrations/SUPERSEDED_20260223_strict_rls.sql"
)

# Files to KEEP in scripts/ (DO NOT DELETE)
$KeepScripts = @(
    "build.mjs",
    "clear_and_seed_ahsp.mjs",
    "debug_user.ts",
    "fix_ahsp_mode_integration.mjs",
    "fix_duplicate_functions_and_policies.sql",
    "parse_ahs_detailed.py",
    "reset_password.ts",
    "seed_ahsp_supabase.mjs",
    "seed_dkh.mjs",
    "verify_costing_logic.ts",
    "verify_sql_editor_cleanup.sql"
)

# Files to KEEP in supabase/ (DO NOT DELETE)
$KeepSupabaseFiles = @(
    "supabase/clear_mock_data.sql",
    "supabase/fix_rls_all_tables.sql",
    "supabase/fix_schema_cache.sql",
    "supabase/seed_mock_data.sql",
    "supabase/PRODUCTION_FIX.sql"
)

# ============================================================
# FUNCTIONS
# ============================================================

function Get-FileSize {
    param([string]$Path)
    if (Test-Path $Path) {
        $size = (Get-Item $Path).Length
        if ($size -lt 1KB) { return "$size B" }
        if ($size -lt 1MB) { return "{0:N2} KB" -f ($size / 1KB) }
        return "{0:N2} MB" -f ($size / 1MB)
    }
    return "N/A"
}

function New-BackupArchive {
    if (-not $Backup) { return $null }
    
    $timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $backupDir = Join-Path $WorkspaceRoot "_archive/cleanup_backup_$timestamp"
    
    Write-Host "[Backup] Creating backup directory..." -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $backupDir -Force | Out-Null
    
    return $backupDir
}

function Remove-ObsoleteFile {
    param(
        [string]$FilePath,
        [string]$BackupDir,
        [string]$Reason
    )
    
    $fullPath = Join-Path $WorkspaceRoot $FilePath
    
    if (-not (Test-Path $fullPath)) {
        Write-Host "  [SKIP] Not found: $FilePath" -ForegroundColor DarkGray
        return $false
    }
    
    $size = Get-FileSize $fullPath
    
    if ($DryRun) {
        Write-Host "  [DRY RUN] Would delete: $FilePath ($size)" -ForegroundColor DarkYellow
        Write-Host "            Reason: $Reason" -ForegroundColor DarkGray
        return $true
    }
    
    # Backup if requested
    if ($BackupDir) {
        $backupPath = Join-Path $BackupDir $FilePath
        $backupFolder = Split-Path -Parent $backupPath
        if (-not (Test-Path $backupFolder)) {
            New-Item -ItemType Directory -Path $backupFolder -Force | Out-Null
        }
        Copy-Item $fullPath $backupPath -Force
        Write-Host "  [BACKUP] Backed up: $FilePath" -ForegroundColor DarkGray
    }
    
    # Delete file
    Remove-Item $fullPath -Force
    Write-Host "  [DELETE] Deleted: $FilePath ($size)" -ForegroundColor Green
    Write-Host "           Reason: $Reason" -ForegroundColor DarkGray
    
    return $true
}

# ============================================================
# MAIN EXECUTION
# ============================================================

Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "   Mode: $(if ($DryRun) { 'DRY RUN (safe)' } else { 'LIVE DELETION' })" -ForegroundColor $(if ($DryRun) { 'Green' } else { 'Red' })
Write-Host "   Backup: $(if ($Backup -and -not $DryRun) { 'Enabled' } else { 'Disabled' })" -ForegroundColor White
Write-Host "   Workspace: $WorkspaceRoot" -ForegroundColor White
Write-Host ""

# ============================================================
# 1. OBSOLETE SCRIPTS
# ============================================================

Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host "CHECKING: scripts/ folder" -ForegroundColor Cyan
Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

$backupDir = New-BackupArchive
$deletedCount = 0

foreach ($file in $ObsoleteScripts) {
    $filePath = "scripts/$file"
    $reason = switch -Wildcard ($file) {
        "*migration*" { "One-time migration runner - no longer needed" }
        "*rollback*" { "Old rollback script - superseded" }
        "*check*" { "One-time check - already verified" }
        "*debug*" { "One-time debug - issue resolved" }
        default { "Obsolete - no longer used" }
    }
    
    if (Remove-ObsoleteFile -FilePath $filePath -BackupDir $backupDir -Reason $reason) {
        $deletedCount++
    }
}

Write-Host ""
Write-Host "  Scripts processed: $deletedCount / $($ObsoleteScripts.Count)" -ForegroundColor White
Write-Host ""

# ============================================================
# 2. CHECK FOR OTHER OBSOLETE PATTERNS
# ============================================================

Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host "SCANNING: Additional obsolete patterns" -ForegroundColor Cyan
Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Check for temp files
$tempFiles = @(
    "test_log*.txt",
    "tsc_log.txt",
    "build_output.txt"
)

$tempDeletedCount = 0
foreach ($pattern in $tempFiles) {
    $files = Get-ChildItem -Path $WorkspaceRoot -Filter $pattern -ErrorAction SilentlyContinue
    foreach ($file in $files) {
        $relativePath = $file.FullName.Replace("$WorkspaceRoot\", "")
        if (Remove-ObsoleteFile -FilePath $relativePath -BackupDir $backupDir -Reason "Temporary log/output file") {
            $tempDeletedCount++
        }
    }
}

Write-Host ""
Write-Host "  Temp files processed: $tempDeletedCount" -ForegroundColor White
Write-Host ""

# ============================================================
# 3. REPORT ARCHIVED FILES (INFO ONLY)
# ============================================================

Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host "ARCHIVED FILES (Safe in _archive/)" -ForegroundColor Cyan
Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

foreach ($file in $ArchivedFiles) {
    $fullPath = Join-Path $WorkspaceRoot $file
    if (Test-Path $fullPath) {
        $size = Get-FileSize $fullPath
        Write-Host "  [OK] Archived: $file ($size)" -ForegroundColor DarkGreen
    }
}

Write-Host ""

# ============================================================
# 4. LIST KEPT FILES (CONFIRMATION)
# ============================================================

Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host "FILES THAT WILL BE KEPT" -ForegroundColor Cyan
Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

Write-Host "  scripts/ (active utilities):" -ForegroundColor White
$KeepScripts | ForEach-Object {
    $fullPath = Join-Path $WorkspaceRoot "scripts/$_"
    if (Test-Path $fullPath) {
        $size = Get-FileSize $fullPath
        Write-Host "    [KEEP] $_ ($size)" -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "  supabase/ (production utilities):" -ForegroundColor White
$KeepSupabaseFiles | ForEach-Object {
    $fullPath = Join-Path $WorkspaceRoot $_
    if (Test-Path $fullPath) {
        $size = Get-FileSize $fullPath
        Write-Host "    [KEEP] $_ ($size)" -ForegroundColor Green
    }
}

Write-Host ""

# ============================================================
# 5. SUMMARY & NEXT STEPS
# ============================================================

Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host "CLEANUP SUMMARY" -ForegroundColor Cyan
Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

$totalProcessed = $deletedCount + $tempDeletedCount

Write-Host "  Files processed: $totalProcessed" -ForegroundColor White
Write-Host "  - Obsolete scripts: $deletedCount" -ForegroundColor White
Write-Host "  - Temp/log files: $tempDeletedCount" -ForegroundColor White
Write-Host ""

if ($DryRun) {
    Write-Host "  [INFO] This was a DRY RUN - no files were deleted" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  To actually delete files, run:" -ForegroundColor Cyan
    Write-Host "  .\scripts\cleanup_obsolete_files.ps1 -DryRun" -NoNewline -ForegroundColor White
    Write-Host ':$false' -ForegroundColor White
    Write-Host ""
    Write-Host "  To delete WITHOUT backup:" -ForegroundColor Cyan
    Write-Host "  .\scripts\cleanup_obsolete_files.ps1 -DryRun" -NoNewline -ForegroundColor White
    Write-Host ':$false -Backup:$false' -ForegroundColor White
}
else {
    Write-Host "  [SUCCESS] Cleanup completed successfully!" -ForegroundColor Green
    Write-Host ""
    
    if ($backupDir) {
        Write-Host "  Backup location:" -ForegroundColor Cyan
        Write-Host "  $backupDir" -ForegroundColor White
        Write-Host ""
        Write-Host "  To restore from backup:" -ForegroundColor Yellow
        Write-Host "  Copy-Item '$backupDir\*' -Destination '.' -Recurse -Force" -ForegroundColor White
    }
}

Write-Host ""

# ============================================================
# 6. OPTIONAL: ESTIMATE SPACE SAVED
# ============================================================

if (-not $DryRun -and $totalProcessed -gt 0) {
    Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
    Write-Host "DISK SPACE" -ForegroundColor Cyan
    Write-Host "---------------------------------------------------" -ForegroundColor DarkGray
    Write-Host ""
    
    if ($backupDir -and (Test-Path $backupDir)) {
        $backupSize = (Get-ChildItem $backupDir -Recurse | Measure-Object -Property Length -Sum).Sum
        if ($backupSize -lt 1KB) { 
            $backupSizeStr = "$backupSize B" 
        } elseif ($backupSize -lt 1MB) { 
            $backupSizeStr = "{0:N2} KB" -f ($backupSize / 1KB) 
        } else { 
            $backupSizeStr = "{0:N2} MB" -f ($backupSize / 1MB) 
        }
        
        Write-Host "  Space freed: ~$backupSizeStr" -ForegroundColor White
        Write-Host "  (Files moved to backup)" -ForegroundColor DarkGray
    } else {
        Write-Host "  Files permanently deleted" -ForegroundColor White
    }
    
    Write-Host ""
}

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host ""

# Return status
if ($DryRun) {
    exit 0  # Success - dry run
} elseif ($totalProcessed -gt 0) {
    exit 0  # Success - files deleted
} else {
    Write-Host "[WARN] No obsolete files found to delete" -ForegroundColor Yellow
    exit 1  # Nothing to do
}
