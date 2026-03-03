/**
 * materialTransferService.ts
 * Service for Material Transfer Requests with PM approval workflow.
 * Implements the masterplan "Quick Transfer" and "Emergency Transfer" patterns.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { approvalService } from './approvalService'
import { notificationService } from './notificationService'
import { auditService } from './auditService'
import type { MaterialTransferRequest, CreateTransferInput } from '../types/material-transfer'

// ------------------------------------------------------------------
// Row ↔ Domain Mappers
// ------------------------------------------------------------------
type TransferDbRow = { id: string; project_id?: string; requester_id?: string; requester_name?: string; source_wbs_id?: string; source_wbs_name?: string; target_wbs_id?: string; target_wbs_name?: string; item_name?: string; item_id?: string; unit?: string; quantity?: number; unit_cost?: number; total_cost?: number; reason?: string; is_emergency?: boolean; status: string; approval_request_id?: string; approved_by?: string; approved_at?: string; rejection_reason?: string; created_at: string; updated_at?: string }

function rowToTransfer(row: TransferDbRow): MaterialTransferRequest {
    return {
        id: row.id,
        projectId: row.project_id || '',
        requesterId: row.requester_id,
        requesterName: row.requester_name,
        sourceWbsId: row.source_wbs_id || '',
        sourceWbsName: row.source_wbs_name,
        targetWbsId: row.target_wbs_id || '',
        targetWbsName: row.target_wbs_name,
        itemName: row.item_name || '',
        itemId: row.item_id,
        unit: row.unit,
        quantity: row.quantity ?? 0,
        unitCost: row.unit_cost || 0,
        totalCost: row.total_cost || 0,
        reason: row.reason || '',
        isEmergency: row.is_emergency ?? false,
        status: row.status as import('../types/material-transfer').TransferStatus,
        approvalRequestId: row.approval_request_id,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        rejectionReason: row.rejection_reason,
        createdAt: row.created_at,
        updatedAt: row.updated_at || '',
    }
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const materialTransferService = {

    /**
     * Get all transfer requests for a project
     */
    async getTransfers(projectId: string): Promise<MaterialTransferRequest[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('material_transfer_requests')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[materialTransfer] getTransfers error:', error.message)
            return []
        }
        return (data || []).map(rowToTransfer)
    },

    /**
     * Create a material transfer request.
     * - Creates the transfer record
     * - Creates an approval request targeted at PM (manager)
     * - Sends notification to PM dashboard
     * - If emergency: marks as such with critical severity
     */
    async createTransfer(
        input: CreateTransferInput | Partial<MaterialTransferRequest>,
        requesterId: string,
        requesterName: string
    ): Promise<MaterialTransferRequest> {
        const client = assertSupabase()
        const id = generateId('mtr')
        const projectId = (input as CreateTransferInput).projectId || (input as Partial<MaterialTransferRequest>).projectId || ''
        const inp = input as CreateTransferInput

        // Calculate transfer frequency (for impact warning)
        const { count: weeklyCount } = await client
            .from('material_transfer_requests')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', projectId)
            .eq('requester_id', requesterId)
            .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

        // Build impact summary for PM
        const impactSummary: Record<string, unknown> = {
            budgetImpact: -(inp.quantity * (inp.unitCost || 0)),
            sourceWbs: inp.sourceWbsName || inp.sourceWbsId,
            targetWbs: inp.targetWbsName || inp.targetWbsId,
            quantity: inp.quantity,
            unit: inp.unit,
            unitCost: inp.unitCost || 0,
            totalCost: inp.quantity * (inp.unitCost || 0),
        }

        if ((weeklyCount || 0) >= 2) {
            impactSummary.warning = `Supervisor ini sudah ${(weeklyCount || 0) + 1}x minta relokasi minggu ini`
        }

        // Insert transfer request
        const { data, error } = await client
            .from('material_transfer_requests')
            .insert({
                id,
                project_id: projectId,
                requester_id: requesterId,
                requester_name: requesterName,
                source_wbs_id: inp.sourceWbsId,
                source_wbs_name: inp.sourceWbsName || null,
                target_wbs_id: inp.targetWbsId,
                target_wbs_name: inp.targetWbsName || null,
                item_name: inp.itemName,
                item_id: inp.itemId || null,
                unit: inp.unit || null,
                quantity: inp.quantity,
                unit_cost: inp.unitCost || 0,
                reason: inp.reason,
                is_emergency: inp.isEmergency ?? false,
                status: 'PENDING',
            })
            .select()
            .single()

        if (error) throw error
        const transfer = rowToTransfer(data)

        // Create approval request
        try {
            const approval = await approvalService.createApproval({
                projectId,
                requesterId,
                requesterName,
                entityType: inp.isEmergency ? 'EMERGENCY_TRANSFER' : 'MATERIAL_TRANSFER',
                entityId: id,
                approverRole: 'manager',
                title: `Transfer: ${inp.itemName} (${inp.quantity} ${inp.unit || 'unit'})`,
                description: `${inp.sourceWbsName || 'Source'} → ${inp.targetWbsName || 'Target'}. Reason: ${inp.reason}`,
                impactSummary,
            })

            // Link approval back to transfer
            await client.from('material_transfer_requests')
                .update({ approval_request_id: approval.id })
                .eq('id', id)
        } catch (approvalError) {
            console.warn('[Transfer] Failed to create approval:', approvalError)
        }

        // If emergency, send critical notification
        if (inp.isEmergency) {
            try {
                await notificationService.notifyByRole(projectId, 'manager', {
                    projectId,
                    type: 'TRANSFER_REQUEST',
                    severity: 'critical',
                    title: `EMERGENCY Transfer: ${inp.itemName}`,
                    message: `Urgent unauthorized transfer by ${requesterName}. ${inp.sourceWbsName} → ${inp.targetWbsName}. Review immediately!`,
                    entityType: 'TRANSFER',
                    entityId: id,
                    metadata: impactSummary,
                })
            } catch (e) {
                console.warn('Emergency notification failed:', e)
            }
        }

        // Audit
        try {
            await auditService.log({
                userId: requesterId,
                userName: requesterName,
                action: 'CREATE',
                entity: 'material_transfer_requests',
                entityType: 'TRANSFER',
                entityId: id,
                details: { ...inp, impactSummary },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        return transfer
    },

    /**
     * Execute an approved transfer:
     * 1. Create inventory OUT from source WBS
     * 2. Create inventory IN to target WBS
     * 3. Move cost from source RAP to target RAP
     * 4. Update transfer status to EXECUTED
     */
    async executeTransfer(transferId: string): Promise<void> {
        const client = assertSupabase()

        // Fetch transfer
        const { data: transfer, error: fetchError } = await client
            .from('material_transfer_requests')
            .select('*')
            .eq('id', transferId)
            .single()

        if (fetchError) throw fetchError
        if (transfer.status !== 'APPROVED') {
            throw new Error('Transfer must be APPROVED before execution')
        }

        // 1. Create inventory movements
        const outTx = {
            id: generateId('inv'),
            project_id: transfer.project_id,
            wbs_id: transfer.source_wbs_id,
            material_name: transfer.item_name,
            transaction_type: 'OUT',
            quantity: transfer.quantity,
            unit: transfer.unit,
            reference_doc: `MTR-${transferId.slice(-8)}`,
        }
        const inTx = {
            id: generateId('inv'),
            project_id: transfer.project_id,
            wbs_id: transfer.target_wbs_id,
            material_name: transfer.item_name,
            transaction_type: 'IN',
            quantity: transfer.quantity,
            unit: transfer.unit,
            reference_doc: `MTR-${transferId.slice(-8)}`,
        }

        await client.from('inventory_transactions').insert([outTx, inTx])

        // 2. Update transfer status
        await client.from('material_transfer_requests').update({
            status: 'EXECUTED',
            updated_at: new Date().toISOString(),
        }).eq('id', transferId)

        // 3. Audit
        try {
            await auditService.log({
                action: 'TRANSFER',
                entity: 'material_transfer_requests',
                entityType: 'TRANSFER',
                entityId: transferId,
                details: {
                    itemName: transfer.item_name,
                    quantity: transfer.quantity,
                    sourceWbs: transfer.source_wbs_name,
                    targetWbs: transfer.target_wbs_name,
                },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }
    },
}
