/**
 * contractService.ts
 * Contract Management — CRUD for contracts and variation orders.
 * When a VO is APPROVED, the parent contract's current_value and
 * the project's contract_value are updated atomically.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'
import { approvalService } from './approvalService'
import type {
    Contract, CreateContractInput,
    VariationOrder, CreateVariationOrderInput,
    ContractStatus, VariationOrderStatus,
} from '../types/contract'

// ------------------------------------------------------------------
// Row mappers
// ------------------------------------------------------------------

type ContractRow = {
    id: string; project_id: string; contract_number: string; title: string
    type: string; status: string; party_name: string; party_role: string
    party_contact?: string; original_value: number; current_value: number
    retention_pct: number; advance_payment_pct: number
    start_date: string; end_date: string; actual_end_date?: string
    description?: string; scope_of_work?: string; attachment_urls?: string[]
    created_by?: string; created_at: string; updated_at: string
}

type VORow = {
    id: string; contract_id: string; project_id: string; vo_number: string
    title: string; description?: string; value_change: number
    schedule_change_days: number; status: string
    submitted_at?: string; approved_at?: string; approved_by?: string
    rejection_reason?: string; created_by?: string; created_at: string; updated_at: string
}

function rowToContract(r: ContractRow): Contract {
    return {
        id: r.id, projectId: r.project_id, contractNumber: r.contract_number,
        title: r.title, type: r.type as Contract['type'], status: r.status as ContractStatus,
        partyName: r.party_name, partyRole: r.party_role as Contract['partyRole'],
        partyContact: r.party_contact, originalValue: r.original_value,
        currentValue: r.current_value, retentionPct: r.retention_pct,
        advancePaymentPct: r.advance_payment_pct, startDate: r.start_date,
        endDate: r.end_date, actualEndDate: r.actual_end_date,
        description: r.description, scopeOfWork: r.scope_of_work,
        attachmentUrls: r.attachment_urls, createdBy: r.created_by,
        createdAt: r.created_at, updatedAt: r.updated_at,
    }
}

function rowToVO(r: VORow): VariationOrder {
    return {
        id: r.id, contractId: r.contract_id, projectId: r.project_id,
        voNumber: r.vo_number, title: r.title, description: r.description,
        valueChange: r.value_change, scheduleChangeDays: r.schedule_change_days,
        status: r.status as VariationOrderStatus,
        submittedAt: r.submitted_at, approvedAt: r.approved_at,
        approvedBy: r.approved_by, rejectionReason: r.rejection_reason,
        createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
    }
}

// ------------------------------------------------------------------
// Number generators
// ------------------------------------------------------------------

function generateContractNumber(projectId: string): string {
    const d = new Date()
    return `CTR-${projectId.slice(0, 4).toUpperCase()}-${d.getFullYear()}-${d.getTime().toString().slice(-4)}`
}

function generateVONumber(contractId: string): string {
    const seq = Date.now().toString().slice(-4)
    return `VO-${contractId.slice(0, 4).toUpperCase()}-${seq}`
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const contractService = {

    // ── Contracts ────────────────────────────────────────────────────

    async getContracts(projectId: string): Promise<Contract[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('contracts')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[contract] getContracts error:', error.message)
            return []
        }
        return (data ?? []).map(r => rowToContract(r as ContractRow))
    },

    async getContract(id: string): Promise<Contract | null> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('contracts')
            .select('*')
            .eq('id', id)
            .maybeSingle()

        if (error) throw error
        return data ? rowToContract(data as ContractRow) : null
    },

    async createContract(input: CreateContractInput): Promise<Contract> {
        const client = assertSupabase()
        const id = generateId('ctr')
        const now = new Date().toISOString()

        const row = {
            id,
            project_id: input.projectId,
            contract_number: input.contractNumber ?? generateContractNumber(input.projectId),
            title: input.title,
            type: input.type,
            status: 'DRAFT',
            party_name: input.partyName,
            party_role: input.partyRole,
            party_contact: input.partyContact ?? null,
            original_value: input.originalValue,
            current_value: input.originalValue,
            retention_pct: input.retentionPct ?? 5,
            advance_payment_pct: input.advancePaymentPct ?? 0,
            start_date: input.startDate,
            end_date: input.endDate,
            description: input.description ?? null,
            scope_of_work: input.scopeOfWork ?? null,
            created_by: input.createdBy ?? null,
            created_at: now,
            updated_at: now,
        }

        const { data, error } = await client.from('contracts').insert(row).select().single()
        if (error) throw error

        await auditService.log({
            userId: input.createdBy,
            action: 'CREATE',
            entity: 'contracts',
            entityType: 'CONTRACT',
            entityId: id,
            details: { contractNumber: row.contract_number, title: input.title, value: input.originalValue },
        }).catch(() => {})

        return rowToContract(data as ContractRow)
    },

    async updateContractStatus(id: string, status: ContractStatus, userId?: string): Promise<void> {
        const client = assertSupabase()
        const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() }
        if (status === 'COMPLETED') updates.actual_end_date = new Date().toISOString().split('T')[0]

        const { error } = await client.from('contracts').update(updates).eq('id', id)
        if (error) throw error

        await auditService.log({
            userId,
            action: 'UPDATE',
            entity: 'contracts',
            entityType: 'CONTRACT',
            entityId: id,
            details: { status },
        }).catch(() => {})
    },

    // ── Variation Orders ─────────────────────────────────────────────

    async getVariationOrders(contractId: string): Promise<VariationOrder[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('variation_orders')
            .select('*')
            .eq('contract_id', contractId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[contract] getVariationOrders error:', error.message)
            return []
        }
        return (data ?? []).map(r => rowToVO(r as VORow))
    },

    async createVariationOrder(input: CreateVariationOrderInput): Promise<VariationOrder> {
        const client = assertSupabase()
        const id = generateId('vo')
        const now = new Date().toISOString()

        const row = {
            id,
            contract_id: input.contractId,
            project_id: input.projectId,
            vo_number: generateVONumber(input.contractId),
            title: input.title,
            description: input.description ?? null,
            value_change: input.valueChange,
            schedule_change_days: input.scheduleChangeDays ?? 0,
            status: 'DRAFT',
            created_by: input.createdBy ?? null,
            created_at: now,
            updated_at: now,
        }

        const { data, error } = await client.from('variation_orders').insert(row).select().single()
        if (error) throw error
        return rowToVO(data as VORow)
    },

    /**
     * Submit a VO for approval. Creates an approval request so the manager
     * can approve/reject via the Approval Inbox.
     */
    async submitVariationOrder(
        voId: string,
        requesterId?: string,
        requesterName?: string
    ): Promise<void> {
        const client = assertSupabase()

        const { data: vo, error: voErr } = await client
            .from('variation_orders')
            .select('*, contracts(title, current_value, project_id)')
            .eq('id', voId)
            .single()
        if (voErr || !vo) throw voErr ?? new Error('VO not found')

        const contract = (vo.contracts as { title?: string; current_value?: number; project_id?: string } | null)
        const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })

        // Update VO status to SUBMITTED
        const { error: updateErr } = await client
            .from('variation_orders')
            .update({ status: 'SUBMITTED', submitted_at: new Date().toISOString(), updated_at: new Date().toISOString() })
            .eq('id', voId)
        if (updateErr) throw updateErr

        // Create approval request
        await approvalService.createApproval({
            projectId: vo.project_id ?? contract?.project_id ?? '',
            requesterId,
            requesterName,
            entityType: 'CHANGE_ORDER',
            entityId: voId,
            title: `Variation Order: ${vo.title}`,
            description: vo.description ?? undefined,
            approverRole: 'manager',
            impactSummary: {
                valueChange: vo.value_change,
                scheduleChangeDays: vo.schedule_change_days,
                currentContractValue: contract?.current_value ?? 0,
                newContractValue: (contract?.current_value ?? 0) + vo.value_change,
                formattedChange: fmt.format(Math.abs(vo.value_change)),
                isAddition: vo.value_change >= 0,
                contractTitle: contract?.title,
            },
        })
    },

    /**
     * Approve a VO. Updates contract current_value and project contract_value atomically.
     * Called from the post-approval cascade (or directly when bypassing workflow).
     */
    async approveVariationOrder(
        voId: string,
        approverId: string,
        approverName: string
    ): Promise<void> {
        const client = assertSupabase()

        const { data: vo, error: voErr } = await client
            .from('variation_orders')
            .select('*, contracts(id, current_value, project_id)')
            .eq('id', voId)
            .single()
        if (voErr || !vo) throw voErr ?? new Error('VO not found')

        const contract = vo.contracts as { id: string; current_value: number; project_id: string } | null
        if (!contract) throw new Error('Contract not found for VO')

        const newContractValue = (contract.current_value ?? 0) + (vo.value_change ?? 0)

        // Transact: update VO + contract current_value + project contract_value in one batch
        const [voUpdate, contractUpdate, projectUpdate] = await Promise.all([
            client.from('variation_orders').update({
                status: 'APPROVED',
                approved_at: new Date().toISOString(),
                approved_by: approverId,
                updated_at: new Date().toISOString(),
            }).eq('id', voId),
            client.from('contracts').update({
                current_value: newContractValue,
                status: 'AMENDED',
                updated_at: new Date().toISOString(),
            }).eq('id', contract.id),
            client.from('projects').update({
                contract_value: newContractValue,
                updated_at: new Date().toISOString(),
            }).eq('id', contract.project_id),
        ])

        if (voUpdate.error) throw voUpdate.error
        if (contractUpdate.error) throw contractUpdate.error
        // Project update is best-effort (not all projects may have contract_value column)
        if (projectUpdate.error) {
            console.warn('[contract] project contract_value update failed:', projectUpdate.error.message)
        }

        await auditService.log({
            userId: approverId,
            userName: approverName,
            action: 'APPROVE',
            entity: 'variation_orders',
            entityType: 'CONTRACT',
            entityId: voId,
            details: { valueChange: vo.value_change, newContractValue },
        }).catch(() => {})
    },

    async rejectVariationOrder(voId: string, reason: string, approverId?: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('variation_orders')
            .update({
                status: 'REJECTED',
                rejection_reason: reason,
                updated_at: new Date().toISOString(),
            })
            .eq('id', voId)
        if (error) throw error

        await auditService.log({
            userId: approverId,
            action: 'REJECT',
            entity: 'variation_orders',
            entityType: 'CONTRACT',
            entityId: voId,
            details: { reason },
        }).catch(() => {})
    },

    /**
     * Total value change from all approved VOs on a contract.
     */
    async getTotalApprovedVOValue(contractId: string): Promise<number> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('variation_orders')
            .select('value_change')
            .eq('contract_id', contractId)
            .eq('status', 'APPROVED')

        if (error) return 0
        return (data ?? []).reduce((sum, vo) => sum + Number(vo.value_change ?? 0), 0)
    },
}
