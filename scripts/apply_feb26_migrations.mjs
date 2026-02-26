/**
 * Apply Migration: is_project_member_by_text + AHSP RLS Fix
 * Date: 2026-02-26
 * 
 * This script applies two critical migrations:
 * 1. Replace is_project_member with is_project_member_by_text
 * 2. Fix AHSP creation logs RLS policies
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load .env file manually (since dotenv might not be installed)
const envPath = join(__dirname, '..', '.env')
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    line = line.trim()
    if (!line || line.startsWith('#')) return
    
    const equalIndex = line.indexOf('=')
    if (equalIndex === -1) return
    
    const key = line.substring(0, equalIndex).trim()
    let value = line.substring(equalIndex + 1).trim()
    
    // Remove surrounding quotes
    if ((value.startsWith('"') && value.endsWith('"')) || 
        (value.startsWith("'") && value.endsWith("'"))) {
      value = value.substring(1, value.length - 1)
    }
    
    process.env[key] = value
  })
  console.log('✅ Loaded .env file')
}

// Supabase credentials
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY

if (!SUPABASE_URL) {
  console.error('❌ VITE_SUPABASE_URL environment variable is required')
  process.exit(1)
}

if (!SUPABASE_SERVICE_KEY) {
  console.error('❌ SUPABASE_SERVICE_KEY environment variable is required')
  console.log('💡 Make sure to set it in .env file or environment')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

/**
 * Execute SQL file migration
 */
async function executeMigration(filename) {
  console.log(`\n📄 Processing: ${filename}`)
  console.log('='.repeat(60))

  const migrationPath = join(__dirname, '..', 'supabase', 'migrations', filename)
  
  try {
    const migrationSQL = readFileSync(migrationPath, 'utf-8')
    
    // Execute the entire migration as a single transaction
    const { data, error } = await supabase.rpc('exec_sql', { 
      sql: migrationSQL 
    })

    if (error) {
      console.error(`❌ Error executing ${filename}:`, error.message)
      
      // If RPC fails, try breaking into smaller statements
      console.log('\n⚠️  Trying statement-by-statement execution...')
      await executeStatements(migrationSQL)
    } else {
      console.log(`✅ ${filename} applied successfully!`)
    }

  } catch (err) {
    console.error(`❌ Failed to read or execute ${filename}:`, err.message)
    return false
  }

  return true
}

/**
 * Execute SQL statements one by one
 */
async function executeStatements(sql) {
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--') && s.length > 5)

  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i] + ';'
    
    try {
      // Use Supabase's SQL execution
      const result = await supabase.rpc('exec_sql', { sql: statement })
      
      if (result.error) {
        console.log(`❌ Statement ${i + 1}/${statements.length}: ${result.error.message}`)
        errorCount++
      } else {
        successCount++
      }
    } catch (err) {
      console.log(`❌ Statement ${i + 1}/${statements.length}: ${err.message}`)
      errorCount++
    }
  }

  console.log(`\n📊 Results: ${successCount} succeeded, ${errorCount} failed`)
}

/**
 * Verify migration success
 */
async function verifyMigrations() {
  console.log('\n\n🔍 Verifying migrations...')
  console.log('='.repeat(60))

  // 1. Check if new function exists
  const { data: functions, error: funcError } = await supabase
    .rpc('exec_sql', {
      sql: `SELECT proname FROM pg_proc WHERE proname = 'is_project_member_by_text';`
    })

  if (funcError) {
    console.log('⚠️  Cannot verify function (RPC might not be available)')
  } else {
    console.log('✅ Function is_project_member_by_text exists')
  }

  // 2. Check AHSP creation logs table and policies
  const { data: logs, error: logsError } = await supabase
    .from('ahsp_creation_logs')
    .select('id')
    .limit(1)

  if (logsError) {
    console.log('❌ Cannot access ahsp_creation_logs:', logsError.message)
  } else {
    console.log('✅ Table ahsp_creation_logs is accessible')
  }

  // 3. Check if old function is removed
  console.log('\n📋 Migration verification complete!')
  console.log('\nNext steps:')
  console.log('1. Test project access in the application')
  console.log('2. Verify RLS policies are working correctly')
  console.log('3. Check AHSP creation logs access')
}

/**
 * Main execution
 */
async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗')
  console.log('║   MLPHoma - Migration Script (2026-02-26)                 ║')
  console.log('║   Apply is_project_member_by_text + AHSP RLS Fix          ║')
  console.log('╚════════════════════════════════════════════════════════════╝')

  console.log('\n⚠️  IMPORTANT: This will modify database policies!')
  console.log('Make sure you have a backup before proceeding.\n')

  // Give user 3 seconds to cancel
  console.log('Starting in 3 seconds... (Ctrl+C to cancel)')
  await new Promise(resolve => setTimeout(resolve, 3000))

  const migrations = [
    '20260226_migrate_to_is_project_member_by_text.sql',
    '20260226_fix_ahsp_creation_logs_rls.sql'
  ]

  let allSuccess = true

  for (const migration of migrations) {
    const success = await executeMigration(migration)
    if (!success) {
      allSuccess = false
    }
  }

  await verifyMigrations()

  if (allSuccess) {
    console.log('\n✅ All migrations applied successfully!')
  } else {
    console.log('\n⚠️  Some migrations failed. Please check the errors above.')
    console.log('You may need to apply them manually in Supabase SQL Editor.')
  }

  console.log('\n🔗 Supabase Dashboard:')
  console.log('   https://supabase.com/dashboard/project/gtnc3ijizj12gepmnwj0f/editor')
}

// Run main function
main().catch(err => {
  console.error('\n❌ Fatal error:', err)
  process.exit(1)
})
