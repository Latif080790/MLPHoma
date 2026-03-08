/**
 * livingPriceService.ts
 * Integrates Procurement (PO/GRN) prices back into RAB for "Living Price" analysis.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { ahspSnapshotService } from './ahspSnapshotService'

export interface HistoricalPrice {
    poId: string
    poNumber: string
    vendorName: string
    date: string
    unitPrice: number
    quantity: number
}

export interface PriceComparison {
    rabId: string
    itemCode: string
    itemName: string
    volume: number
    unit: string
    baselinePrice: number // Snapshot or current AHSP when snapshotted
    currentAhspPrice: number
    livingPrice: number | null // Latest historical procurement price
    drift: number // currentAhsp - baseline
    potentialImpact: number // drift * volume
}

export const livingPriceService = {
    /**
     * Fetch procurement history for a specific RAB item (matched by code or name)
     * Note: po_items table may not exist yet — returns empty array gracefully
     */
    async getProcurementHistory(projectId: string, itemCode?: string, itemName?: string): Promise<HistoricalPrice[]> {
        if (!itemCode && !itemName) return []

        try {
            const client = assertSupabase()

            let query = client
                .from('po_items')
                .select(`
        unit_price,
        quantity,
        purchase_orders (
          id,
          po_number,
          vendor_name,
          created_at
        )
      `)
                .eq('purchase_orders.project_id', projectId)

            if (itemCode) {
                query = query.eq('item_code', itemCode)
            } else if (itemName) {
                query = query.eq('item_name', itemName)
            }

            const { data, error } = await query.order('created_at', { foreignTable: 'purchase_orders', ascending: false }).limit(5)

            if (error) {
                // Table may not exist — this is expected until procurement module is implemented
                console.warn('[livingPriceService] po_items query skipped (table may not exist):', error.code)
                return []
            }

            type PoItemWithPo = { unit_price?: number; quantity?: number; purchase_orders?: { id?: string; po_number?: string; vendor_name?: string; created_at?: string }[] | null }
            return (data || []).map((row: PoItemWithPo) => {
                const po = Array.isArray(row.purchase_orders) ? row.purchase_orders[0] : row.purchase_orders
                return {
                    poId: po?.id || '',
                    poNumber: po?.po_number || '',
                    vendorName: po?.vendor_name || '',
                    date: po?.created_at || '',
                    unitPrice: Number(row.unit_price || 0),
                    quantity: Number(row.quantity || 0)
                }
            })
        } catch {
            // Gracefully handle missing table or network error
            return []
        }
    },

    /**
     * Get detailed price drift analysis for an entire project
     */
    async getProjectPriceAnalysis(projectId: string): Promise<PriceComparison[]> {
        const client = assertSupabase()

        // 1. Get drift using the snapshot service logic
        const drifts = await ahspSnapshotService.getPriceDrift(projectId)

        // 2. Fetch all RAB items to get more context
        const { data: rabItems } = await client
            .from('rab_items')
            .select('id, ahsp_code, name, unit, volume, snapshot_price, unit_price')
            .eq('project_id', projectId)

        const analysis: PriceComparison[] = []

        for (const item of (rabItems || [])) {
            const driftItem = drifts.find(d => d.rabItemId === item.id)

            // Get the "Living Price" (Latest PO price)
            // Note: In a real enterprise app, we might pre-summarize this in a materialized view or cache
            const history = await this.getProcurementHistory(projectId, item.ahsp_code, item.name)
            const livingPrice = history.length > 0 ? history[0].unitPrice : null

            const snapshot = item.snapshot_price as { total?: number } | number | null
            const baseline = typeof snapshot === 'object' && snapshot !== null ? Number((snapshot as { total?: number })?.total || 0) : Number(snapshot || item.unit_price || 0)

            analysis.push({
                rabId: item.id,
                itemCode: item.ahsp_code || '',
                itemName: item.name || '',
                volume: Number(item.volume || 0),
                unit: item.unit || '',
                baselinePrice: baseline,
                currentAhspPrice: driftItem ? driftItem.currentPrice : baseline,
                livingPrice,
                drift: driftItem ? (driftItem.currentPrice - driftItem.snapshotPrice) : 0,
                potentialImpact: driftItem ? driftItem.impactOnBudget : 0
            })
        }


        return analysis
    }
}
