/**
 * mtrService.ts
 *
 * Material Transfer Request (MTR) Workflow Service.
 * Manages inter-site / inter-WBS material reallocation requests.
 *
 * Lifecycle: DRAFT → SUBMITTED → APPROVED → POSTED | REJECTED
 *
 * When approved and posted, inventory is moved from source to target
 * and cost centers are adjusted accordingly.
 */

import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'
import { toast } from 'sonner'

// ─── Types ───

export type MTRStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'REJECTED'

export interface MTRItem {
    id: string
    description: string
    unit: string
    quantity: number
    unitPrice: number
    totalPrice: number
}

export interface MaterialTransferRequest {
    id: string
    projectId: string
    /** Source WBS item / Cost center */
    sourceWbs: string
    sourceWbsLabel: string
    /** Target WBS item / Cost center */
    targetWbs: string
    targetWbsLabel: string
    /** Transfer items */
    items: MTRItem[]
    /** Total transfer value */
    totalValue: number
    /** Current status */
    status: MTRStatus
    /** Reason for transfer */
    reason: string
    /** Who created */
    requestedBy: string
    requestedAt: string
    /** Approval metadata */
    approvedBy?: string
    approvedAt?: string
    approvalComment?: string
    /** Rejection metadata */
    rejectedBy?: string
    rejectedAt?: string
    rejectionReason?: string
    /** Posted metadata */
    postedAt?: string
}

export interface CreateMTRInput {
    projectId: string
    sourceWbs: string
    sourceWbsLabel: string
    targetWbs: string
    targetWbsLabel: string
    items: Omit<MTRItem, 'id' | 'totalPrice'>[]
    reason: string
    requestedBy: string
}

// ─── Status Config ───

export const MTR_STATUS_LABELS: Record<MTRStatus, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    APPROVED: 'Approved',
    POSTED: 'Posted',
    REJECTED: 'Rejected',
}

export const MTR_STATUS_COLORS: Record<MTRStatus, string> = {
    DRAFT: 'bg-slate-100 text-slate-700',
    SUBMITTED: 'bg-blue-100 text-blue-700',
    APPROVED: 'bg-emerald-100 text-emerald-700',
    POSTED: 'bg-green-100 text-green-800',
    REJECTED: 'bg-red-100 text-red-700',
}

// ─── Transitions ───

const VALID_TRANSITIONS: Record<MTRStatus, MTRStatus[]> = {
    DRAFT: ['SUBMITTED'],
    SUBMITTED: ['APPROVED', 'REJECTED'],
    APPROVED: ['POSTED'],
    POSTED: [],
    REJECTED: ['DRAFT'],  // Allow revision
}

// ─── In-Memory Store (prod: Supabase) ───

const mtrStore: MaterialTransferRequest[] = []

// ─── Service ───

export const mtrService = {

    /**
     * Create a new Material Transfer Request.
     */
    createMTR(input: CreateMTRInput): MaterialTransferRequest {
        const items: MTRItem[] = input.items.map(item => ({
            ...item,
            id: generateId('mtri'),
            totalPrice: item.quantity * item.unitPrice,
        }))

        const totalValue = items.reduce((sum, i) => sum + i.totalPrice, 0)

        const mtr: MaterialTransferRequest = {
            id: generateId('mtr'),
            projectId: input.projectId,
            sourceWbs: input.sourceWbs,
            sourceWbsLabel: input.sourceWbsLabel,
            targetWbs: input.targetWbs,
            targetWbsLabel: input.targetWbsLabel,
            items,
            totalValue,
            status: 'DRAFT',
            reason: input.reason,
            requestedBy: input.requestedBy,
            requestedAt: new Date().toISOString(),
        }

        mtrStore.push(mtr)

        auditService.log({
            action: 'CREATE',
            entity: 'material_transfer_request',
            entityType: 'MTR',
            entityId: mtr.id,
            userName: input.requestedBy,
            details: {
                source: input.sourceWbsLabel,
                target: input.targetWbsLabel,
                totalValue,
                itemCount: items.length,
            },
        })

        toast.success('MTR Created', { description: `${mtr.id} — ${input.sourceWbsLabel} → ${input.targetWbsLabel}` })
        return mtr
    },

    /**
     * Transition an MTR to a new status with validation.
     */
    transition(
        mtrId: string,
        newStatus: MTRStatus,
        context: { userId: string; comment?: string }
    ): MaterialTransferRequest {
        const mtr = mtrStore.find(m => m.id === mtrId)
        if (!mtr) throw new Error(`MTR ${mtrId} not found`)

        // Validate transition
        const allowed = VALID_TRANSITIONS[mtr.status]
        if (!allowed.includes(newStatus)) {
            toast.error('Invalid Transition', {
                description: `Cannot move from ${mtr.status} to ${newStatus}`,
            })
            throw new Error(`Invalid transition: ${mtr.status} → ${newStatus}`)
        }

        // Guards
        if (newStatus === 'SUBMITTED') {
            if (mtr.items.length === 0) {
                toast.error('Cannot submit', { description: 'MTR must have at least one item' })
                throw new Error('MTR must have at least one item to submit')
            }
            if (!mtr.reason.trim()) {
                toast.error('Cannot submit', { description: 'Transfer reason is required' })
                throw new Error('Transfer reason is required')
            }
        }

        if (newStatus === 'REJECTED' && !context.comment) {
            toast.error('Cannot reject', { description: 'Rejection reason is required' })
            throw new Error('Rejection reason is required')
        }

        const oldStatus = mtr.status
        mtr.status = newStatus

        // Status-specific metadata
        switch (newStatus) {
            case 'APPROVED':
                mtr.approvedBy = context.userId
                mtr.approvedAt = new Date().toISOString()
                mtr.approvalComment = context.comment
                break
            case 'REJECTED':
                mtr.rejectedBy = context.userId
                mtr.rejectedAt = new Date().toISOString()
                mtr.rejectionReason = context.comment
                break
            case 'POSTED':
                mtr.postedAt = new Date().toISOString()
                // In production: update inventory + cost centers here
                break
            case 'DRAFT':
                // Reset rejection metadata for revision
                mtr.rejectedBy = undefined
                mtr.rejectedAt = undefined
                mtr.rejectionReason = undefined
                break
        }

        // Audit
        auditService.log({
            action: 'STATUS_CHANGE',
            entity: 'material_transfer_request',
            entityType: 'MTR',
            entityId: mtr.id,
            userName: context.userId,
            details: {
                from: oldStatus,
                to: newStatus,
                comment: context.comment,
            },
        })

        toast.success(`MTR ${MTR_STATUS_LABELS[newStatus]}`, {
            description: `${mtr.sourceWbsLabel} → ${mtr.targetWbsLabel}`,
        })

        return mtr
    },

    /**
     * Get all MTRs for a project.
     */
    getByProject(projectId: string): MaterialTransferRequest[] {
        return mtrStore.filter(m => m.projectId === projectId)
    },

    /**
     * Get single MTR by ID.
     */
    getById(mtrId: string): MaterialTransferRequest | undefined {
        return mtrStore.find(m => m.id === mtrId)
    },

    /**
     * Get allowed next statuses for an MTR.
     */
    getNextStatuses(mtrId: string): MTRStatus[] {
        const mtr = mtrStore.find(m => m.id === mtrId)
        if (!mtr) return []
        return VALID_TRANSITIONS[mtr.status]
    },

    /**
     * Delete a draft MTR.
     */
    deleteDraft(mtrId: string): void {
        const idx = mtrStore.findIndex(m => m.id === mtrId && m.status === 'DRAFT')
        if (idx === -1) throw new Error('Can only delete Draft MTRs')
        mtrStore.splice(idx, 1)
        toast.success('MTR Deleted')
    },
}
