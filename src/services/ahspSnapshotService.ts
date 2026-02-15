/**
 * ahspSnapshotService.ts
 * FASE 3.2: AHSP Price Snapshot
 *
 * Purpose: When RAP is "locked in" (execution phase starts), the system takes a
 * snapshot of AHSP prices. This protects RAP cost baseline from future AHSP edits.
 *
 * Workflow:
 * 1. PM clicks "Lock RAP Baseline" → triggers snapshot
 * 2. System copies current AHSP base_price → rab_items.snapshot_price
 * 3. RAP calculations use snapshot_price instead of live AHSP price
 * 4. Future AHSP edits don't affect locked-in RAP costs
 * 5. Audit trail records the snapshot event
 *
 * Also supports: differential comparison (current price vs snapshot price)
 * to help PM understand price drift.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { auditService } from './auditService'
import { notificationService } from './notificationService'

// ---------- Types ----------

export interface SnapshotResult {
    itemsSnapshotted: number
    totalBaselineValue: number
    timestamp: string
}

export interface PriceDrift {
    rabItemId: string
    itemName: string
    snapshotPrice: number
    currentPrice: number
    drift: number          // absolute difference
    driftPercentage: number // % change
    volume: number
    impactOnBudget: number // drift × volume
}

// ---------- Service ----------

export const ahspSnapshotService = {

    /**
     * Take a snapshot of all AHSP-linked RAB item prices.
     * Copies current AHSP base_price → rab_items.snapshot_price.
     */
    async takeSnapshot(projectId: string): Promise<SnapshotResult> {
        const client = assertSupabase()

        // Get all RAB items that have AHSP links
        const { data: rabItems, error } = await client
            .from('rab_items')
            .select(`
                id,
                name,
                item_name,
                ahsp_id,
                volume,
                unit_price,
                ahsp_items ( base_price )
            `)
            .eq('project_id', projectId)
            .not('ahsp_id', 'is', null)

        if (error) {
            console.warn('[ahspSnapshot] takeSnapshot fetch error:', error.message)
            return { itemsSnapshotted: 0, totalBaselineValue: 0, timestamp: new Date().toISOString() }
        }

        let itemsSnapshotted = 0
        let totalBaselineValue = 0

        for (const item of (rabItems || [])) {
            const ahsp = (item as any).ahsp_items
            const basePrice = ahsp?.base_price || Number(item.unit_price) || 0

            if (basePrice > 0) {
                const { error: updateErr } = await client
                    .from('rab_items')
                    .update({
                        snapshot_price: basePrice,
                        base_price: basePrice,
                    })
                    .eq('id', item.id)

                if (!updateErr) {
                    itemsSnapshotted++
                    totalBaselineValue += basePrice * Number(item.volume || 0)
                }
            }
        }

        const timestamp = new Date().toISOString()

        // Audit the snapshot
        try {
            await auditService.log({
                action: 'SNAPSHOT',
                entity: 'rab_items',
                entityType: 'AHSP_SNAPSHOT',
                entityId: projectId,
                details: {
                    itemsSnapshotted,
                    totalBaselineValue,
                    timestamp,
                },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        // Notify PM
        try {
            await notificationService.notifyByRole(projectId, 'manager', {
                type: 'SYSTEM',
                title: 'AHSP Price Snapshot Taken',
                message: `${itemsSnapshotted} item harga telah di-snapshot. Total baseline: Rp ${totalBaselineValue.toLocaleString('id-ID')}. Harga RAP terlindungi dari perubahan AHSP.`,
                severity: 'info',
                projectId,
            })
        } catch (e) {
            console.warn('Notification failed:', e)
        }

        return { itemsSnapshotted, totalBaselineValue, timestamp }
    },

    /**
     * Check if a project has an active price snapshot
     */
    async hasSnapshot(projectId: string): Promise<boolean> {
        const client = assertSupabase()
        const { count } = await client
            .from('rab_items')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .not('snapshot_price', 'is', null)
            .gt('snapshot_price', 0)

        return (count || 0) > 0
    },

    /**
     * Get price drift analysis: compare snapshot_price vs current AHSP base_price.
     * Shows where real market prices have diverged from locked-in baseline.
     */
    async getPriceDrift(projectId: string): Promise<PriceDrift[]> {
        const client = assertSupabase()

        const { data: rabItems, error } = await client
            .from('rab_items')
            .select(`
                id,
                name,
                item_name,
                ahsp_id,
                volume,
                snapshot_price,
                ahsp_items ( base_price )
            `)
            .eq('project_id', projectId)
            .not('snapshot_price', 'is', null)
            .gt('snapshot_price', 0)

        if (error) {
            console.warn('[ahspSnapshot] getPriceDrift error:', error.message)
            return []
        }

        const drifts: PriceDrift[] = []

        for (const item of (rabItems || [])) {
            const ahsp = (item as any).ahsp_items
            const snapshotPrice = Number(item.snapshot_price)
            const currentPrice = Number(ahsp?.base_price || 0)

            if (snapshotPrice > 0 && currentPrice > 0 && snapshotPrice !== currentPrice) {
                const drift = currentPrice - snapshotPrice
                const driftPct = (drift / snapshotPrice) * 100
                const volume = Number(item.volume || 0)

                drifts.push({
                    rabItemId: item.id,
                    itemName: item.name || item.item_name || 'Unknown',
                    snapshotPrice,
                    currentPrice,
                    drift,
                    driftPercentage: driftPct,
                    volume,
                    impactOnBudget: drift * volume,
                })
            }
        }

        // Sort by absolute impact descending
        drifts.sort((a, b) => Math.abs(b.impactOnBudget) - Math.abs(a.impactOnBudget))

        return drifts
    },
}
