/**
 * dkhParser.ts
 * Parser for DKH (Daftar Kuantitas & Harga) text files
 */

import type { ResourceType, ResourceUnit } from '../types/ahsp'

export interface ParsedResource {
  code: string
  name: string
  type: ResourceType
  unit: ResourceUnit
  unitPrice: number
  description: string
  isActive: boolean
}

/**
 * Parse price from Indonesian Rupiah format
 */
export function parsePrice(priceStr: string): number {
  if (!priceStr || priceStr === '-') return 0
  // Remove "Rp", spaces, commas, and dots for thousands separator
  const cleaned = priceStr.replace(/Rp\s?/g, '').replace(/\./g, '').replace(/,/g, '').trim()
  return parseFloat(cleaned) || 0
}

/**
 * Determine resource type from code prefix
 */
export function getResourceType(code: string): ResourceType {
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
export function mapUnit(unit: string): ResourceUnit {
  if (!unit) return 'unit'
  
  const unitLower = unit.toLowerCase().trim()
  const unitMap: Record<string, ResourceUnit> = {
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
 * Parse DKH text content
 */
export function parseDKHText(content: string): ParsedResource[] {
  const lines = content.split('\n')
  const resources: ParsedResource[] = []
  let currentSection = 'Material' // Default section
  
  // Skip header row
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim()
    
    if (!line) continue
    
    // Check if this is a section header
    if (line.includes('HARGA BAHAN')) {
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
 * Import DKH from file
 */
export async function importDKHFromFile(file: File): Promise<ParsedResource[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const resources = parseDKHText(content)
        resolve(resources)
      } catch (error) {
        reject(error)
      }
    }
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'))
    }
    
    reader.readAsText(file, 'UTF-8')
  })
}
