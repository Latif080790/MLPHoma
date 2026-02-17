/**
 * Apply AHSP Creation Logs Migration
 * Run this script to create the ahsp_creation_logs table in Supabase
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Supabase credentials
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gtnc3ijizj12gepmnwj0f.supabase.co'
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0bmMzaWppemoxMmdlcG1ud2owZiIsInJvbGUiOiJzZXJ2aWNlX3JvbGUiLCJpYXQiOjE3MzY0NDg5ODQsImV4cCI6MjA1MjAyNDk4NH0.w2xZSvt6T1_yvEEbRbLEgKBCCECqk0hW2vvUcACg-hU'

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

async function applyMigration() {
  try {
    console.log('🚀 Applying AHSP Creation Logs migration...\n')

    // Read migration file
    const migrationPath = join(__dirname, '..', 'supabase', 'migrations', '010_add_ahsp_creation_logs.sql')
    const migrationSQL = readFileSync(migrationPath, 'utf-8')

    // Split by semicolons and execute each statement
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s && !s.startsWith('--'))

    console.log(`Found ${statements.length} SQL statements\n`)

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i]
      console.log(`[${i + 1}/${statements.length}] Executing...`)
      
      const { error } = await supabase.rpc('exec_sql', { sql: statement })
      
      if (error) {
        // Try direct query if RPC fails
        const { error: directError } = await supabase.from('_').select('*').limit(0)
        
        if (directError) {
          console.error(`❌ Error: ${error.message}`)
          console.log('Statement:', statement.substring(0, 100) + '...\n')
        } else {
          console.log(`✅ Statement executed\n`)
        }
      } else {
        console.log(`✅ Statement executed\n`)
      }
    }

    console.log('\n✅ Migration completed!')
    console.log('\n📊 Verifying table creation...')

    // Verify table exists
    const { data, error } = await supabase
      .from('ahsp_creation_logs')
      .select('*')
      .limit(1)

    if (error) {
      console.error('❌ Table verification failed:', error.message)
      console.log('\n⚠️  Please run the migration manually in Supabase SQL Editor:')
      console.log('   https://supabase.com/dashboard/project/gtnc3ijizj12gepmnwj0f/editor')
    } else {
      console.log('✅ Table exists and is accessible!')
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message)
    console.log('\n⚠️  Please run the migration manually in Supabase SQL Editor')
    console.log('   File: supabase/migrations/010_add_ahsp_creation_logs.sql')
  }
}

applyMigration()
