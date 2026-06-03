/**
 * AHSP Category Structure
 * Hierarchical work category system for construction projects
 */

export interface WorkCategory {
  id: string
  code: string
  name: string
  description?: string
  parent?: string
  level: number
}

/**
 * Standard work categories based on construction industry
 */
export const WORK_CATEGORIES: WorkCategory[] = [
  // Level 1: Main Categories
  {
    id: '1',
    code: '1',
    name: 'Pekerjaan Persiapan',
    level: 1,
  },
  {
    id: '2',
    code: '2',
    name: 'Pekerjaan Tanah',
    level: 1,
  },
  {
    id: '3',
    code: '3',
    name: 'Pekerjaan Struktur Beton',
    level: 1,
  },
  {
    id: '4',
    code: '4',
    name: 'Pekerjaan Struktur Baja',
    level: 1,
  },
  {
    id: '5',
    code: '5',
    name: 'Pekerjaan Pasangan',
    level: 1,
  },
  {
    id: '6',
    code: '6',
    name: 'Pekerjaan Finishing',
    level: 1,
  },
  {
    id: '7',
    code: '7',
    name: 'Pekerjaan Atap',
    level: 1,
  },
  {
    id: '8',
    code: '8',
    name: 'Pekerjaan Pintu & Jendela',
    level: 1,
  },
  {
    id: '9',
    code: '9',
    name: 'Pekerjaan Utilitas',
    level: 1,
  },
  {
    id: '10',
    code: '10',
    name: 'Pekerjaan Mekanikal & Elektrikal',
    level: 1,
  },

  // Level 2: Pekerjaan Persiapan
  {
    id: '1.1',
    code: '1.1',
    name: 'Mobilisasi & Demobilisasi',
    parent: '1',
    level: 2,
  },
  {
    id: '1.2',
    code: '1.2',
    name: 'Pembersihan Lapangan',
    parent: '1',
    level: 2,
  },
  {
    id: '1.3',
    code: '1.3',
    name: 'Pekerjaan Pengukuran',
    parent: '1',
    level: 2,
  },
  {
    id: '1.4',
    code: '1.4',
    name: 'Fasilitas Sementara',
    parent: '1',
    level: 2,
  },

  // Level 2: Pekerjaan Tanah
  {
    id: '2.1',
    code: '2.1',
    name: 'Galian Tanah',
    parent: '2',
    level: 2,
  },
  {
    id: '2.2',
    code: '2.2',
    name: 'Urugan Tanah',
    parent: '2',
    level: 2,
  },
  {
    id: '2.3',
    code: '2.3',
    name: 'Pemadatan Tanah',
    parent: '2',
    level: 2,
  },
  {
    id: '2.4',
    code: '2.4',
    name: 'Pekerjaan Dewatering',
    parent: '2',
    level: 2,
  },

  // Level 3: Galian Tanah (Detail)
  {
    id: '2.1.1',
    code: '2.1.1',
    name: 'Galian Tanah Biasa 0-1m',
    parent: '2.1',
    level: 3,
    description: 'Galian tanah biasa kedalaman 0 sampai 1 meter',
  },
  {
    id: '2.1.2',
    code: '2.1.2',
    name: 'Galian Tanah Biasa 1-2m',
    parent: '2.1',
    level: 3,
    description: 'Galian tanah biasa kedalaman 1 sampai 2 meter',
  },
  {
    id: '2.1.3',
    code: '2.1.3',
    name: 'Galian Tanah Biasa 2-3m',
    parent: '2.1',
    level: 3,
    description: 'Galian tanah biasa kedalaman 2 sampai 3 meter',
  },
  {
    id: '2.1.4',
    code: '2.1.4',
    name: 'Galian Tanah Keras',
    parent: '2.1',
    level: 3,
    description: 'Galian tanah keras atau berbatu',
  },

  // Level 2: Pekerjaan Struktur Beton
  {
    id: '3.1',
    code: '3.1',
    name: 'Pekerjaan Pondasi',
    parent: '3',
    level: 2,
  },
  {
    id: '3.2',
    code: '3.2',
    name: 'Pekerjaan Sloof',
    parent: '3',
    level: 2,
  },
  {
    id: '3.3',
    code: '3.3',
    name: 'Pekerjaan Kolom',
    parent: '3',
    level: 2,
  },
  {
    id: '3.4',
    code: '3.4',
    name: 'Pekerjaan Balok',
    parent: '3',
    level: 2,
  },
  {
    id: '3.5',
    code: '3.5',
    name: 'Pekerjaan Plat Lantai',
    parent: '3',
    level: 2,
  },
  {
    id: '3.6',
    code: '3.6',
    name: 'Pekerjaan Tangga',
    parent: '3',
    level: 2,
  },

  // Level 3: Pekerjaan Pondasi (Detail)
  {
    id: '3.1.1',
    code: '3.1.1',
    name: 'Pondasi Batu Kali',
    parent: '3.1',
    level: 3,
  },
  {
    id: '3.1.2',
    code: '3.1.2',
    name: 'Pondasi Footplate',
    parent: '3.1',
    level: 3,
  },
  {
    id: '3.1.3',
    code: '3.1.3',
    name: 'Pondasi Sumuran',
    parent: '3.1',
    level: 3,
  },
  {
    id: '3.1.4',
    code: '3.1.4',
    name: 'Pondasi Tiang Pancang',
    parent: '3.1',
    level: 3,
  },

  // Level 2: Pekerjaan Pasangan
  {
    id: '5.1',
    code: '5.1',
    name: 'Pasangan Bata',
    parent: '5',
    level: 2,
  },
  {
    id: '5.2',
    code: '5.2',
    name: 'Pasangan Batako',
    parent: '5',
    level: 2,
  },
  {
    id: '5.3',
    code: '5.3',
    name: 'Pasangan Batu',
    parent: '5',
    level: 2,
  },

  // Level 3: Pasangan Bata (Detail)
  {
    id: '5.1.1',
    code: '5.1.1',
    name: 'Pasangan Bata ½ Batu',
    parent: '5.1',
    level: 3,
  },
  {
    id: '5.1.2',
    code: '5.1.2',
    name: 'Pasangan Bata 1 Batu',
    parent: '5.1',
    level: 3,
  },

  // Level 2: Pekerjaan Finishing
  {
    id: '6.1',
    code: '6.1',
    name: 'Plesteran',
    parent: '6',
    level: 2,
  },
  {
    id: '6.2',
    code: '6.2',
    name: 'Acian',
    parent: '6',
    level: 2,
  },
  {
    id: '6.3',
    code: '6.3',
    name: 'Pengecatan',
    parent: '6',
    level: 2,
  },
  {
    id: '6.4',
    code: '6.4',
    name: 'Keramik & Granit',
    parent: '6',
    level: 2,
  },
  {
    id: '6.5',
    code: '6.5',
    name: 'Plafon',
    parent: '6',
    level: 2,
  },

  // Level 2: Pekerjaan Atap
  {
    id: '7.1',
    code: '7.1',
    name: 'Rangka Atap Kayu',
    parent: '7',
    level: 2,
  },
  {
    id: '7.2',
    code: '7.2',
    name: 'Rangka Atap Baja Ringan',
    parent: '7',
    level: 2,
  },
  {
    id: '7.3',
    code: '7.3',
    name: 'Penutup Atap',
    parent: '7',
    level: 2,
  },

  // Level 2: Pekerjaan Utilitas
  {
    id: '9.1',
    code: '9.1',
    name: 'Instalasi Air Bersih',
    parent: '9',
    level: 2,
  },
  {
    id: '9.2',
    code: '9.2',
    name: 'Instalasi Air Kotor',
    parent: '9',
    level: 2,
  },
  {
    id: '9.3',
    code: '9.3',
    name: 'Drainase',
    parent: '9',
    level: 2,
  },
  {
    id: '9.4',
    code: '9.4',
    name: 'Septictank',
    parent: '9',
    level: 2,
  },

  // Level 2: Pekerjaan ME
  {
    id: '10.1',
    code: '10.1',
    name: 'Instalasi Listrik',
    parent: '10',
    level: 2,
  },
  {
    id: '10.2',
    code: '10.2',
    name: 'AC & Ventilasi',
    parent: '10',
    level: 2,
  },
  {
    id: '10.3',
    code: '10.3',
    name: 'Fire Protection',
    parent: '10',
    level: 2,
  },
]

/**
 * Get category by ID
 */
export function getCategoryById(id: string): WorkCategory | undefined {
  return WORK_CATEGORIES.find(c => c.id === id)
}

/** Compare two dotted codes (e.g. "2.10" vs "2.2") numerically, segment by segment. */
function compareCode(a: string, b: string): number {
  const as = a.split('.').map(Number)
  const bs = b.split('.').map(Number)
  for (let i = 0; i < Math.max(as.length, bs.length); i++) {
    const d = (as[i] ?? 0) - (bs[i] ?? 0)
    if (d !== 0) return d
  }
  return 0
}

/**
 * Get subcategories by parent ID, ordered by construction hierarchy (code).
 */
export function getSubcategories(parentId: string): WorkCategory[] {
  return WORK_CATEGORIES.filter(c => c.parent === parentId).sort((a, b) => compareCode(a.code, b.code))
}

/**
 * Get category hierarchy path
 */
export function getCategoryPath(categoryId: string): WorkCategory[] {
  const path: WorkCategory[] = []
  let current = getCategoryById(categoryId)
  
  while (current) {
    path.unshift(current)
    current = current.parent ? getCategoryById(current.parent) : undefined
  }
  
  return path
}

/**
 * Get category breadcrumb text
 */
export function getCategoryBreadcrumb(categoryId: string): string {
  const path = getCategoryPath(categoryId)
  return path.map(c => c.name).join(' > ')
}

/**
 * Get all level 1 categories (main categories)
 */
export function getMainCategories(): WorkCategory[] {
  return WORK_CATEGORIES.filter(c => c.level === 1).sort((a, b) => compareCode(a.code, b.code))
}

/**
 * Search categories by name
 */
export function searchCategories(query: string): WorkCategory[] {
  const lowerQuery = query.toLowerCase()
  return WORK_CATEGORIES.filter(c =>
    c.name.toLowerCase().includes(lowerQuery) ||
    c.code.includes(lowerQuery) ||
    c.description?.toLowerCase().includes(lowerQuery)
  )
}
