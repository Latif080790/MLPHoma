
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load env vars
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dirname, '../.env.local')

let SUPABASE_URL = process.env.VITE_SUPABASE_URL
let SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) return
    const [key, ...valueParts] = trimmed.split('=')
    if (key && valueParts.length) {
      const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '')
      if (key.trim() === 'VITE_SUPABASE_URL') SUPABASE_URL = val
      if (key.trim() === 'VITE_SUPABASE_ANON_KEY') SUPABASE_KEY = val
    }
  })
}

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Error: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be set in .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

async function clearAndSeed() {
  console.log('🗑️  Clearing existing AHSP data...')
  
  // Delete in correct order (components first due to foreign key)
  await supabase.from('ahsp_components').delete().neq('id', '')
  console.log('✓ Cleared components')
  
  await supabase.from('ahsp_items').delete().neq('id', '')
  console.log('✓ Cleared AHSP items')
  
  await supabase.from('resources').delete().neq('id', '')
  console.log('✓ Cleared resources')
  
  console.log('\n📦 Reading AHSP_IMPORT_TEMPLATE.json...')
  const jsonPath = path.resolve(__dirname, '../AHSP_IMPORT_TEMPLATE.json')
  const rawData = fs.readFileSync(jsonPath, 'utf-8')
  const items = JSON.parse(rawData)

  console.log(`Found ${items.length} AHSP items. Processing...`)

  const resourcesMap = new Map()
  const ahspRows = []
  const componentRows = []

  const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // Track codes to handle duplicates
  const codeCount = new Map()

  for (const item of items) {
    const ahspId = generateId('ahsp')
    
    // Handle duplicate codes by adding suffix
    let code = item.code
    if (codeCount.has(code)) {
      const count = codeCount.get(code) + 1
      codeCount.set(code, count)
      code = `${code}.${count}`
    } else {
      codeCount.set(code, 1)
    }
    
    ahspRows.push({
      id: ahspId,
      code: code,
      name: item.name,
      description: item.description || '',
      unit: item.unit,
      category: item.category,
      base_price: item.basePrice || 0,
      final_price: item.basePrice || 0,
      overhead_percentage: item.overheadPercentage || 0,
      profit_percentage: item.profitPercentage || 0,
      is_active: item.isActive !== false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    if (item.components && Array.isArray(item.components)) {
      for (const comp of item.components) {
        const resCode = comp.code || comp.name || `res-${Math.random()}`
        let resId = resourcesMap.get(resCode)?.id

        if (!resId) {
          resId = generateId('res')
          const typeMap = {
            'Labor': 'labor',
            'Material': 'material',
            'Equipment': 'equipment',
            'Subcontractor': 'subcontractor'
          }
          
          resourcesMap.set(resCode, {
            id: resId,
            code: comp.code || resCode,
            name: comp.name || 'Unknown Resource',
            type: typeMap[comp.category] || 'material',
            unit: comp.unit || 'unit',
            unit_price: comp.price || 0,
            is_active: true,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }

        const resource = resourcesMap.get(resCode)
        componentRows.push({
          id: generateId('comp'),
          ahsp_id: ahspId,
          resource_id: resId,
          type: resource.type,
          coefficient: comp.coefficient || 0,
          unit: comp.unit || resource.unit,
          unit_price: comp.price || 0,
          subtotal: (comp.coefficient || 0) * (comp.price || 0),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    }
  }

  const resources = Array.from(resourcesMap.values())

  console.log(`\n📊 Prepared data:`)
  console.log(`- ${resources.length} Resources`)
  console.log(`- ${ahspRows.length} AHSP Items`)
  console.log(`- ${componentRows.length} Components`)

  // Insert Resources
  console.log('\n⬆️  Inserting Resources...')
  const { error: resError } = await supabase.from('resources').insert(resources)
  if (resError) {
    console.error('❌ Error inserting resources:', resError.message)
    process.exit(1)
  }
  console.log('✅ Resources inserted')

  // Insert AHSP Items
  console.log('⬆️  Inserting AHSP Items...')
  const { error: ahspError } = await supabase.from('ahsp_items').insert(ahspRows)
  if (ahspError) {
    console.error('❌ Error inserting AHSP items:', ahspError.message)
    process.exit(1)
  }
  console.log('✅ AHSP Items inserted')

  // Insert Components in batches
  console.log('⬆️  Inserting Components...')
  const chunkSize = 100
  for (let i = 0; i < componentRows.length; i += chunkSize) {
    const chunk = componentRows.slice(i, i + chunkSize)
    const { error: compError } = await supabase.from('ahsp_components').insert(chunk)
    if (compError) {
      console.error(`❌ Error inserting components chunk ${i}:`, compError.message)
      process.exit(1)
    }
    console.log(`  ✓ Inserted chunk ${Math.floor(i/chunkSize) + 1}/${Math.ceil(componentRows.length/chunkSize)}`)
  }
  console.log('✅ All components inserted')
  
  console.log('\n🎉 Database seeded successfully!')
}

clearAndSeed().catch(err => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
