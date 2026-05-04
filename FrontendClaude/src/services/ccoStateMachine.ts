/**
 * ccoStateMachine.ts
 *
 * CCO/VO Lifecycle State Machine.
 * Enforces valid status transitions, validates required fields per state,
 * auto-triggers cascade on APPROVED, and logs audit trail.
 *
 * Lifecycle: DRAFT → SUBMITTED → REVIEWED → APPROVED | REJECTED
 *            REJECTED → DRAFT (revise & resubmit)
 */

import { changeOrderService } from './changeOrderService'
import { changeOrderCascade } from './changeOrderCascade'
import { auditService } from './auditService'
import { useAuthStore } from '../store/authStore'
import type { ChangeOrder, ChangeOrderStatus } from '../types/change-order'
import { toast } from 'sonner'

// ─── Valid Transitions Map ───

const VALID_TRANSITIONS: Record<ChangeOrderStatus, ChangeOrderStatus[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['REVIEWED', 'REJECTED'],
    REVIEWED: ['PENDING_APPROVAL'],
    PENDING_APPROVAL: ['APPROVED', 'REJECTED'],
    APPROVED: [],           // Terminal state
    REJECTED: ['DRAFT'],    // Can revise back to draft
}

// ─── Human Labels ───

export const CCO_STATUS_LABELS: Record<ChangeOrderStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    REVIEWED: 'Reviewed',
    PENDING_APPROVAL: 'Pending Approval',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
}

export const CCO_STATUS_COLORS: Record<ChangeOrderStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
    SUBMITTED: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    REVIEWED: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    APPROVED: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
    REJECTED: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
}

// ─── Transition Guards ───

interface TransitionInput {
    changeOrder: ChangeOrder
    targetStatus: ChangeOrderStatus
    comment?: string
}

interface TransitionResult {
    success: boolean
    error?: string
}

function validateTransition(input: TransitionInput): TransitionResult {
    const { changeOrder, targetStatus, comment } = input
    const currentStatus = changeOrder.status

    // 1. Check valid transition
    const allowed = VALID_TRANSITIONS[currentStatus]
    if (!allowed || !allowed.includes(targetStatus)) {
        return {
            success: false,
            error: `Cannot transition from ${CCO_STATUS_LABELS[currentStatus]} to ${CCO_STATUS_LABELS[targetStatus]}`,
        }
    }

    // 2. Guard: SUBMITTED requires title + at least 1 item + cost_impact
    if (targetStatus === 'SUBMITTED') {
        if (!changeOrder.title || changeOrder.title.trim().length === 0) {
            return { success: false, error: 'Title is required before submitting.' }
        }
        if (!changeOrder.items || changeOrder.items.length === 0) {
            return { success: false, error: 'At least one change item is required before submitting.' }
        }
        if (changeOrder.cost_impact === undefined || changeOrder.cost_impact === null) {
            return { success: false, error: 'Cost impact must be specified before submitting.' }
        }
    }

    // 3. Guard: REVIEWED/APPROVED/REJECTED requires comment
    if (['REVIEWED', 'APPROVED', 'REJECTED'].includes(targetStatus)) {
        if (!comment || comment.trim().length === 0) {
            return { success: false, error: `Comment is required when ${targetStatus === 'REVIEWED' ? 'reviewing' : targetStatus === 'APPROVED' ? 'approving' : 'rejecting'}.` }
        }
    }

    return { success: true }
}

// ─── State Machine Service ───

export const ccoStateMachine = {

    /**
     * Get the valid next statuses from the current status.
     */
    getNextStatuses(currentStatus: ChangeOrderStatus): ChangeOrderStatus[] {
        return VALID_TRANSITIONS[currentStatus] || []
    },

    /**
     * Check if a transition is valid (without executing).
     */
    canTransition(changeOrder: ChangeOrder, targetStatus: ChangeOrderStatus, comment?: string): TransitionResult {
        return validateTransition({ changeOrder, targetStatus, comment })
    },

    /**
     * Execute a status transition with guards and side effects.
     */
    async transition(
        changeOrder: ChangeOrder,
        targetStatus: ChangeOrderStatus,
        comment?: string,
    ): Promise<{ success: boolean; error?: string }> {

        // 1. Validate
        const validation = validateTransition({ changeOrder, targetStatus, comment })
        if (!validation.success) {
            toast.error('Transition blocked', { description: validation.error })
            return validation
        }

        const { user, profile } = useAuthStore.getState()
        const userName = profile?.full_name || user?.email || 'System'

        try {
            // 2. Update status in database
            await changeOrderService.updateChangeOrderStatus(changeOrder.id, targetStatus)

            // 3. Side effects per target status
            if (targetStatus === 'APPROVED') {
                // Auto-trigger cascade
                try {
                    const cascadeResult = await changeOrderCascade.execute(changeOrder.id)
                    toast.success(`CCO ${changeOrder.vo_number} Approved`, {
                        description: `Cascade applied: ${cascadeResult.rabItemsUpdated} RAB items updated, budget Δ${cascadeResult.budgetDelta >= 0 ? '+' : ''}${cascadeResult.budgetDelta.toLocaleString()}, schedule Δ${cascadeResult.scheduleDelta >= 0 ? '+' : ''}${cascadeResult.scheduleDelta}d`,
                    })
                } catch (cascadeErr) {
                    console.warn('[CCO] Cascade failed:', cascadeErr)
                    toast.warning('CCO approved but cascade had errors', { description: String(cascadeErr) })
                }
            } else {
                toast.success(`Status updated: ${CCO_STATUS_LABELS[targetStatus]}`)
            }

            // 4. Audit trail
            auditService.log({
                userId: user?.id,
                userName,
                action: targetStatus === 'APPROVED' ? 'CO_APPROVED' :
                    targetStatus === 'REJECTED' ? 'CO_REJECTED' :
                        'STATUS_CHANGE',
                entity: 'change_orders',
                entityType: 'CO',
                entityId: changeOrder.id,
                details: {
                    voNumber: changeOrder.vo_number,
                    from: changeOrder.status,
                    to: targetStatus,
                    comment,
                    costImpact: changeOrder.cost_impact,
                },
            })

            return { success: true }
        } catch (err: unknown) {
            const e = err as Error
            toast.error('Transition failed', { description: e.message })
            return { success: false, error: e.message }
        }
    },

    /**
     * Preview the cascade impact of approving this CCO.
     */
    async previewImpact(changeOrderId: string) {
        return changeOrderCascade.preview(changeOrderId)
    },
}
