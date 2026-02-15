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
import type { ApprovalRequest, CreateApprovalInput, ApprovalStatus } from '../types/approval'

// ------------------------------------------------------------------
// Row ↔ Domain Mappers
// ------------------------------------------------------------------

function rowToApproval(row: any): ApprovalRequest {
    return {
        id: row.id,
        projectId: row.project_id,
        requesterId: row.requester_id,
        requesterName: row.requester_name,
        entityType: row.entity_type,
        entityId: row.entity_id,
        approverRole: row.approver_role,
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

        const { data, error } = await client
            .from('approval_requests')
            .insert({
                id,
                project_id: input.projectId,
                requester_id: input.requesterId || null,
                requester_name: input.requesterName || null,
                entity_type: input.entityType,
                entity_id: input.entityId,
                approver_role: input.approverRole || 'manager',
                title: input.title,
                description: input.description || null,
                impact_summary: input.impactSummary ?? {},
                status: 'PENDING',
            })
            .select()
            .single()

        if (error) throw error

        const approval = rowToApproval(data)

        // Notify managers/admins about the new approval request
        try {
            await notificationService.notifyByRole(
                input.projectId,
                input.approverRole || 'manager',
                {
                    projectId: input.projectId,
                    type: 'APPROVAL_REQUEST',
                    severity: 'warning',
                    title: `Approval Needed: ${input.title}`,
                    message: input.description || `New ${input.entityType} requires your approval`,
                    entityType: input.entityType,
                    entityId: input.entityId,
                    metadata: {
                        approvalId: id,
                        impactSummary: input.impactSummary,
                    },
                }
            )
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
     * Approve a request
     */
    async approve(
        approvalId: string,
        approverId: string,
        approverName: string,
        notes?: string
    ): Promise<ApprovalRequest> {
        const client = assertSupabase()

        const { data, error } = await client
            .from('approval_requests')
            .update({
                status: 'APPROVED',
                approved_by: approverId,
                approver_name: approverName,
                approved_at: new Date().toISOString(),
                notes: notes || null,
                updated_at: new Date().toISOString(),
            })
            .eq('id', approvalId)
            .eq('status', 'PENDING')  // Only approve if still PENDING
            .select()
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

        return approval
    },

    /**
     * Reject a request
     */
    async reject(
        approvalId: string,
        approverId: string,
        approverName: string,
        rejectionReason: string
    ): Promise<ApprovalRequest> {
        const client = assertSupabase()

        const { data, error } = await client
            .from('approval_requests')
            .update({
                status: 'REJECTED',
                approved_by: approverId,
                approver_name: approverName,
                approved_at: new Date().toISOString(),
                rejection_reason: rejectionReason,
                updated_at: new Date().toISOString(),
            })
            .eq('id', approvalId)
            .eq('status', 'PENDING')
            .select()
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
}
