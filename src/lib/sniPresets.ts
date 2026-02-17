/**
 * SNI Presets Library
 * Pre-configured AHSP items based on SNI standards
 */

export interface SNIPreset {
  code: string
  name: string
  category: string
  unit: string
  components: SNIComponent[]
  description?: string
}

export interface SNIComponent {
  type: 'material' | 'labor' | 'equipment' | 'subcontractor'
  code: string
  name: string
  unit: string
  coefficient: number
  estimatedPrice: number
  notes?: string
}

export const SNI_PRESETS: SNIPreset[] = [
  {
    code: 'A.2.2.1',
    name: 'Pemasangan 1m2 Dinding Bata Merah',
    category: 'PEKERJAAN DINDING',
    unit: 'm2',
    description: 'Pemasangan dinding bata merah standar SNI dengan spesi 1:4',
    components: [
      {
        type: 'material',
        code: 'M.01',
        name: 'Bata Merah',
        unit: 'bh',
        coefficient: 70,
        estimatedPrice: 1000,
        notes: '70 buah per m2'
      },
      {
        type: 'material',
        code: 'M.02',
        name: 'Semen Portland',
        unit: 'kg',
        coefficient: 11.5,
        estimatedPrice: 1500,
        notes: 'Untuk spesi 1:4'
      },
      {
        type: 'material',
        code: 'M.03',
        name: 'Pasir Pasang',
        unit: 'm3',
        coefficient: 0.043,
        estimatedPrice: 200000
      },
      {
        type: 'labor',
        code: 'L.01',
        name: 'Pekerja',
        unit: 'oh',
        coefficient: 0.3,
        estimatedPrice: 150000
      },
      {
        type: 'labor',
        code: 'L.02',
        name: 'Tukang Batu',
        unit: 'oh',
        coefficient: 0.1,
        estimatedPrice: 200000
      },
      {
        type: 'labor',
        code: 'L.03',
        name: 'Kepala Tukang',
        unit: 'oh',
        coefficient: 0.01,
        estimatedPrice: 250000
      }
    ]
  },
  {
    code: 'A.2.3.1',
    name: 'Plesteran 1m2 Dinding',
    category: 'PEKERJAAN PLESTERAN',
    unit: 'm2',
    description: 'Plesteran dinding 1:4 tebal 15mm',
    components: [
      {
        type: 'material',
        code: 'M.02',
        name: 'Semen Portland',
        unit: 'kg',
        coefficient: 6.24,
        estimatedPrice: 1500
      },
      {
        type: 'material',
        code: 'M.03',
        name: 'Pasir Pasang',
        unit: 'm3',
        coefficient: 0.024,
        estimatedPrice: 200000
      },
      {
        type: 'labor',
        code: 'L.01',
        name: 'Pekerja',
        unit: 'oh',
        coefficient: 0.3,
        estimatedPrice: 150000
      },
      {
        type: 'labor',
        code: 'L.02',
        name: 'Tukang Batu',
        unit: 'oh',
        coefficient: 0.15,
        estimatedPrice: 200000
      },
      {
        type: 'labor',
        code: 'L.03',
        name: 'Kepala Tukang',
        unit: 'oh',
        coefficient: 0.015,
        estimatedPrice: 250000
      }
    ]
  },
  {
    code: 'B.1.1.1',
    name: 'Pembuatan 1 m³ Beton K-225',
    category: 'PEKERJAAN BETON',
    unit: 'm3',
    description: 'Beton mutu K-225 dengan slump 12cm',
    components: [
      {
        type: 'material',
        code: 'M.02',
        name: 'Semen Portland',
        unit: 'kg',
        coefficient: 371,
        estimatedPrice: 1500
      },
      {
        type: 'material',
        code: 'M.04',
        name: 'Pasir Beton',
        unit: 'm3',
        coefficient: 0.54,
        estimatedPrice: 250000
      },
      {
        type: 'material',
        code: 'M.05',
        name: 'Kerikil (Split)',
        unit: 'm3',
        coefficient: 0.81,
        estimatedPrice: 300000
      },
      {
        type: 'material',
        code: 'M.06',
        name: 'Air',
        unit: 'ltr',
        coefficient: 215,
        estimatedPrice: 50
      },
      {
        type: 'labor',
        code: 'L.01',
        name: 'Pekerja',
        unit: 'oh',
        coefficient: 2.1,
        estimatedPrice: 150000
      },
      {
        type: 'labor',
        code: 'L.02',
        name: 'Tukang Batu',
        unit: 'oh',
        coefficient: 0.7,
        estimatedPrice: 200000
      },
      {
        type: 'labor',
        code: 'L.03',
        name: 'Kepala Tukang',
        unit: 'oh',
        coefficient: 0.07,
        estimatedPrice: 250000
      },
      {
        type: 'equipment',
        code: 'E.01',
        name: 'Concrete Mixer',
        unit: 'jam',
        coefficient: 0.9,
        estimatedPrice: 75000
      }
    ]
  },
  {
    code: 'C.1.1.1',
    name: 'Pembuatan 1 m¹ Pagar Sementara dari Kayu tinggi 2 meter',
    category: 'PERSIAPAN',
    unit: 'M1',
    description: 'Pagar pengaman sementara dari papan kayu',
    components: [
      {
        type: 'material',
        code: 'M.07',
        name: 'Papan Kayu 3/20',
        unit: 'm3',
        coefficient: 0.04,
        estimatedPrice: 3500000
      },
      {
        type: 'material',
        code: 'M.08',
        name: 'Dolken Kayu Diameter 8-10cm',
        unit: 'btg',
        coefficient: 1,
        estimatedPrice: 35000
      },
      {
        type: 'material',
        code: 'M.09',
        name: 'Paku Usuk 5-7cm',
        unit: 'kg',
        coefficient: 0.4,
        estimatedPrice: 20000
      },
      {
        type: 'labor',
        code: 'L.04',
        name: 'Tukang Kayu',
        unit: 'oh',
        coefficient: 0.33,
        estimatedPrice: 200000
      },
      {
        type: 'labor',
        code: 'L.03',
        name: 'Kepala Tukang',
        unit: 'oh',
        coefficient: 0.033,
        estimatedPrice: 250000
      },
      {
        type: 'labor',
        code: 'L.01',
        name: 'Pekerja',
        unit: 'oh',
        coefficient: 0.66,
        estimatedPrice: 150000
      }
    ]
  },
  {
    code: 'D.1.1.1',
    name: 'Pemasangan 1 m² Rangka Atap Baja Ringan',
    category: 'RANGKA ATAP',
    unit: 'm2',
    description: 'Rangka atap dengan baja ringan CNP 75mm',
    components: [
      {
        type: 'material',
        code: 'M.10',
        name: 'Baja Ringan CNP 75mm',
        unit: 'btg',
        coefficient: 1.2,
        estimatedPrice: 65000
      },
      {
        type: 'material',
        code: 'M.11',
        name: 'Reng Baja Ringan',
        unit: 'btg',
        coefficient: 1.5,
        estimatedPrice: 35000
      },
      {
        type: 'material',
        code: 'M.12',
        name: 'Sekrup Baja Ringan',
        unit: 'pcs',
        coefficient: 20,
        estimatedPrice: 500
      },
      {
        type: 'labor',
        code: 'L.05',
        name: 'Tukang Besi',
        unit: 'oh',
        coefficient: 0.2,
        estimatedPrice: 200000
      },
      {
        type: 'labor',
        code: 'L.03',
        name: 'Kepala Tukang',
        unit: 'oh',
        coefficient: 0.02,
        estimatedPrice: 250000
      },
      {
        type: 'labor',
        code: 'L.01',
        name: 'Pekerja',
        unit: 'oh',
        coefficient: 0.4,
        estimatedPrice: 150000
      }
    ]
  },
  {
    code: 'E.1.1.1',
    name: 'Pengecatan 1 m² Dinding (2 Lapis)',
    category: 'FINISHING',
    unit: 'm2',
    description: 'Pengecatan tembok dengan cat emulsi 2 lapis',
    components: [
      {
        type: 'material',
        code: 'M.13',
        name: 'Cat Emulsi',
        unit: 'kg',
        coefficient: 0.2,
        estimatedPrice: 75000
      },
      {
        type: 'material',
        code: 'M.14',
        name: 'Plamir',
        unit: 'kg',
        coefficient: 0.15,
        estimatedPrice: 25000
      },
      {
        type: 'material',
        code: 'M.15',
        name: 'Amplas',
        unit: 'lbr',
        coefficient: 0.1,
        estimatedPrice: 5000
      },
      {
        type: 'labor',
        code: 'L.06',
        name: 'Tukang Cat',
        unit: 'oh',
        coefficient: 0.2,
        estimatedPrice: 180000
      },
      {
        type: 'labor',
        code: 'L.03',
        name: 'Kepala Tukang',
        unit: 'oh',
        coefficient: 0.02,
        estimatedPrice: 250000
      },
      {
        type: 'labor',
        code: 'L.01',
        name: 'Pekerja',
        unit: 'oh',
        coefficient: 0.1,
        estimatedPrice: 150000
      }
    ]
  }
]

/**
 * Get SNI preset by code
 */
export function getSNIPreset(code: string): SNIPreset | undefined {
  return SNI_PRESETS.find(p => p.code === code)
}

/**
 * Search SNI presets by keyword
 */
export function searchSNIPresets(query: string): SNIPreset[] {
  const lowerQuery = query.toLowerCase()
  return SNI_PRESETS.filter(p =>
    p.code.toLowerCase().includes(lowerQuery) ||
    p.name.toLowerCase().includes(lowerQuery) ||
    p.category.toLowerCase().includes(lowerQuery) ||
    p.description?.toLowerCase().includes(lowerQuery)
  )
}

/**
 * Get SNI presets by category
 */
export function getSNIPresetsByCategory(category: string): SNIPreset[] {
  return SNI_PRESETS.filter(p => p.category === category)
}

/**
 * Get all unique categories
 */
export function getSNICategories(): string[] {
  return Array.from(new Set(SNI_PRESETS.map(p => p.category)))
}


