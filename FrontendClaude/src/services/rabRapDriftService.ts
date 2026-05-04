/**
 * rabRapDriftService.ts
 *
 * Detects RAB → RAP price/quantity drift.
 * When RAB items are modified after RAP initialization, this service
 * identifies which RAP items are stale and need re-sync.
 *
 * Usage:
 *   const drifts = await rabRapDriftService.detectDrift(projectId)
 *   // Returns list of items where RAB unit_price or volume has changed
 *   // since the RAP was last initialized.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { eventBus } from '../lib/eventBus'

export interface DriftItem {
  rapItemId: string
  rabItemId: string
  itemName: string
  field: 'unit_price' | 'volume' | 'both'
  rabValue: number
  rapValue: number
  delta: number       // absolute difference
  deltaPct: number    // percentage difference
}

export interface DriftReport {
  projectId: string
  timestamp: string
  totalRapItems: number
  driftCount: number
  drifts: DriftItem[]
  /** True if any drift exceeds 5% — significant enough to warrant re-sync */
  hasSignificantDrift: boolean
}

export const rabRapDriftService = {
  /**
   * Compare RAB items against their linked RAP items.
   * Returns a drift report highlighting items that have diverged.
   */
  async detectDrift(projectId: string): Promise<DriftReport> {
    const client = assertSupabase()

    // Fetch RAP items with their linked RAB data
    const { data: rapItems, error } = await client
      .from('rap_items')
      .select(`
        id,
        rab_item_id,
        name,
        qty_budget,
        unit_price_budget,
        rab_items!inner (
          id,
          volume,
          unit_price
        )
      `)
      .eq('project_id', projectId)
      .not('rab_item_id', 'is', null)

    if (error) {
      console.error('[rabRapDriftService] detectDrift error:', error.message)
      return {
        projectId,
        timestamp: new Date().toISOString(),
        totalRapItems: 0,
        driftCount: 0,
        drifts: [],
        hasSignificantDrift: false,
      }
    }

    const drifts: DriftItem[] = []

    for (const rap of (rapItems || [])) {
      const rab = rap.rab_items as unknown as { id: string; volume: number; unit_price: number } | null
      if (!rab) continue

      const rabVolume = Number(rab.volume || 0)
      const rapQty = Number(rap.qty_budget || 0)
      const rabPrice = Number(rab.unit_price || 0)
      const rapPrice = Number(rap.unit_price_budget || 0)

      const priceDiff = Math.abs(rabPrice - rapPrice)
      const volDiff = Math.abs(rabVolume - rapQty)
      const priceChanged = priceDiff > 0.01
      const volChanged = volDiff > 0.01

      if (priceChanged || volChanged) {
        const primaryDelta = priceChanged ? priceDiff : volDiff
        const primaryBase = priceChanged ? rapPrice : rapQty
        const deltaPct = primaryBase > 0 ? (primaryDelta / primaryBase) * 100 : 100

        drifts.push({
          rapItemId: rap.id,
          rabItemId: rap.rab_item_id!,
          itemName: rap.name || 'Unnamed',
          field: priceChanged && volChanged ? 'both' : priceChanged ? 'unit_price' : 'volume',
          rabValue: priceChanged ? rabPrice : rabVolume,
          rapValue: priceChanged ? rapPrice : rapQty,
          delta: primaryDelta,
          deltaPct: Math.round(deltaPct * 100) / 100,
        })
      }
    }

    return {
      projectId,
      timestamp: new Date().toISOString(),
      totalRapItems: rapItems?.length || 0,
      driftCount: drifts.length,
      drifts: drifts.sort((a, b) => b.deltaPct - a.deltaPct),
      hasSignificantDrift: drifts.some(d => d.deltaPct > 5),
    }
  },
}

// ─── Event Bus Subscriber ────────────────────────────────────────────────────
// Automatically detect drift when RAB items change
eventBus.on('rab:changed', ({ projectId, changeType }) => {
  if (changeType === 'update' || changeType === 'import') {
    // Fire-and-forget drift check — results logged to console for now
    void rabRapDriftService.detectDrift(projectId).then((report) => {
      if (report.hasSignificantDrift) {
        console.warn(
          `[RAB→RAP Drift] ${report.driftCount} items have drifted in project ${projectId}. ` +
          `Most significant: ${report.drifts[0]?.itemName} (${report.drifts[0]?.deltaPct}%)`
        )
      }
    })
  }
})
