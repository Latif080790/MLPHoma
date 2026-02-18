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
  /** Split Costs (v3 Ultra) */
  cost_material?: number
  cost_labor?: number
  cost_equipment?: number
  cost_subcon?: number
  markup_percentage?: number
  weight_percentage?: number
  /** Optional WBS link */
  wbsId?: string
  /** Optional Timeline Task link */
  taskId?: string
  /** Snapshot price data (for locked baseline) */
  snapshot_price?: any
  /** Optional metadata */
  createdAt?: string
  updatedAt?: string
  /**
   * @deprecated IMPORTANT: This index signature is for backward compatibility only.
   * Do NOT use arbitrary properties. Use explicit fields instead.
   * This will be removed in a future version to enforce type safety.
   * If you need additional fields, add them explicitly to this interface.
   */
  [key: string]: any
}
