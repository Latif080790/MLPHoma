/**
 * seed_dkh.mjs
 * Script to seed DKH (Daftar Kuantitas & Harga) data to Supabase
 */

import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Supabase configuration
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://yyznspvhfnbvyabccywm.supabase.co'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '***REMOVED-SECRET***'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

/**
 * Parse price from Indonesian Rupiah format
 */
function parsePrice(priceStr) {
  if (!priceStr || priceStr === '-') return 0
  // Remove "Rp", spaces, commas, and dots for thousands separator
  const cleaned = priceStr.replace(/Rp\s?/g, '').replace(/\./g, '').replace(/,/g, '').trim()
  return parseFloat(cleaned) || 0
}

/**
 * Determine resource type from code prefix
 */
function getResourceType(code) {
  if (!code) return 'material'
  
  const prefix = code.charAt(0).toUpperCase()
  
  switch (prefix) {
    case 'L':
      return 'labor'
    case 'E':
      return 'equipment'
    case 'S':
      return 'subcontractor'
    case 'M':
    default:
      return 'material'
  }
}

/**
 * Map unit to standard ResourceUnit
 */
function mapUnit(unit) {
  if (!unit) return 'unit'
  
  const unitLower = unit.toLowerCase().trim()
  const unitMap = {
    // Volume
    'm3': 'm3',
    'm²': 'm2',
    'm2': 'm2',
    'm1': 'm',
    'meter': 'm',
    'liter': 'ltr',
    'ltr': 'ltr',
    
    // Labor
    'oh': 'oh',
    'oj': 'oh', // Orang Jam -> convert to OH
    'hari': 'hari',
    'jam': 'jam',
    
    // Weight
    'kg': 'kg',
    'ton': 'kg',
    
    // Count
    'buah': 'bh',
    'bh': 'bh',
    'btg': 'bh', // Batang
    'lbr': 'bh', // Lembar
    'lembar': 'bh',
    'ikat': 'bh',
    'set': 'bh',
    'unit': 'unit',
    'roll': 'bh',
    'dus': 'bh',
    'lot': 'bh',
    'rumpun': 'bh',
  }
  
  return unitMap[unitLower] || 'unit'
}

/**
 * Parse DKH.txt file
 */
function parseDKH() {
  const filePath = path.join(__dirname, '..', 'DKH.txt')
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')
  
  const resources = []
  let currentSection = 'Material' // Default section
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (!line) continue
    
    // Check if this is a section header
    if (line.startsWith('HARGA BAHAN')) {
      const match = line.match(/HARGA BAHAN (.+)/)
      if (match) {
        currentSection = match[1].trim()
      }
      continue
    }
    
    // Split by tab
    const parts = line.split('\t').map(p => p.trim())
    
    if (parts.length < 3) continue // Need at least code, name, unit
    
    const [code, name, unit, priceStr] = parts
    
    // Skip if no code or name
    if (!code || !name || name === 'Uraian') continue
    
    // Skip section headers
    if (priceStr === 'Rp-' || !priceStr) continue
    
    const price = parsePrice(priceStr)
    const type = getResourceType(code)
    const mappedUnit = mapUnit(unit)
    
    resources.push({
      code: code.trim(),
      name: name.trim(),
      type,
      unit: mappedUnit,
      unitPrice: price,
      description: `${currentSection} - ${name}`,
      isActive: true,
    })
  }
  
  return resources
}

/**
 * Seed resources to Supabase
 */
async function seedDKH() {
  try {
    console.log('🔄 Parsing DKH.txt...')
    const resources = parseDKH()
    
    console.log(`📊 Parsed ${resources.length} resources`)
    console.log(`   - Material: ${resources.filter(r => r.type === 'material').length}`)
    console.log(`   - Labor: ${resources.filter(r => r.type === 'labor').length}`)
    console.log(`   - Equipment: ${resources.filter(r => r.type === 'equipment').length}`)
    console.log(`   - Subcontractor: ${resources.filter(r => r.type === 'subcontractor').length}`)
    
    // Clear existing resources (optional)
    console.log('\n🗑️  Clearing existing resources...')
    const { error: deleteError } = await supabase
      .from('resources')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all
    
    if (deleteError && deleteError.code !== 'PGRST116') {
      console.error('❌ Error clearing resources:', deleteError)
      // Continue anyway
    }
    
    // Insert in batches of 100
    const batchSize = 100
    let inserted = 0
    let errors = []
    
    console.log('\n📤 Uploading resources to Supabase...')
    
    for (let i = 0; i < resources.length; i += batchSize) {
      const batch = resources.slice(i, i + batchSize)
      
      const { data, error } = await supabase
        .from('resources')
        .insert(batch)
        .select()
      
      if (error) {
        console.error(`❌ Error inserting batch ${i / batchSize + 1}:`, error.message)
        errors.push({ batch: i / batchSize + 1, error: error.message })
      } else {
        inserted += data.length
        process.stdout.write(`\r   Progress: ${inserted}/${resources.length} (${Math.round(inserted / resources.length * 100)}%)`)
      }
    }
    
    console.log('\n\n✅ DKH seeding completed!')
    console.log(`   Total inserted: ${inserted}/${resources.length}`)
    
    if (errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${errors.length}`)
      errors.forEach(e => {
        console.log(`   Batch ${e.batch}: ${e.error}`)
      })
    }
    
    // Summary statistics
    const { data: stats, error: statsError } = await supabase
      .from('resources')
      .select('type')
    
    if (!statsError && stats) {
      const counts = stats.reduce((acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + 1
        return acc
      }, {})
      
      console.log('\n📈 Database Statistics:')
      console.log(`   Material: ${counts.material || 0}`)
      console.log(`   Labor: ${counts.labor || 0}`)
      console.log(`   Equipment: ${counts.equipment || 0}`)
      console.log(`   Subcontractor: ${counts.subcontractor || 0}`)
      console.log(`   TOTAL: ${stats.length}`)
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

// Run the seeding
seedDKH()
