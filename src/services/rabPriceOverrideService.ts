/**
 * rabPriceOverrideService.ts
 * FASE 3.4: RAB Price Override
 *
 * Allows PM to override AHSP-derived prices for specific RAB items.
 * When base_price comes from AHSP but PM needs negotiated or market price:
 * - Set final_price on the RAB item (overrides base_price from AHSP)
 * - Audit trail records who changed what and why
 * - Dashboard shows which items use AHSP vs override price
 */

import { assertSupabase } from '../lib/supabaseClient'
import { auditService } from './auditService'

// ---------- Types ----------

export interface PriceOverrideInput {
    rabItemId: string
    finalPrice: number
    reason: string
}

export interface PriceOverrideStatus {
    rabItemId: string
    itemName: string
    basePrice: number       // from AHSP
    snapshotPrice: number | null  // frozen price
    finalPrice: number | null     // override price
    activePrice: number     // what's actually used
    source: 'ahsp' | 'snapshot' | 'override'
}

// ---------- Service ----------

export const rabPriceOverrideService = {

    /**
     * Apply a price override to a RAB item.
     */
    async applyOverride(input: PriceOverrideInput): Promise<void> {
        const client = assertSupabase()

        // Get current item for audit
        const { data: currentItem, error: fetchErr } = await client
            .from('rab_items')
            .select('id, name, item_name, unit_price, base_price, final_price, volume, project_id')
            .eq('id', input.rabItemId)
            .single()

        if (fetchErr) throw fetchErr

        const newTotal = input.finalPrice * Number(currentItem.volume || 0)

        const { error } = await client
            .from('rab_items')
            .update({
                final_price: input.finalPrice,
                total_price: newTotal,
            })
            .eq('id', input.rabItemId)

        if (error) throw error

        // Audit
        try {
            await auditService.log({
                action: 'PRICE_OVERRIDE',
                entity: 'rab_items',
                entityType: 'RAB',
                entityId: input.rabItemId,
                details: {
                    item: currentItem.name || currentItem.item_name,
                    previousPrice: currentItem.unit_price || currentItem.base_price,
                    newPrice: input.finalPrice,
                    reason: input.reason,
                    impact: newTotal - (Number(currentItem.unit_price || currentItem.base_price || 0) * Number(currentItem.volume || 0)),
                },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }
    },

    /**
     * Remove a price override (revert to AHSP/snapshot price)
     */
    async removeOverride(rabItemId: string): Promise<void> {
        const client = assertSupabase()

        const { data: item } = await client
            .from('rab_items')
            .select('base_price, snapshot_price, volume')
            .eq('id', rabItemId)
            .single()

        if (!item) throw new Error('RAB item not found')

        const revertPrice = Number(item.snapshot_price) || Number(item.base_price) || 0
        const newTotal = revertPrice * Number(item.volume || 0)

        const { error } = await client
            .from('rab_items')
            .update({
                final_price: null,
                unit_price: revertPrice,
                total_price: newTotal,
            })
            .eq('id', rabItemId)

        if (error) throw error
    },

    /**
     * Get price source status for all RAB items in a project.
     * Shows which items use AHSP, snapshot, or override prices.
     */
    async getPriceStatus(projectId: string): Promise<PriceOverrideStatus[]> {
        const client = assertSupabase()

        const { data: items, error } = await client
            .from('rab_items')
            .select('id, name, item_name, unit_price, base_price, snapshot_price, final_price')
            .eq('project_id', projectId)

        if (error) throw error

        return (items || []).map(item => {
            const basePrice = Number(item.base_price || item.unit_price || 0)
            const snapshotPrice = item.snapshot_price ? Number(item.snapshot_price) : null
            const finalPrice = item.final_price ? Number(item.final_price) : null

            let activePrice = basePrice
            let source: PriceOverrideStatus['source'] = 'ahsp'

            if (finalPrice && finalPrice > 0) {
                activePrice = finalPrice
                source = 'override'
            } else if (snapshotPrice && snapshotPrice > 0) {
                activePrice = snapshotPrice
                source = 'snapshot'
            }

            return {
                rabItemId: item.id,
                itemName: item.name || item.item_name || 'Unknown',
                basePrice,
                snapshotPrice,
                finalPrice,
                activePrice,
                source,
            }
        })
    },
}
