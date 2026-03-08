/**
 * ahspSnapshotService.ts
 * FASE 3.2: AHSP Price Snapshot — RPC-based (SECURITY DEFINER)
 *
 * Purpose: When RAP is "locked in" (execution phase starts), the system takes a
 * snapshot of AHSP prices. This protects RAP cost baseline from future AHSP edits.
 *
 * All operations use SECURITY DEFINER RPC functions to bypass RLS.
 * RPCs: rpc_take_rab_snapshot, rpc_has_rab_snapshot, rpc_get_price_drift
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
     * Take a snapshot of all RAB item prices via SECURITY DEFINER RPC.
     * The RPC loops all rab_items with unit_price > 0 and writes snapshot_price + base_price.
     */
    async takeSnapshot(projectId: string): Promise<SnapshotResult> {
        const client = assertSupabase()

        const { data, error } = await client.rpc('rpc_take_rab_snapshot', {
            p_project_id: projectId,
        })

        if (error) {
            console.error('[ahspSnapshot] takeSnapshot RPC error:', error.message)
            throw new Error(`Snapshot gagal: ${error.message}`)
        }

        const result: SnapshotResult = {
            itemsSnapshotted: Number(data?.itemsSnapshotted ?? 0),
            totalBaselineValue: Number(data?.totalBaselineValue ?? 0),
            timestamp: String(data?.timestamp ?? new Date().toISOString()),
        }

        // Audit the snapshot
        try {
            await auditService.log({
                action: 'SNAPSHOT',
                entity: 'rab_items',
                entityType: 'AHSP_SNAPSHOT',
                entityId: projectId,
                details: {
                    itemsSnapshotted: result.itemsSnapshotted,
                    totalBaselineValue: result.totalBaselineValue,
                    timestamp: result.timestamp,
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
                message: `${result.itemsSnapshotted} item harga telah di-snapshot. Total baseline: Rp ${result.totalBaselineValue.toLocaleString('id-ID')}. Harga RAP terlindungi dari perubahan AHSP.`,
                severity: 'info',
                projectId,
            })
        } catch (e) {
            console.warn('Notification failed:', e)
        }

        return result
    },

    /**
     * Check if a project has an active price snapshot via RPC.
     */
    async hasSnapshot(projectId: string): Promise<boolean> {
        const client = assertSupabase()
        const { data, error } = await client.rpc('rpc_has_rab_snapshot', {
            p_project_id: projectId,
        })

        if (error) {
            console.warn('[ahspSnapshot] hasSnapshot RPC error:', error.message)
            return false
        }

        return !!data
    },

    /**
     * Get price drift analysis via RPC.
     * Compares snapshot_price vs current unit_price.
     */
    async getPriceDrift(projectId: string): Promise<PriceDrift[]> {
        const client = assertSupabase()

        const { data, error } = await client.rpc('rpc_get_price_drift', {
            p_project_id: projectId,
        })

        if (error) {
            console.warn('[ahspSnapshot] getPriceDrift RPC error:', error.message)
            return []
        }

        // RPC returns JSONB array — parse it
        const items = Array.isArray(data) ? data : (typeof data === 'string' ? JSON.parse(data) : [])

        const drifts: PriceDrift[] = items.map((item: Record<string, unknown>) => ({
            rabItemId: String(item.rabItemId || ''),
            itemName: String(item.itemName || 'Unknown'),
            snapshotPrice: Number(item.snapshotPrice || 0),
            currentPrice: Number(item.currentPrice || 0),
            drift: Number(item.drift || 0),
            driftPercentage: Number(item.driftPercentage || 0),
            volume: Number(item.volume || 0),
            impactOnBudget: Number(item.impactOnBudget || 0),
        }))

        // Sort by absolute impact descending
        drifts.sort((a, b) => Math.abs(b.impactOnBudget) - Math.abs(a.impactOnBudget))

        return drifts
    },
}
