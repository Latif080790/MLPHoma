
import { createClient } from '@supabase/supabase-js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// Load env vars manually since dotenv might not be installed
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
      const val = valueParts.join('=').trim().replace(/^["']|["']$/g, '') // Remove quotes
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

async function seed() {
  console.log('Reading AHSP_IMPORT_TEMPLATE.json...')
  const jsonPath = path.resolve(__dirname, '../AHSP_IMPORT_TEMPLATE.json')
  const rawData = fs.readFileSync(jsonPath, 'utf-8')
  const items = JSON.parse(rawData)

  console.log(`Found ${items.length} AHSP items. Processing...`)

  const resourcesMap = new Map() // Code -> ResourceRow
  const ahspRows = []
  const componentRows = []

  // Helper to generate ID
  const generateId = (prefix) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`

  for (const item of items) {
    const ahspId = generateId('ahsp')
    
    // Prepare AHSP Row
    ahspRows.push({
      id: ahspId,
      code: item.code,
      name: item.name,
      description: item.description,
      unit: item.unit,
      category: item.category,
      base_price: item.basePrice,
      final_price: item.basePrice, // Assuming no overhead/profit in template initially
      overhead_percentage: item.overheadPercentage || 0,
      profit_percentage: item.profitPercentage || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

    // Process Components
    if (item.components) {
      for (const comp of item.components) {
        // Identify Resource
        const resCode = comp.code || comp.name // Fallback to name if code missing
        let resId = resourcesMap.get(resCode)?.id

        if (!resId) {
          resId = generateId('res')
          const typeMap = {
            'Labor': 'labor',
            'Material': 'material',
            'Equipment': 'equipment'
          }
          
          resourcesMap.set(resCode, {
            id: resId,
            code: comp.code || '-',
            name: comp.name,
            type: typeMap[comp.category] || 'material',
            unit: comp.unit,
            unit_price: comp.price,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        }

        // Prepare Component Row
        componentRows.push({
          id: generateId('comp'),
          ahsp_id: ahspId,
          resource_id: resId,
          type: resourcesMap.get(resCode).type,
          coefficient: comp.coefficient,
          unit: comp.unit,
          unit_price: comp.price,
          subtotal: comp.coefficient * comp.price,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
      }
    }
  }

  const resources = Array.from(resourcesMap.values())

  console.log(`Prepared data:`)
  console.log(`- ${resources.length} Resources`)
  console.log(`- ${ahspRows.length} AHSP Items`)
  console.log(`- ${componentRows.length} Components`)

  // Insert Resources
  console.log('Inserting Resources...')
  const { error: resError } = await supabase.from('resources').upsert(resources, { onConflict: 'id' })
  if (resError) {
    console.error('Error inserting resources:', resError)
    console.log('Hint: Does the "resources" table exist?')
  } else {
    console.log('✓ Resources inserted')
  }

  // Insert AHSP Items
  console.log('Inserting AHSP Items...')
  const { error: ahspError } = await supabase.from('ahsp_items').upsert(ahspRows, { onConflict: 'id' })
  if (ahspError) {
    console.error('Error inserting AHSP items:', ahspError)
  } else {
    console.log('✓ AHSP Items inserted')
  }

  // Insert Components
  console.log('Inserting Components...')
  // Batch insert components in chunks to avoid payload limit
  const chunkSize = 100
  for (let i = 0; i < componentRows.length; i += chunkSize) {
    const chunk = componentRows.slice(i, i + chunkSize)
    const { error: compError } = await supabase.from('ahsp_components').upsert(chunk, { onConflict: 'id' })
    if (compError) {
      console.error(`Error inserting components chunk ${i}:`, compError)
      console.log('Hint: Does the "ahsp_components" table exist?')
      break
    }
  }
  console.log('✓ Components inserted')
}

seed().catch(console.error)
