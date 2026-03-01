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
        const result: CascadeResult = {
            rabItemsUpdated: 0,
            timelineTasksUpdated: 0,
            budgetDelta: 0,
            scheduleDelta: 0,
            errors: [],
        }

        // 1. Fetch the Change Order with items
        const { data: order, error: orderErr } = await client
            .from('change_orders')
            .select('*')
            .eq('id', changeOrderId)
            .single()

        if (orderErr || !order) {
            throw new Error(`Change Order ${changeOrderId} not found`)
        }

        const { data: items, error: itemsErr } = await client
            .from('change_order_items')
            .select('*')
            .eq('change_order_id', changeOrderId)

        if (itemsErr) throw itemsErr

        const coItems: ChangeOrderItem[] = items || []

        // 2. RAB Cascade — Update rab_items for each CO item that has a target_wbs_id
        for (const item of coItems) {
            if (!item.target_wbs_id) continue

            try {
                // Find existing RAB item for this WBS
                const { data: rabItem } = await client
                    .from('rab_items')
                    .select('id, volume, unit_price, total_price')
                    .eq('wbs_id', item.target_wbs_id)
                    .eq('project_id', order.project_id)
                    .maybeSingle()

                if (rabItem) {
                    // Update existing RAB item
                    const newVolume = Number(rabItem.volume || 0) + Number(item.volume_delta || 0)
                    const newTotal = newVolume * Number(rabItem.unit_price || item.unit_price || 0)

                    const { error: updateErr } = await client
                        .from('rab_items')
                        .update({
                            volume: newVolume,
                            total_price: newTotal,
                        })
                        .eq('id', rabItem.id)

                    if (updateErr) {
                        result.errors.push(`RAB update failed for WBS ${item.target_wbs_id}: ${updateErr.message}`)
                    } else {
                        result.rabItemsUpdated++
                        result.budgetDelta += Number(item.total_delta || 0)
                    }
                } else {
                    // No matching RAB item — log warning but don't fail
                    result.errors.push(`No RAB item found for WBS ${item.target_wbs_id}, skipping`)
                }
            } catch (e: unknown) {
                result.errors.push(`RAB cascade error: ${(e as Error).message}`)
            }
        }

        // 3. Timeline Cascade — If schedule_impact_days > 0, extend affected tasks
        const scheduleDays = Number(order.schedule_impact_days || 0)
        if (scheduleDays !== 0) {
            result.scheduleDelta = scheduleDays

            try {
                // Get WBS IDs from CO items
                const affectedWbsIds = coItems
                    .map(i => i.target_wbs_id)
                    .filter(Boolean)

                if (affectedWbsIds.length > 0) {
                    // Find timeline tasks linked to these WBS items
                    const { data: tasks } = await client
                        .from('timeline_tasks')
                        .select('id, end_date, duration_days')
                        .eq('project_id', order.project_id)
                        .in('wbs_id', affectedWbsIds)

                    for (const task of (tasks || [])) {
                        const newDuration = (Number(task.duration_days) || 0) + scheduleDays
                        const currentEnd = new Date(task.end_date)
                        currentEnd.setDate(currentEnd.getDate() + scheduleDays)

                        const { error: taskErr } = await client
                            .from('timeline_tasks')
                            .update({
                                duration_days: Math.max(1, newDuration),
                                end_date: currentEnd.toISOString().split('T')[0],
                            })
                            .eq('id', task.id)

                        if (taskErr) {
                            result.errors.push(`Timeline update failed for task ${task.id}: ${taskErr.message}`)
                        } else {
                            result.timelineTasksUpdated++
                        }
                    }
                }
            } catch (e: unknown) {
                result.errors.push(`Timeline cascade error: ${(e as Error).message}`)
            }
        }

        // 4. Update project total budget delta
        if (result.budgetDelta !== 0) {
            try {
                const { data: project } = await client
                    .from('projects')
                    .select('total_budget')
                    .eq('id', order.project_id)
                    .single()

                if (project) {
                    const newBudget = Number(project.total_budget || 0) + result.budgetDelta
                    await client
                        .from('projects')
                        .update({ total_budget: newBudget })
                        .eq('id', order.project_id)
                }
            } catch (e: unknown) {
                result.errors.push(`Budget update failed: ${(e as Error).message}`)
            }
        }

        // 5. Notifications
        try {
            const costFormatted = Math.abs(result.budgetDelta).toLocaleString('id-ID')
            const direction = result.budgetDelta >= 0 ? 'tambah' : 'kurang'

            await notificationService.notifyByRole(order.project_id, 'manager', {
                type: 'CHANGE_ORDER',
                title: `VO ${order.vo_number || order.id.slice(0, 8)} Approved — Cascade Complete`,
                message: `RAB: ${result.rabItemsUpdated} item updated (biaya ${direction} Rp ${costFormatted}). Timeline: ${result.timelineTasksUpdated} task ${scheduleDays > 0 ? `diperpanjang ${scheduleDays} hari` : 'tidak berubah'}.`,
                severity: result.errors.length > 0 ? 'warning' : 'info',
                projectId: order.project_id,
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
                    voNumber: order.vo_number,
                    costImpact: order.cost_impact,
                    scheduleImpact: order.schedule_impact_days,
                },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

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
