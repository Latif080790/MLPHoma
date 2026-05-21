/**
 * approvalService.ts
 * Service layer for the Approval Workflow Engine.
 * Manages approval requests lifecycle and triggers notifications.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { notificationService } from './notificationService'
import { auditService } from './auditService'
import { changeOrderCascade } from './changeOrderCascade'
import type { ApprovalRequest, CreateApprovalInput, ApprovalEntityType, ApproverRole, ApprovalChain, ApprovalChainStep } from '../types/approval'

// ------------------------------------------------------------------
// Row ↔ Domain Mappers
// ------------------------------------------------------------------

type ApprovalRow = {
    id: string
    project_id: string
    requester_id?: string
    requester_name?: string
    entity_type: string
    entity_id: string
    approver_role: string
    title: string
    description?: string
    impact_summary?: Record<string, unknown>
    status: ApprovalRequest['status']
    approved_by?: string
    approver_name?: string
    approved_at?: string
    rejection_reason?: string
    notes?: string
    created_at: string
    updated_at: string
}

function rowToApproval(row: ApprovalRow): ApprovalRequest {
    return {
        id: row.id,
        projectId: row.project_id,
        requesterId: row.requester_id,
        requesterName: row.requester_name,
        entityType: row.entity_type as ApprovalEntityType,
        entityId: row.entity_id,
        approverRole: row.approver_role as ApproverRole,
        title: row.title,
        description: row.description,
        impactSummary: row.impact_summary ?? {},
        status: row.status,
        approvedBy: row.approved_by,
        approverName: row.approver_name,
        approvedAt: row.approved_at,
        rejectionReason: row.rejection_reason,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const approvalService = {

    /**
     * Get all approval requests for a project
     */
    async getApprovals(projectId: string): Promise<ApprovalRequest[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('approval_requests')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[approval] getApprovals error:', error.message)
            return []
        }
        return (data || []).map(rowToApproval)
    },

    /**
     * Get pending approvals count (for dashboard badge)
     */
    async getPendingCount(projectId?: string): Promise<number> {
        const client = assertSupabase()
        let query = client
            .from('approval_requests')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'PENDING')

        if (projectId) {
            query = query.eq('project_id', projectId)
        }

        const { count, error } = await query
        if (error) {
            console.warn('[approval] getPendingCount error:', error.message)
            return 0
        }
        return count ?? 0
    },

    /**
     * Get pending approvals (for approval queue widget)
     */
    async getPendingApprovals(projectId?: string): Promise<ApprovalRequest[]> {
        const client = assertSupabase()
        let query = client
            .from('approval_requests')
            .select('*')
            .eq('status', 'PENDING')
            .order('created_at', { ascending: false })

        if (projectId) {
            query = query.eq('project_id', projectId)
        }

        const { data, error } = await query
        if (error) {
            console.warn('[approval] getPendingApprovals error:', error.message)
            return []
        }
        return (data || []).map(rowToApproval)
    },

    /**
     * Create an approval request and notify approvers
     */
    async createApproval(input: CreateApprovalInput): Promise<ApprovalRequest> {
        const client = assertSupabase()
        const id = generateId('appr')

        // v4 Sprint 3 — Item 17: Smart approval routing by amount threshold
        // Rp 0–50M → supervisor, Rp 50M–500M → manager, >Rp 500M → director
        const resolvedRole: ApproverRole = input.approverRole ?? (() => {
            const amount = typeof input.impactSummary?.amount === 'number' ? input.impactSummary.amount : 0
            if (amount > 500_000_000) return 'director'
            if (amount > 50_000_000) return 'manager'
            return 'supervisor'
        })()

        // Check if the resolved approver role has an active delegate.
        // We use requesterId as a proxy for the primary approver identity when no
        // explicit approverId is available at creation time.
        const primaryApproverId = input.requesterId ?? ''
        const activeDelegate = primaryApproverId
            ? await this.getActiveDelegate(primaryApproverId, input.entityType)
            : null
        const finalAssignedApproverId = activeDelegate ?? undefined

        const { data, error } = await client
            .from('approval_requests')
            .insert({
                id,
                project_id: input.projectId,
                requester_id: input.requesterId || null,
                requester_name: input.requesterName || null,
                entity_type: input.entityType,
                entity_id: input.entityId,
                approver_role: resolvedRole,
                title: input.title,
                description: input.description || null,
                impact_summary: input.impactSummary ?? {},
                status: 'PENDING',
                assigned_approver_id: finalAssignedApproverId ?? null,
            })
            .select()
            .single()

        if (error) throw error

        const approval = rowToApproval(data)

        // Notify approvers (role resolved by smart routing above)
        // Map extended ApproverRole to notificationService's role type
        const notifyRole: 'admin' | 'manager' | 'user' =
            resolvedRole === 'director' ? 'admin' :
            resolvedRole === 'supervisor' ? 'user' :
            resolvedRole === 'admin' ? 'admin' : 'manager'

        const notifPayload = {
            projectId: input.projectId,
            type: 'APPROVAL_REQUEST' as const,
            severity: 'warning' as const,
            title: `Approval Needed: ${input.title}`,
            message: input.description || `New ${input.entityType} requires your approval`,
            entityType: input.entityType,
            entityId: input.entityId,
            metadata: {
                approvalId: id,
                impactSummary: input.impactSummary,
            },
        }

        try {
            if (activeDelegate) {
                // Route notification directly to the delegate
                await notificationService.createNotification({
                    ...notifPayload,
                    userId: activeDelegate,
                    message: `[Delegated] ${notifPayload.message}`,
                })
            } else {
                await notificationService.notifyByRole(input.projectId, notifyRole, notifPayload)
            }
        } catch (notifError) {
            console.warn('Failed to send approval notification:', notifError)
        }

        // Audit log
        try {
            await auditService.log({
                userId: input.requesterId,
                userName: input.requesterName,
                action: 'CREATE',
                entity: 'approval_requests',
                entityType: input.entityType,
                entityId: id,
                details: { title: input.title, impactSummary: input.impactSummary },
            })
        } catch (auditError) {
            console.warn('Audit log failed:', auditError)
        }

        return approval
    },

    /**
     * Approve a request — uses atomic RPC to prevent race condition
     * (two approvers clicking simultaneously)
     */
    async approve(
        approvalId: string,
        approverId: string,
        approverName: string,
        notes?: string
    ): Promise<ApprovalRequest> {
        const client = assertSupabase()

        // Atomic approve via DB-level row lock (fixes APPROVAL-02 race condition)
        const { data: rpcResult, error: rpcError } = await client
            .rpc('rpc_approve_request', {
                p_approval_id:   approvalId,
                p_approver_id:   approverId,
                p_approver_name: approverName,
                p_notes:         notes ?? null,
            })

        if (rpcError) throw rpcError
        if (!rpcResult?.success) {
            throw new Error(rpcResult?.error ?? 'Approval failed')
        }

        // Fetch updated record for full domain object
        const { data, error } = await client
            .from('approval_requests')
            .select('*')
            .eq('id', approvalId)
            .single()

        if (error) throw error
        const approval = rowToApproval(data)

        // Notify requester of approval
        if (approval.requesterId) {
            try {
                await notificationService.createNotification({
                    projectId: approval.projectId,
                    userId: approval.requesterId,
                    type: 'APPROVAL_RESULT',
                    severity: 'info',
                    title: `Approved: ${approval.title}`,
                    message: `Your request has been approved by ${approverName}${notes ? '. Note: ' + notes : ''}`,
                    entityType: approval.entityType,
                    entityId: approval.entityId,
                    metadata: { approvalId, result: 'APPROVED' },
                })
            } catch (e) {
                console.warn('Notification failed:', e)
            }
        }

        // Audit log
        try {
            await auditService.log({
                userId: approverId,
                userName: approverName,
                action: 'APPROVE',
                entity: 'approval_requests',
                entityType: approval.entityType,
                entityId: approvalId,
                details: { title: approval.title, notes },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        // Post-approval hook: trigger domain-specific cascade
        if (approval.entityType === 'CHANGE_ORDER' && approval.entityId) {
            try {
                const cascadeResult = await changeOrderCascade.execute(approval.entityId)
                console.info('[Approval] Change Order cascade completed:', cascadeResult)
            } catch (cascadeErr) {
                console.error('[Approval] Change Order cascade failed:', cascadeErr)
                // Don't throw — approval succeeded, cascade failure is logged separately
            }
        }

        // Post-approval hook: Execute PO Creation and auto-commit budget
        if (approval.entityType === 'PURCHASE_ORDER' && approval.impactSummary?.poData) {
            try {
                const { supplyChainService } = await import('./supplyChainService')
                const poData = approval.impactSummary.poData as {
                    po_number: string
                    vendor_name: string
                    items: Array<{ item_name?: string; quantity: number; unit_price: number; rap_item_id?: string }>
                }

                await supplyChainService.createPurchaseOrder({
                    project_id: approval.projectId,
                    po_number: poData.po_number,
                    vendor_name: poData.vendor_name,
                    total_amount: Number(approval.impactSummary.totalAmount) || 0,
                    status: 'APPROVED',
                    created_by: approval.requesterId || 'system',
                    approved_by: approverId,
                    approved_at: new Date().toISOString()
                }, poData.items, true) // Bypass budget guard since it was explicitly approved

                console.info('[Approval] PO successfully created and budget committed:', poData.po_number)
            } catch (poErr) {
                console.error('[Approval] PO execution failed:', poErr)
            }
        }

        // Post-approval hook: execute approved material transfer
        if ((approval.entityType === 'MATERIAL_TRANSFER' || approval.entityType === 'EMERGENCY_TRANSFER') && approval.entityId) {
            try {
                const { materialTransferService: mts } = await import('./materialTransferService')
                await mts.executeTransfer(approval.entityId)
            } catch (mtrErr) {
                console.error('[Approval] MTR execution failed:', mtrErr)
            }
        }

        // Post-approval hook: execute payment
        if (approval.entityType === 'PAYMENT' && approval.entityId) {
            try {
                const { financeService } = await import('./financeService')
                await financeService.payInvoice(approval.entityId, approval.projectId, Number(approval.impactSummary?.amount) || 0, approverId, approverName)
                console.info('[Approval] Payment successfully executed:', approval.entityId)
            } catch (err) {
                console.error('[Approval] Payment execution failed:', err)
            }
        }

        // Post-approval hook: Variation Order approved → update contract + project contract_value
        if (approval.entityType === 'CHANGE_ORDER' && approval.entityId && approval.impactSummary?.valueChange != null) {
            try {
                const { contractService } = await import('./contractService')
                await contractService.approveVariationOrder(approval.entityId, approverId, approverName)
                console.info('[Approval] Variation Order contract value updated:', approval.entityId)
            } catch (voErr) {
                // VO might be a CCO (change_orders table) rather than a VO (variation_orders table) — log but don't throw
                console.warn('[Approval] VO contract update skipped (may be CCO):', voErr)
            }
        }

        // Post-approval hook: Budget Revision approved → apply RAB changes
        if (approval.entityType === 'BUDGET_REVISION' && approval.entityId) {
            try {
                const { budgetRevisionService } = await import('./budgetRevisionService')
                await budgetRevisionService.applyRevision(approval.entityId, approverId, approverName)
                console.info('[Approval] Budget Revision applied:', approval.entityId)
            } catch (brErr) {
                console.error('[Approval] Budget Revision apply failed:', brErr)
            }
        }

        return approval
    },

    /**
     * Reject a request — uses atomic RPC to prevent race condition
     */
    async reject(
        approvalId: string,
        approverId: string,
        approverName: string,
        rejectionReason: string
    ): Promise<ApprovalRequest> {
        const client = assertSupabase()

        // Atomic reject via DB-level row lock (fixes APPROVAL-02 race condition)
        const { data: rpcResult, error: rpcError } = await client
            .rpc('rpc_reject_request', {
                p_approval_id:      approvalId,
                p_approver_id:      approverId,
                p_approver_name:    approverName,
                p_rejection_reason: rejectionReason,
            })

        if (rpcError) throw rpcError
        if (!rpcResult?.success) {
            throw new Error(rpcResult?.error ?? 'Rejection failed')
        }

        const { data, error } = await client
            .from('approval_requests')
            .select('*')
            .eq('id', approvalId)
            .single()

        if (error) throw error
        const approval = rowToApproval(data)

        // Notify requester of rejection
        if (approval.requesterId) {
            try {
                await notificationService.createNotification({
                    projectId: approval.projectId,
                    userId: approval.requesterId,
                    type: 'APPROVAL_RESULT',
                    severity: 'warning',
                    title: `Rejected: ${approval.title}`,
                    message: `Your request was rejected by ${approverName}. Reason: ${rejectionReason}`,
                    entityType: approval.entityType,
                    entityId: approval.entityId,
                    metadata: { approvalId, result: 'REJECTED', reason: rejectionReason },
                })
            } catch (e) {
                console.warn('Notification failed:', e)
            }
        }

        // Audit log
        try {
            await auditService.log({
                userId: approverId,
                userName: approverName,
                action: 'REJECT',
                entity: 'approval_requests',
                entityType: approval.entityType,
                entityId: approvalId,
                details: { title: approval.title, rejectionReason },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        return approval
    },

    // ------------------------------------------------------------------
    // Bulk Operations
    // ------------------------------------------------------------------

    /**
     * Approve multiple requests in one call.
     * Individual failures are collected — the function never throws.
     * A summary notification is sent to the approver at the end.
     */
    async bulkApprove(
        approvalIds: string[],
        approverId: string,
        approverName: string,
        notes?: string
    ): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
        const succeeded: string[] = []
        const failed: Array<{ id: string; error: string }> = []

        for (const id of approvalIds) {
            try {
                await this.approve(id, approverId, approverName, notes)
                succeeded.push(id)
            } catch (err) {
                failed.push({
                    id,
                    error: err instanceof Error ? err.message : String(err),
                })
            }
        }

        // Single summary notification to the approver
        try {
            const total = approvalIds.length
            const failCount = failed.length
            const successCount = succeeded.length
            await notificationService.createNotification({
                projectId: '',           // global — no project scope needed for a personal summary
                userId: approverId,
                type: 'APPROVAL_RESULT',
                severity: failCount > 0 ? 'warning' : 'info',
                title: 'Bulk Approval Complete',
                message: `Approved ${successCount}/${total} requests.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
                entityType: 'PURCHASE_ORDER', // placeholder entity type for the summary
                entityId: '',
                metadata: { succeeded, failed },
            })
        } catch (e) {
            console.warn('[approval] bulkApprove summary notification failed:', e)
        }

        return { succeeded, failed }
    },

    /**
     * Reject multiple requests in one call.
     * Individual failures are collected — the function never throws.
     * A summary notification is sent to the approver at the end.
     */
    async bulkReject(
        approvalIds: string[],
        approverId: string,
        approverName: string,
        rejectionReason: string
    ): Promise<{ succeeded: string[]; failed: Array<{ id: string; error: string }> }> {
        const succeeded: string[] = []
        const failed: Array<{ id: string; error: string }> = []

        for (const id of approvalIds) {
            try {
                await this.reject(id, approverId, approverName, rejectionReason)
                succeeded.push(id)
            } catch (err) {
                failed.push({
                    id,
                    error: err instanceof Error ? err.message : String(err),
                })
            }
        }

        // Single summary notification to the approver
        try {
            const total = approvalIds.length
            const failCount = failed.length
            const successCount = succeeded.length
            await notificationService.createNotification({
                projectId: '',
                userId: approverId,
                type: 'APPROVAL_RESULT',
                severity: failCount > 0 ? 'warning' : 'info',
                title: 'Bulk Rejection Complete',
                message: `Rejected ${successCount}/${total} requests.${failCount > 0 ? ` ${failCount} failed.` : ''}`,
                entityType: 'PURCHASE_ORDER',
                entityId: '',
                metadata: { succeeded, failed },
            })
        } catch (e) {
            console.warn('[approval] bulkReject summary notification failed:', e)
        }

        return { succeeded, failed }
    },

    // ------------------------------------------------------------------
    // Delegation
    // ------------------------------------------------------------------

    /**
     * Create an approval delegation: while active, any request that would go
     * to `delegatorId` is routed to `delegateId` instead.
     */
    async setDelegate(input: {
        projectId: string
        delegatorId: string
        delegateId: string
        entityTypes?: string[]   // empty array = all entity types
        validFrom?: string       // ISO date string, defaults to NOW()
        validUntil: string       // ISO date string, required
    }): Promise<void> {
        const client = assertSupabase()
        const id = generateId('delg')

        const { error } = await client
            .from('approval_delegates')
            .insert({
                id,
                project_id: input.projectId,
                delegator_id: input.delegatorId,
                delegate_id: input.delegateId,
                entity_types: input.entityTypes ?? [],
                valid_from: input.validFrom ?? new Date().toISOString(),
                valid_until: input.validUntil,
                is_active: true,
            })

        if (error) throw error
    },

    /**
     * Deactivate all active delegations for a delegator within a project.
     */
    async removeDelegate(delegatorId: string, projectId: string): Promise<void> {
        const client = assertSupabase()

        const { error } = await client
            .from('approval_delegates')
            .update({ is_active: false })
            .eq('delegator_id', delegatorId)
            .eq('project_id', projectId)
            .eq('is_active', true)

        if (error) throw error
    },

    /**
     * Find who is currently acting as delegate for a given user + entity type.
     * Calls the DB RPC introduced in migration 076.
     * Returns the delegate's UUID, or null if none is active.
     */
    async getActiveDelegate(delegatorId: string, entityType: string): Promise<string | null> {
        if (!delegatorId) return null
        try {
            const client = assertSupabase()
            const { data, error } = await client
                .rpc('rpc_get_active_delegate', {
                    p_delegator_id: delegatorId,
                    p_entity_type: entityType,
                })

            if (error) {
                console.warn('[approval] getActiveDelegate RPC error:', error.message)
                return null
            }
            return (data as string | null) ?? null
        } catch (e) {
            console.warn('[approval] getActiveDelegate unexpected error:', e)
            return null
        }
    },

    // ------------------------------------------------------------------
    // SLA / Overdue
    // ------------------------------------------------------------------

    /**
     * Return all pending or escalated approvals whose SLA deadline has passed.
     * Optionally scoped to a single project.
     */
    async getOverdueApprovals(projectId?: string): Promise<ApprovalRequest[]> {
        const client = assertSupabase()
        let query = client
            .from('approval_requests')
            .select('*')
            .in('status', ['PENDING', 'ESCALATED'])
            .lt('sla_deadline', new Date().toISOString())
            .order('sla_deadline', { ascending: true })

        if (projectId) {
            query = query.eq('project_id', projectId)
        }

        const { data, error } = await query
        if (error) {
            console.warn('[approval] getOverdueApprovals error:', error.message)
            return []
        }
        return (data || []).map(rowToApproval)
    },

    // ------------------------------------------------------------------
    // Approval Chains (routing templates)
    // ------------------------------------------------------------------

    /**
     * Create a reusable approval chain template for a project + entity type.
     * Steps define ordered approver roles, optionally filtered by amount range.
     */
    async createApprovalChain(input: {
        projectId: string
        entityType: string
        name: string
        steps: ApprovalChainStep[]
        escalationHours?: number
    }): Promise<{ id: string }> {
        const client = assertSupabase()
        const id = generateId('chain')

        const { error } = await client
            .from('approval_chains')
            .insert({
                id,
                project_id: input.projectId,
                entity_type: input.entityType,
                name: input.name,
                steps: input.steps,
                escalation_hours: input.escalationHours ?? 24,
                is_active: true,
            })

        if (error) throw error
        return { id }
    },

    /**
     * List all active approval chain templates for a project.
     */
    async getApprovalChains(projectId: string): Promise<ApprovalChain[]> {
        const client = assertSupabase()

        const { data, error } = await client
            .from('approval_chains')
            .select('*')
            .eq('project_id', projectId)
            .eq('is_active', true)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[approval] getApprovalChains error:', error.message)
            return []
        }

        return (data || []).map((row: {
            id: string
            project_id: string
            entity_type: string
            name: string
            steps: ApprovalChainStep[]
            escalation_hours: number
            is_active: boolean
        }): ApprovalChain => ({
            id: row.id,
            projectId: row.project_id,
            entityType: row.entity_type,
            name: row.name,
            steps: row.steps ?? [],
            escalationHours: row.escalation_hours,
            isActive: row.is_active,
        }))
    },
}
