/**
 * changeOrderCascade.ts
 * FASE 2.4: Change Order / Variation Order Cascade
 *
 * When a Change Order (VO) status changes to APPROVED:
 * 1. Update RAB items totals (add volume_delta × unit_price to existing WBS item)
 * 2. Update timeline task durations (schedule_impact_days)
 * 3. Notify PM and update project's total budget
 * 4. Audit log the entire cascade
 *
 * This ensures VO approval automatically ripples through all affected modules.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { notificationService } from './notificationService'
import { auditService } from './auditService'
import { eventBus } from '../lib/eventBus'
import type { ChangeOrderItem } from '../types/change-order'

// ─── Local row types ──────────────────────────────────────────────────────────
type CoItemRow = { target_wbs_id?: string | null; total_delta?: number | null }

// ---------- Types ----------

export interface CascadeResult {
    rabItemsUpdated: number
    timelineTasksUpdated: number
    budgetDelta: number
    scheduleDelta: number
    errors: string[]
}

// ---------- Service ----------

export const changeOrderCascade = {

    /**
     * Execute full cascade when a Change Order is approved.
     * Called from changeOrderStore.updateStatus() or approval workflow callback.
     */
    async execute(changeOrderId: string): Promise<CascadeResult> {
        const client = assertSupabase()
        
        // Call the atomic RPC on server-side
        const { data, error } = await client.rpc('rpc_execute_cco_cascade', {
            v_change_order_id: changeOrderId
        })

        if (error) {
            console.error('[changeOrderCascade] RPC Error:', error)
            throw new Error(`Cascade failed: ${error.message}`)
        }

        const result: CascadeResult = {
            rabItemsUpdated: data.rabItemsUpdated || 0,
            timelineTasksUpdated: data.timelineTasksUpdated || 0,
            budgetDelta: data.budgetDelta || 0,
            scheduleDelta: data.scheduleDelta || 0,
            errors: data.success ? [] : [data.error],
        }

        if (!data.success) {
            throw new Error(data.error || 'Cascade reported failure without error message')
        }

        // 5. Notifications
        try {
            const costFormatted = Math.abs(result.budgetDelta).toLocaleString('id-ID')
            const direction = result.budgetDelta >= 0 ? 'tambah' : 'kurang'

            await notificationService.notifyByRole('', 'manager', { // project_id derived in RPC, but we can't easily get it back without another query or extending RPC return
                type: 'CHANGE_ORDER',
                title: `VO Approved — Cascade Complete`,
                message: `RAB: ${result.rabItemsUpdated} item updated (biaya ${direction} Rp ${costFormatted}). Timeline: ${result.timelineTasksUpdated} task diperbarui.`,
                severity: 'info',
                metadata: { changeOrderId, ...result },
            })
        } catch (e) {
            console.warn('Cascade notification failed:', e)
        }

        // 6. Audit
        try {
            await auditService.log({
                action: 'APPROVE',
                entity: 'change_orders',
                entityType: 'CHANGE_ORDER',
                entityId: changeOrderId,
                details: {
                    cascade: result,
                },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        // 7. Trigger Store Refreshes via EventBus
        const projectId = data.projectId || ''
        eventBus.emit('rab:changed', { projectId, changeType: 'update', itemIds: [] })
        eventBus.emit('timeline:changed', { projectId, reason: 'CCO_CASCADE' })

        return result
    },

    /**
     * Preview cascade effects without actually executing (dry-run)
     */
    async preview(changeOrderId: string): Promise<{
        affectedRabItems: number
        affectedTasks: number
        estimatedBudgetDelta: number
        estimatedScheduleDelta: number
    }> {
        const client = assertSupabase()

        const { data: order } = await client
            .from('change_orders')
            .select('*')
            .eq('id', changeOrderId)
            .single()

        if (!order) throw new Error('Change Order not found')

        const { data: items } = await client
            .from('change_order_items')
            .select('*')
            .eq('change_order_id', changeOrderId)

        const affectedWbsIds = (items || []).map((i: CoItemRow) => i.target_wbs_id).filter(Boolean)
        const estimatedBudgetDelta = (items || []).reduce((sum: number, i: CoItemRow) => sum + Number(i.total_delta || 0), 0)

        let affectedTasks = 0
        if (affectedWbsIds.length > 0) {
            const { count } = await client
                .from('timeline_tasks')
                .select('*', { count: 'exact', head: true })
                .eq('project_id', order.project_id)
                .in('wbs_id', affectedWbsIds)

            affectedTasks = count || 0
        }

        return {
            affectedRabItems: affectedWbsIds.length,
            affectedTasks,
            estimatedBudgetDelta,
            estimatedScheduleDelta: Number(order.schedule_impact_days || 0),
        }
    },
}
