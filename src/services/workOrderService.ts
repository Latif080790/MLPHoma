/**
 * workOrderService.ts
 * Service layer for SPK (Surat Perintah Kerja) / Work Orders / Opname Mandor.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'
import type { WorkOrder, CreateWorkOrderInput, OpnameInput } from '../types/work-order'

// ------------------------------------------------------------------
// Row ↔ Domain Mappers
// ------------------------------------------------------------------

function rowToWorkOrder(row: any): WorkOrder {
    return {
        id: row.id,
        projectId: row.project_id,
        spkNumber: row.spk_number,
        wbsId: row.wbs_id,
        wbsName: row.wbs_name,
        mandorName: row.mandor_name,
        mandorContact: row.mandor_contact,
        scopeDescription: row.scope_description,
        unit: row.unit,
        unitPrice: Number(row.unit_price),
        maxVolume: Number(row.max_volume),
        maxAmount: Number(row.max_amount || 0),
        actualVolume: Number(row.actual_volume || 0),
        actualAmount: Number(row.actual_amount || 0),
        paidAmount: Number(row.paid_amount || 0),
        remainingPayment: Number(row.remaining_payment || 0),
        status: row.status,
        startDate: row.start_date,
        endDate: row.end_date,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const workOrderService = {

    /**
     * Get all work orders for a project
     */
    async getWorkOrders(projectId: string): Promise<WorkOrder[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('work_orders')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[workOrderService] getWorkOrders error:', error.message)
            return []
        }
        return (data || []).map(rowToWorkOrder)
    },

    /**
     * Create a work order (SPK)
     */
    async createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
        const client = assertSupabase()
        const id = generateId('spk')

        // Generate SPK number
        const { count } = await client
            .from('work_orders')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', input.projectId)

        const spkNumber = `SPK-${String((count || 0) + 1).padStart(4, '0')}`

        const { data, error } = await client
            .from('work_orders')
            .insert({
                id,
                project_id: input.projectId,
                spk_number: spkNumber,
                wbs_id: input.wbsId || null,
                wbs_name: input.wbsName || null,
                mandor_name: input.mandorName,
                mandor_contact: input.mandorContact || null,
                scope_description: input.scopeDescription,
                unit: input.unit,
                unit_price: input.unitPrice,
                max_volume: input.maxVolume,
                status: 'DRAFT',
                start_date: input.startDate || null,
                end_date: input.endDate || null,
                notes: input.notes || null,
            })
            .select()
            .single()

        if (error) throw error

        try {
            await auditService.log({
                action: 'CREATE',
                entity: 'work_orders',
                entityType: 'SPK',
                entityId: id,
                details: { spkNumber, mandorName: input.mandorName, maxVolume: input.maxVolume },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        return rowToWorkOrder(data)
    },

    /**
     * Record opname (volume check)
     * Validates that actual_volume doesn't exceed max_volume
     */
    async recordOpname(input: OpnameInput): Promise<WorkOrder> {
        const client = assertSupabase()

        // Fetch current work order
        const { data: current, error: fetchErr } = await client
            .from('work_orders')
            .select('*')
            .eq('id', input.workOrderId)
            .single()

        if (fetchErr) throw fetchErr

        const newActualVolume = (Number(current.actual_volume) || 0) + input.volume

        if (newActualVolume > Number(current.max_volume)) {
            throw new Error(
                `Volume opname (${newActualVolume} ${current.unit}) melebihi plafon SPK (${current.max_volume} ${current.unit}). Butuh Change Order.`
            )
        }

        const { data, error } = await client
            .from('work_orders')
            .update({
                actual_volume: newActualVolume,
                updated_at: new Date().toISOString(),
            })
            .eq('id', input.workOrderId)
            .select()
            .single()

        if (error) throw error

        try {
            await auditService.log({
                action: 'UPDATE',
                entity: 'work_orders',
                entityType: 'SPK',
                entityId: input.workOrderId,
                details: { opname: input.volume, newTotal: newActualVolume, notes: input.notes },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        return rowToWorkOrder(data)
    },

    /**
     * Activate a work order
     */
    async activateWorkOrder(id: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('work_orders')
            .update({ status: 'ACTIVE', updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error
    },

    /**
     * Complete a work order
     */
    async completeWorkOrder(id: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('work_orders')
            .update({ status: 'COMPLETED', updated_at: new Date().toISOString() })
            .eq('id', id)

        if (error) throw error
    },

    /**
     * Record payment to mandor
     */
    async recordPayment(workOrderId: string, amount: number): Promise<WorkOrder> {
        const client = assertSupabase()

        const { data: current, error: fetchErr } = await client
            .from('work_orders')
            .select('*')
            .eq('id', workOrderId)
            .single()

        if (fetchErr) throw fetchErr

        const newPaidAmount = (Number(current.paid_amount) || 0) + amount
        const maxPayable = Number(current.unit_price) * Number(current.actual_volume)

        if (newPaidAmount > maxPayable) {
            throw new Error(
                `Pembayaran (Rp ${newPaidAmount.toLocaleString('id-ID')}) melebihi nilai opname (Rp ${maxPayable.toLocaleString('id-ID')})`
            )
        }

        const { data, error } = await client
            .from('work_orders')
            .update({
                paid_amount: newPaidAmount,
                updated_at: new Date().toISOString(),
            })
            .eq('id', workOrderId)
            .select()
            .single()

        if (error) throw error

        try {
            await auditService.log({
                action: 'PAYMENT',
                entity: 'work_orders',
                entityType: 'SPK',
                entityId: workOrderId,
                details: { amount, totalPaid: newPaidAmount, mandor: current.mandor_name },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        return rowToWorkOrder(data)
    },
}
