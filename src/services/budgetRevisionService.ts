/**
 * budgetRevisionService.ts
 * Budget Revision Workflow — allows PM to revise the RAB after approval.
 *
 * State machine:
 *   DRAFT → SUBMITTED → PENDING_APPROVAL → APPROVED | REJECTED
 *
 * On APPROVED:
 *  - RAB items listed in revision_items are updated to their new values
 *  - A snapshot of the pre-revision RAB is saved to rab_baselines
 *  - Project total_budget is recalculated
 *  - Approval chain: PM → Finance Manager → Director (if delta > 10% of current budget)
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { approvalService } from './approvalService'
import { auditService } from './auditService'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type BudgetRevisionStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'PENDING_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'

export interface BudgetRevisionItem {
    rabItemId: string
    rabItemName?: string
    currentValue: number
    newValue: number
    delta: number       // newValue - currentValue (can be negative)
    reason: string
}

export interface BudgetRevision {
    id: string
    projectId: string
    revisionNumber: string
    title: string
    justification: string
    status: BudgetRevisionStatus
    items: BudgetRevisionItem[]

    totalCurrentBudget: number
    totalNewBudget: number
    totalDelta: number
    deltaPercent: number

    requestedBy?: string
    requesterName?: string
    approvedBy?: string
    approvedAt?: string
    rejectionReason?: string

    createdAt: string
    updatedAt: string
}

export interface CreateBudgetRevisionInput {
    projectId: string
    title: string
    justification: string
    items: Omit<BudgetRevisionItem, 'delta'>[]
    requestedBy?: string
    requesterName?: string
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function generateRevisionNumber(projectId: string): string {
    const d = new Date()
    return `BR-${projectId.slice(0, 4).toUpperCase()}-${d.getFullYear()}-${d.getTime().toString().slice(-3)}`
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const budgetRevisionService = {

    async getRevisions(projectId: string): Promise<BudgetRevision[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('budget_revisions')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[budgetRevision] getRevisions error:', error.message)
            return []
        }
        return (data ?? []).map(rowToRevision)
    },

    async getRevision(id: string): Promise<BudgetRevision | null> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('budget_revisions')
            .select('*')
            .eq('id', id)
            .maybeSingle()
        if (error) throw error
        return data ? rowToRevision(data) : null
    },

    /**
     * Create a DRAFT budget revision.
     * Items delta is computed automatically.
     */
    async createRevision(input: CreateBudgetRevisionInput): Promise<BudgetRevision> {
        const client = assertSupabase()
        const id = generateId('br')
        const now = new Date().toISOString()

        const itemsWithDelta: BudgetRevisionItem[] = input.items.map(i => ({
            ...i,
            delta: i.newValue - i.currentValue,
        }))

        const totalCurrent = itemsWithDelta.reduce((s, i) => s + i.currentValue, 0)
        const totalNew = itemsWithDelta.reduce((s, i) => s + i.newValue, 0)
        const totalDelta = totalNew - totalCurrent
        const deltaPercent = totalCurrent > 0 ? (totalDelta / totalCurrent) * 100 : 0

        const row = {
            id,
            project_id: input.projectId,
            revision_number: generateRevisionNumber(input.projectId),
            title: input.title,
            justification: input.justification,
            status: 'DRAFT',
            items: itemsWithDelta,
            total_current_budget: totalCurrent,
            total_new_budget: totalNew,
            total_delta: totalDelta,
            delta_percent: deltaPercent,
            requested_by: input.requestedBy ?? null,
            requester_name: input.requesterName ?? null,
            created_at: now,
            updated_at: now,
        }

        const { data, error } = await client.from('budget_revisions').insert(row).select().single()
        if (error) throw error
        return rowToRevision(data)
    },

    /**
     * Submit a DRAFT revision for approval.
     * Routing: manager always; director added when |delta%| > 10%.
     */
    async submitRevision(
        revisionId: string,
        requestedBy?: string,
        requesterName?: string
    ): Promise<void> {
        const client = assertSupabase()
        const revision = await this.getRevision(revisionId)
        if (!revision) throw new Error('Budget revision not found')
        if (revision.status !== 'DRAFT') throw new Error(`Cannot submit revision with status: ${revision.status}`)

        // Update status
        const { error } = await client
            .from('budget_revisions')
            .update({ status: 'PENDING_APPROVAL', updated_at: new Date().toISOString() })
            .eq('id', revisionId)
        if (error) throw error

        const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
        const approverRole = Math.abs(revision.deltaPercent) > 10 ? 'director' : 'manager'

        await approvalService.createApproval({
            projectId: revision.projectId,
            requesterId: requestedBy,
            requesterName,
            entityType: 'BUDGET_REVISION',
            entityId: revisionId,
            title: `Budget Revision: ${revision.title}`,
            description: revision.justification,
            approverRole,
            impactSummary: {
                totalCurrentBudget: revision.totalCurrentBudget,
                totalNewBudget: revision.totalNewBudget,
                totalDelta: revision.totalDelta,
                deltaPercent: Number(revision.deltaPercent.toFixed(2)),
                itemCount: revision.items.length,
                formattedDelta: fmt.format(Math.abs(revision.totalDelta)),
                isIncrease: revision.totalDelta > 0,
                revisionNumber: revision.revisionNumber,
            },
        })
    },

    /**
     * Apply an APPROVED revision:
     *  1. Update RAB items to their new values
     *  2. Recalculate project total_budget
     * Called from the approval cascade after BUDGET_REVISION is approved.
     */
    async applyRevision(
        revisionId: string,
        approverId: string,
        approverName: string
    ): Promise<void> {
        const client = assertSupabase()
        const revision = await this.getRevision(revisionId)
        if (!revision) throw new Error('Budget revision not found')

        // Snapshot current RAB into rab_baselines before mutating
        const { data: currentRab } = await client
            .from('rab_items')
            .select('id, name, total_price, quantity, unit_price')
            .eq('project_id', revision.projectId)

        try {
            await client.from('rab_baselines').insert({
                id: generateId('rbb'),
                project_id: revision.projectId,
                snapshot_at: new Date().toISOString(),
                reason: `Pre-revision snapshot: ${revision.revisionNumber}`,
                revision_id: revisionId,
                snapshot_data: currentRab ?? [],
            })
        } catch { /* Best-effort — baselines table may not exist in older installs */ }

        // Apply new values to RAB items
        const updateErrors: string[] = []
        for (const item of revision.items) {
            const { error } = await client
                .from('rab_items')
                .update({
                    total_price: item.newValue,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', item.rabItemId)

            if (error) {
                updateErrors.push(`${item.rabItemId}: ${error.message}`)
            }
        }

        if (updateErrors.length > 0) {
            console.error('[budgetRevision] Some RAB items failed to update:', updateErrors)
        }

        // Recalculate project total_budget from RAB sum
        const { data: rabItems } = await client
            .from('rab_items')
            .select('total_price')
            .eq('project_id', revision.projectId)

        const newTotalBudget = (rabItems ?? []).reduce((s, r) => s + Number(r.total_price ?? 0), 0)

        await client.from('projects').update({
            total_budget: newTotalBudget,
            updated_at: new Date().toISOString(),
        }).eq('id', revision.projectId)

        // Mark revision as APPROVED
        await client.from('budget_revisions').update({
            status: 'APPROVED',
            approved_by: approverId,
            approved_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        }).eq('id', revisionId)

        await auditService.log({
            userId: approverId,
            userName: approverName,
            action: 'APPROVE',
            entity: 'budget_revisions',
            entityType: 'BUDGET_REVISION',
            entityId: revisionId,
            details: {
                revisionNumber: revision.revisionNumber,
                delta: revision.totalDelta,
                newTotalBudget,
                itemsUpdated: revision.items.length - updateErrors.length,
            },
        }).catch(() => {})
    },

    async rejectRevision(revisionId: string, reason: string, approverId?: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('budget_revisions')
            .update({
                status: 'REJECTED',
                rejection_reason: reason,
                approved_by: approverId ?? null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', revisionId)
        if (error) throw error
    },
}

// ------------------------------------------------------------------
// Row mapper
// ------------------------------------------------------------------

// deno-lint-ignore no-explicit-any
function rowToRevision(r: any): BudgetRevision {
    return {
        id: r.id,
        projectId: r.project_id,
        revisionNumber: r.revision_number,
        title: r.title,
        justification: r.justification,
        status: r.status as BudgetRevisionStatus,
        items: r.items ?? [],
        totalCurrentBudget: Number(r.total_current_budget ?? 0),
        totalNewBudget: Number(r.total_new_budget ?? 0),
        totalDelta: Number(r.total_delta ?? 0),
        deltaPercent: Number(r.delta_percent ?? 0),
        requestedBy: r.requested_by,
        requesterName: r.requester_name,
        approvedBy: r.approved_by,
        approvedAt: r.approved_at,
        rejectionReason: r.rejection_reason,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
    }
}
