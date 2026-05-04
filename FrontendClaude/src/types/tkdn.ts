/**
 * tkdn.ts
 * TKDN (Tingkat Komponen Dalam Negeri / Domestic Component Level) types.
 *
 * TKDN measures the percentage of domestic vs imported content in a
 * construction project, required by Indonesian government regulations
 * (Permen Perindustrian No. 16/2011 & updates).
 */

/** Origin of a resource: domestic or imported */
export type ResourceOrigin = 'domestic' | 'imported'

/** Resource category in TKDN calculation */
export type TKDNCategory = 'material' | 'labor' | 'equipment' | 'service'

/**
 * TKDNItem
 * A single resource/item tracked for TKDN calculation.
 */
export interface TKDNItem {
  /** Unique ID */
  id: string
  /** Parent project */
  project_id: string
  /** Resource name (material, equipment, etc.) */
  name: string
  /** Category */
  category: TKDNCategory
  /** Domestic or imported */
  origin: ResourceOrigin
  /** Unit of measurement */
  unit: string
  /** Quantity used */
  quantity: number
  /** Unit price in IDR */
  unit_price: number
  /** Total value = quantity × unit_price */
  total_value: number
  /** supplier/vendor name */
  supplier?: string
  /** Country of origin (e.g., "Indonesia", "China") */
  country_of_origin?: string
  /** HS Code for traceability */
  hs_code?: string
  /** Optional link to RAB item */
  rab_item_id?: string
  /** Notes */
  notes?: string
  /** Timestamps */
  created_at?: string
  updated_at?: string
}

/**
 * TKDNSummary
 * Aggregated TKDN calculation result per project.
 */
export interface TKDNSummary {
  /** Project ID */
  project_id: string
  /** Total domestic value in IDR */
  total_domestic: number
  /** Total imported value in IDR */
  total_imported: number
  /** Overall TKDN percentage (0-100) */
  tkdn_percentage: number
  /** Breakdown by category */
  by_category: TKDNCategoryBreakdown[]
  /** Target TKDN percentage (e.g., 40% min required) */
  target_percentage: number
  /** Whether current TKDN meets the target */
  meets_target: boolean
  /** Last calculated date */
  calculated_at: string
}

/**
 * TKDNCategoryBreakdown
 * Per-category TKDN analysis.
 */
export interface TKDNCategoryBreakdown {
  category: TKDNCategory
  domestic_value: number
  imported_value: number
  total_value: number
  tkdn_percentage: number
  item_count: number
}

/**
 * TKDNCreateInput
 * Input shape for creating a new TKDN item.
 */
export type TKDNCreateInput = Omit<TKDNItem, 'id' | 'total_value' | 'created_at' | 'updated_at'>

/**
 * TKDNUpdateInput
 * Input shape for updating a TKDN item.
 */
export type TKDNUpdateInput = Partial<Omit<TKDNItem, 'id' | 'project_id' | 'created_at'>>
