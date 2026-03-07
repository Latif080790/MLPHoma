/**
 * rabWbsLink.ts
 * Type definitions for the RAB ↔ WBS Smart Allocation linking system.
 *
 * A single RAB item may be linked to multiple WBS nodes.
 * Each link carries an allocationPct (0–100) that determines what share
 * of the RAB item's budget is attributed to that WBS node.
 * The sum of allocationPct across all links for one RAB item should equal 100.
 * The app enforces equal-split as default and warns when sum ≠ 100.
 */

export interface RabWbsLink {
  /** Supabase row id (uuid) */
  id: string
  /** FK → rab_items.id */
  rabItemId: string
  /** FK → wbs_items.id (soft reference — app handles cascade on delete) */
  wbsItemId: string
  /**
   * Proportion of the RAB item's cost attributed to this WBS node.
   * 0 – 100.  Default: 100 / total links for this rab item (equal split).
   */
  allocationPct: number
  createdAt?: string
  updatedAt?: string
}

/** Supabase snake_case row shape (returned from DB) */
export interface RabWbsLinkRow {
  id: string
  rab_item_id: string
  wbs_item_id: string
  allocation_pct: number
  created_at: string
  updated_at: string
}

/** Helper: allocated amount for a WBS node from one RAB item */
export function allocatedAmount(total: number, pct: number): number {
  return (total * pct) / 100
}

/** Convert DB row → app type */
export function rowToLink(row: RabWbsLinkRow): RabWbsLink {
  return {
    id: row.id,
    rabItemId: row.rab_item_id,
    wbsItemId: row.wbs_item_id,
    allocationPct: Number(row.allocation_pct),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
