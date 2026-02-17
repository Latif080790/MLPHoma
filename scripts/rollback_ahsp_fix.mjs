#!/usr/bin/env node
/**
 * Rollback AHSP Mode Integration Fix
 * Usage: node scripts/rollback_ahsp_fix.mjs [backup-folder-name]
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.join(__dirname, '..')

const backupFolder = process.argv[2] || 'ahsp-mode-fix-1771315849048'
const BACKUP_DIR = path.join(ROOT, 'backups', backupFolder)

console.log('🔄 Rolling back from:', BACKUP_DIR)

if (!fs.existsSync(BACKUP_DIR)) {
  console.error('❌ Backup directory not found:', BACKUP_DIR)
  process.exit(1)
}

// Copy all files from backup
function restoreDirectory(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true })
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name)
    const destPath = path.join(dest, entry.name)
    
    if (entry.isDirectory()) {
      restoreDirectory(srcPath, destPath)
    } else {
      fs.copyFileSync(srcPath, destPath)
      console.log('✅ Restored:', path.relative(ROOT, destPath))
    }
  }
}

try {
  restoreDirectory(BACKUP_DIR, ROOT)
  console.log('\n✅ Rollback completed successfully!')
} catch (err) {
  console.error('❌ Rollback failed:', err)
  process.exit(1)
}
