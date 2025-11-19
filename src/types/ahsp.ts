
/**
 * ahsp.ts
 * Type definitions for AHSP (Analisis Harga Satuan Pekerjaan)
 */

/** Resource types */
export type ResourceType = 'material' | 'labor' | 'equipment' | 'subcontractor'

/** Resource unit types */
export type ResourceUnit = 'kg' | 'm3' | 'm2' | 'm' | 'ltr' | 'bh' | 'oh' | 'jam' | 'hr' | 'hari' | 'unit'

/** Resource */
export interface Resource {
  /** Unique identifier */
  id: string
  /** Resource code (e.g., "M-001", "L-001") */
  code: string
  /** Resource name */
  name: string
  /** Resource type */
  type: ResourceType
  /** Unit of measurement */
  unit: ResourceUnit
  /** Unit price */
  unitPrice: number
  /** Supplier information */
  supplier?: string
  /** Specifications or notes */
  specifications?: string
  /** Whether resource is active */
  isActive: boolean
  /** Creation timestamp */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
}

/** AHSP Component - part of AHSP analysis */
export interface AHSPComponent {
  /** Unique identifier */
  id: string
  /** AHSP item ID this component belongs to */
  ahspId: string
  /** Component type */
  type: ResourceType
  /** Resource ID */
  resourceId: string
  /** Resource information (cached) */
  resource?: Resource
  /** Coefficient/quantity needed per AHSP unit */
  coefficient: number
  /** Unit */
  unit: ResourceUnit
  /** Unit price (cached) */
  unitPrice: number
  /** Subtotal (coefficient × unitPrice) */
  subtotal: number
  /** Notes for this component */
  notes?: string
  /** Creation timestamp */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
}

/** AHSP Item - complete analysis */
export interface AHSPItem {
  /** Unique identifier */
  id: string
  /** AHSP code (e.g., "6.3.2.7") */
  code: string
  /** AHSP name/description */
  name: string
  /** Unit of measurement */
  unit: ResourceUnit
  /** Category/group */
  category: string
  /** Base price calculated from components */
  basePrice: number
  /** Overhead percentage */
  overheadPercentage?: number
  /** Profit percentage */
  profitPercentage?: number
  /** Final price (base + overhead + profit) */
  finalPrice: number
  /** Detailed description */
  description?: string
  /** Whether this AHSP is active */
  isActive: boolean
  /** Creation timestamp */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
}

/** AHSP Store State */
export interface AHSPState {
  /** All resources */
  resources: Resource[]
  /** All AHSP items */
  ahspItems: AHSPItem[]
  /** Components indexed by AHSP ID */
  componentsByAHSP: Record<string, AHSPComponent[]>
  /** Loading states */
  loading: {
    resources: boolean
    ahspItems: boolean
    components: boolean
  }
  /** Error states */
  errors: {
    resources: string | null
    ahspItems: string | null
    components: string | null
  }
}

/** AHSP Actions */
export interface AHSPActions {
  // Resource actions
  addResource: (resource: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateResource: (id: string, updates: Partial<Resource>) => void
  deleteResource: (id: string) => void
  importResources: (resources: Omit<Resource, 'id' | 'createdAt' | 'updatedAt'>[]) => void
  exportResources: () => Resource[]
  
  // AHSP item actions
  addAHSPItem: (item: Omit<AHSPItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  updateAHSPItem: (id: string, updates: Partial<AHSPItem>) => void
  deleteAHSPItem: (id: string) => void
  importAHSPItems: (items: Omit<AHSPItem, 'id' | 'createdAt' | 'updatedAt'>[]) => void
  exportAHSPItems: () => AHSPItem[]
  
  // Component actions
  addComponent: (ahspId: string, component: Omit<AHSPComponent, 'id' | 'ahspId' | 'createdAt' | 'updatedAt'>) => void
  updateComponent: (id: string, updates: Partial<AHSPComponent>) => void
  deleteComponent: (id: string) => void
  reorderComponents: (ahspId: string, componentIds: string[]) => void
  
  // Calculation actions
  calculateAHSPPrice: (ahspId: string) => void
  recalculateAllPrices: () => void
  
  // Bulk actions
  bulkUpdatePrices: (type: ResourceType, percentage: number) => void
  
  // Search and filter
  searchResources: (query: string) => Resource[]
  searchAHSPItems: (query: string) => AHSPItem[]
  filterByCategory: (category: string) => AHSPItem[]
}

/** AHSP Store Interface */
export interface AHSPStore extends AHSPState, AHSPActions {}

/** AHSP Import Template */
export interface AHSPImportTemplate {
  code: string
  name: string
  unit: string
  category: string
  description?: string
  basePrice?: number
}

/** Resource Import Template */
export interface ResourceImportTemplate {
  code: string
  name: string
  type: ResourceType
  unit: string
  unitPrice: number
  supplier?: string
  specifications?: string
}

/** AHSP Component Template */
export interface AHSPComponentTemplate {
  type: ResourceType
  resourceCode: string
  resourceName: string
  coefficient: number
  unit: string
  unitPrice: number
}

/** AHSP Summary */
export interface AHSPSummary {
  totalAHSPItems: number
  totalResources: number
  averagePrice: number
  priceByCategory: Record<string, { count: number; totalPrice: number }>
  resourcesByType: Record<ResourceType, { count: number; totalPrice: number }>
}

/** AHSP Validation Result */
export interface AHSPValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}
