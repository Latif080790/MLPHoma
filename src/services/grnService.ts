/**
 * grnService.ts
 * Service layer for Goods Receipt Notes (GRN).
 * Connects PO → GRN → Inventory → Invoice (AP) → RAP Actual Cost.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { notificationService } from './notificationService'
import { auditService } from './auditService'
import { supplyChainService } from './supplyChainService'
import type { GoodsReceipt, CreateGrnInput, GrnStatus, GrnItem } from '../types/grn'

// ─── Local row types ──────────────────────────────────────────────────────────
type GrnDbRow = {
    id: string; project_id: string; po_id: string; grn_number: string;
    received_by: string; receiver_name: string; received_date: string;
    items: GrnItem[]; photo_url: string | null; delivery_note_url: string | null;
    notes: string | null; status: GrnStatus; verified_by: string | null; verified_at: string | null;
    created_at: string; updated_at: string;
}
type PoItemLike = { item_name: string; quantity: number; unit_price: number; rap_item_id?: string | null }
type GrnItemExt = GrnItem & { rapItemId?: string; unitPrice?: number }

// ------------------------------------------------------------------
// Row ↔ Domain Mappers
// ------------------------------------------------------------------

function rowToGrn(row: GrnDbRow): GoodsReceipt {
    return {
        id: row.id,
        projectId: row.project_id,
        poId: row.po_id,
        grnNumber: row.grn_number,
        receivedBy: row.received_by,
        receiverName: row.receiver_name,
        receivedDate: row.received_date,
        items: row.items || [],
        photoUrl: row.photo_url ?? undefined,
        deliveryNoteUrl: row.delivery_note_url ?? undefined,
        notes: row.notes ?? undefined,
        status: row.status,
        verifiedBy: row.verified_by ?? undefined,
        verifiedAt: row.verified_at ?? undefined,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const grnService = {

    /**
     * Get all GRNs for a project
     */
    async getGRNs(projectId: string): Promise<GoodsReceipt[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('goods_receipts')
            .select('*')
            .eq('project_id', projectId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[grn] getGRNs error:', error.message)
            return []
        }
        return (data || []).map(rowToGrn)
    },

    /**
     * Get GRNs for a specific PO
     */
    async getGRNsByPO(poId: string): Promise<GoodsReceipt[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('goods_receipts')
            .select('*')
            .eq('po_id', poId)
            .order('created_at', { ascending: false })

        if (error) {
            console.warn('[grn] getGRNsByPO error:', error.message)
            return []
        }
        return (data || []).map(rowToGrn)
    },

    /**
     * Create a GRN and trigger downstream effects:
     * 1. Create inventory IN transactions for each item
     * 2. Notify Finance about pending invoice
     */
    async createGRN(
        input: CreateGrnInput,
        receiverUserId: string,
        receiverName: string
    ): Promise<GoodsReceipt> {
        const client = assertSupabase()
        const id = generateId('grn')

        // Generate GRN number
        const { count } = await client
            .from('goods_receipts')
            .select('*', { count: 'exact', head: true })
            .eq('project_id', input.projectId)

        const grnNumber = `GRN-${String((count || 0) + 1).padStart(4, '0')}`

        const { data, error } = await client
            .from('goods_receipts')
            .insert({
                id,
                project_id: input.projectId,
                po_id: input.poId,
                grn_number: grnNumber,
                received_by: receiverUserId,
                receiver_name: receiverName,
                received_date: input.receivedDate,
                items: input.items,
                photo_url: input.photoUrl || null,
                delivery_note_url: input.deliveryNoteUrl || null,
                notes: input.notes || null,
                status: 'PENDING',
            })
            .select()
            .single()

        if (error) throw error
        const grn = rowToGrn(data)

        // Create inventory IN transactions for each received item
        try {
            const inventoryInserts = input.items.map((item: GrnItem) => ({
                id: generateId('inv'),
                project_id: input.projectId,
                material_name: item.itemName,
                transaction_type: 'IN',
                quantity: item.qtyReceived,
                unit: item.unit,
                reference_doc: grnNumber,
            }))

            if (inventoryInserts.length > 0) {
                await client.from('inventory_transactions').insert(inventoryInserts)
            }
        } catch (invError) {
            console.warn('[GRN] Failed to create inventory transactions:', invError)
        }

        // Audit
        try {
            await auditService.log({
                userId: receiverUserId,
                userName: receiverName,
                action: 'CREATE',
                entity: 'goods_receipts',
                entityType: 'GRN',
                entityId: id,
                details: { grnNumber, poId: input.poId, itemCount: input.items.length },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        return grn
    },

    /**
     * Verify GRN — triggers:
     * 1. Auto-create Invoice (AP) in Finance
     * 2. Update RAP actual_cost from committed_cost
     * 3. Update PO status if fully received
     */
    async verifyGRN(
        grnId: string,
        verifierId: string,
        verifierName: string
    ): Promise<GoodsReceipt> {
        const client = assertSupabase()

        // Fetch the GRN
        const { error: grnError } = await client
            .from('goods_receipts')
            .select('*')
            .eq('id', grnId)
            .single()

        if (grnError) throw grnError

        // Update GRN status
        const { data, error } = await client
            .from('goods_receipts')
            .update({
                status: 'VERIFIED',
                verified_by: verifierId,
                verified_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
            .eq('id', grnId)
            .select()
            .single()

        if (error) throw error
        const grn = rowToGrn(data)

        // --- DOWNSTREAM EFFECTS ---

        // 1. Auto-create Invoice (AP) from GRN received quantities (not PO total)
        try {
            const { data: po } = await client
                .from('purchase_orders')
                .select('*, po_items(*)')
                .eq('id', grn.poId)
                .single()

            if (po) {
                // Check for existing invoice for this GRN to prevent duplicates
                const { data: existingInv } = await client
                    .from('invoices')
                    .select('id')
                    .eq('po_id', grn.poId)
                    .eq('invoice_number', `INV-${grn.grnNumber}`)
                    .maybeSingle()

                if (!existingInv) {
                    // Calculate invoice from GRN received items (not full PO amount)
                    const grnItems: GrnItem[] = grn.items || []
                    const poItems = po.po_items || []

                    // Match GRN items to PO items to get unit prices
                    let grnTotal = 0
                    for (const gi of grnItems) {
                        // Find matching PO item by name
                        const matchedPo = poItems.find((pi: PoItemLike) =>
                            pi.item_name === gi.itemName || pi.rap_item_id === (gi as GrnItemExt).rapItemId
                        )
                        const unitPrice = matchedPo ? Number(matchedPo.unit_price) : (gi as GrnItemExt).unitPrice || 0
                        grnTotal += gi.qtyReceived * unitPrice
                    }

                    // Fallback: if no match found, use PO total (backward compat)
                    if (grnTotal === 0) {
                        grnTotal = poItems.reduce(
                            (sum: number, item: PoItemLike) => sum + (item.quantity * item.unit_price), 0
                        )
                    }

                    const taxAmount = grnTotal * 0.11 // PPN 11%

                    await client.from('invoices').insert({
                        id: generateId('inv'),
                        project_id: grn.projectId,
                        po_id: grn.poId,
                        vendor_name: po.vendor_name || 'Unknown Vendor',
                        invoice_number: `INV-${grn.grnNumber}`,
                        description: `Invoice from GRN ${grn.grnNumber}`,
                        amount: grnTotal,
                        tax_amount: taxAmount,
                        total_amount: grnTotal + taxAmount,
                        due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                        status: 'UNPAID',
                    })
                }

                // 2. Check if PO is fully received across all GRNs
                const { data: allGrns } = await client
                    .from('goods_receipts')
                    .select('items')
                    .eq('po_id', grn.poId)
                    .eq('status', 'VERIFIED')

                // Sum received quantities per item across all verified GRNs
                const receivedMap = new Map<string, number>()
                for (const g of (allGrns || [])) {
                    for (const item of (g.items || [])) {
                        const key = item.itemName || item.item_name || ''
                        receivedMap.set(key, (receivedMap.get(key) || 0) + Number(item.qtyReceived || 0))
                    }
                }

                // Compare with PO ordered quantities
                const poItemsList = po.po_items || []
                const isFullyReceived = poItemsList.length > 0 && poItemsList.every((pi: PoItemLike) => {
                    const received = receivedMap.get(pi.item_name) || 0
                    return received >= Number(pi.quantity)
                })

                // 3. Update PO status via supplyChainService (single source of truth for cost migration)
                if (isFullyReceived) {
                    // Fully received — delegate to supplyChainService which handles committed→actual
                    await supplyChainService.updatePoStatus(grn.poId, 'COMPLETED')
                } else {
                    // Partially received — just update status, no cost migration yet
                    await client.from('purchase_orders').update({
                        status: 'PARTIALLY_RECEIVED',
                        updated_at: new Date().toISOString(),
                    }).eq('id', grn.poId)
                }
            }
        } catch (downstreamError) {
            console.warn('[GRN] Downstream effect error:', downstreamError)
        }

        // Notify Finance about new invoice
        try {
            await notificationService.notifyByRole(grn.projectId, 'manager', {
                projectId: grn.projectId,
                type: 'MATERIAL_ALERT',
                severity: 'info',
                title: `GRN Verified: ${grn.grnNumber}`,
                message: `Goods received and verified. Invoice automatically created for payment processing.`,
                entityType: 'GRN',
                entityId: grnId,
            })
        } catch (e) {
            console.warn('Notification failed:', e)
        }

        // Audit
        try {
            await auditService.log({
                userId: verifierId,
                userName: verifierName,
                action: 'APPROVE',
                entity: 'goods_receipts',
                entityType: 'GRN',
                entityId: grnId,
                details: { grnNumber: grn.grnNumber, poId: grn.poId },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }

        return grn
    },

    /**
     * Reject GRN
     */
    async rejectGRN(grnId: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('goods_receipts')
            .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
            .eq('id', grnId)

        if (error) throw error
    },
}
