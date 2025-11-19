/**
 * rab.ts
 * RAB (Budget) item types used across modules (RAP, Reports, Resource, Curva-S)
 */

/**
 * RABItem
 * Minimal fields required by current modules.
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
  volume: number
  unit_price?: number
  unitPrice?: number
  /** Computed totals */
  finalTotal?: number
  final_total?: number
  finalPrice?: number
  /** Optional WBS link */
  wbsId?: string
  /** Optional metadata */
  createdAt?: string
  updatedAt?: string
}
