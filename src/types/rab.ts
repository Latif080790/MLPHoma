/**
 * rab.ts
 * RAB (Budget) item types used across modules (RAP, Reports, Resource, Curva-S)
 */

/**
 * RABItem
 * Unified type definition - single source of truth.
 * Includes all field variations used across the codebase.
 */
export interface RABItem {
  /** Unique identifier */
  id: string
  /** Project reference */
  projectId: string
  /** Code fields (various naming used across codebase) */
  code?: string
  itemCode?: string
  item_code?: string
  /** Name fields (various naming used across codebase) */
  name?: string
  item_name?: string
  /** Unit */
  unit?: string
  /** Quantities and prices */
  volume?: number
  unit_price?: number
  unitPrice?: number
  /** Computed totals */
  finalTotal?: number
  final_total?: number
  finalPrice?: number
  /** Enterprise Fields */
  is_overhead?: boolean
  boq_id?: string
  /** Split Costs (v3 Ultra) */
  cost_material?: number
  cost_labor?: number
  cost_equipment?: number
  cost_subcon?: number
  markup_percentage?: number
  weight_percentage?: number
  /** TKDN / Local Content (v3 Enterprise) */
  is_domestic?: boolean
  tkdn_percentage?: number
  /** Optional WBS link */
  wbsId?: string
  /** Optional Timeline Task link */
  taskId?: string
  /** AHSP Item link (Task 42: added for AHSP→RAB→Resource Plan chain) */
  ahspItemId?: string
  ahsp_item_id?: string
  /**
   * markup_source — Anti-Double-Counting discriminant.
   *   'project_level' (default): unit_price is pure base cost; overhead/profit applied at RAB aggregate level.
   *   'baked_in': unit_price already includes OH/profit (e.g. AHSP finalPrice). Skip re-applying markup.
   *   'none': no markup at all (e.g. provisional sums, contingency lines).
   */
  markup_source?: 'project_level' | 'baked_in' | 'none'
  /**
   * profit_basis — configures whether profit is compounded on (base + overhead) or applied to base only.
   *   'base_plus_overhead' (default): profit = (base + overhead) × profitPct  ← current SNI-standard behavior
   *   'base': profit = base × profitPct  ← simple margin; avoids amplifying overhead into profit
   */
  profit_basis?: 'base_plus_overhead' | 'base'
  /** Snapshot price data (for locked baseline) */
  snapshot_price?: unknown
  /** Optional metadata */
  createdAt?: string
  updatedAt?: string
  /**
   * @deprecated IMPORTANT: This index signature is for backward compatibility only.
   * Do NOT use arbitrary properties. Use explicit fields instead.
   * This will be removed in a future version to enforce type safety.
   * If you need additional fields, add them explicitly to this interface.
   */
  [key: string]: unknown
}
