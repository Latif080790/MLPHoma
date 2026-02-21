
import {
    upsertMaterialRequest,
    fetchMaterialRequests,
    upsertPurchaseOrder,
    fetchPurchaseOrders,
    fetchPoItems,
    upsertPoItem,
    upsertInventoryTransaction,
    fetchInventoryTransactions,
    fetchRabItems,
    fetchProjects,
    supabase,
    assertSupabase,
    MaterialRequestRow,
    PurchaseOrderRow,
    PoItemRow,
    InventoryTransactionRow
} from '../lib/supabaseClient'
import { MaterialRequest, PurchaseOrder, InventoryTransaction, MrStatus, PoStatus, PoItem } from '../types/supply-chain'
import { generateId } from '../lib/idGenerator'
import { checkBudgetAvailability, commitBudget, CheckableItem } from './budgetGuardService'

export const supplyChainService = {

    // --- Material Requests ---

    async createMaterialRequest(data: Omit<MaterialRequestRow, 'id' | 'created_at'>) {
        return upsertMaterialRequest({
            id: generateId(),
            ...data,
            status: 'PENDING'
        })
    },

    async getMaterialRequests(projectId: string): Promise<MaterialRequest[]> {
        const { data, error } = await fetchMaterialRequests(projectId)
        if (error) {
            console.warn('[supplyChain] getMaterialRequests error:', error.message)
            return []
        }

        return (data || []).map((row: any) => ({
            id: row.id,
            projectId: row.project_id,
            wbsId: row.wbs_id,
            wbsName: row.wbs_items?.name,
            wbsCode: row.wbs_items?.code,
            itemName: row.item_name,
            unit: row.unit,
            quantityRequested: row.quantity_requested,
            dateRequired: row.date_required,
            status: row.status as MrStatus,
            requestedBy: row.requested_by,
            notes: row.notes,
            createdAt: row.created_at
        }))
    },

    async updateMrStatus(id: string, status: MrStatus) {
        return upsertMaterialRequest({ id, status })
    },

    // --- Purchase Orders ---

    async createPurchaseOrder(data: Omit<PurchaseOrderRow, 'id' | 'created_at'>, items: Omit<PoItemRow, 'id' | 'po_id'>[]) {
        // 1. Validate Budget using Budget Guard Service
        if (items.length === 0) throw new Error("PO must have at least one item")

        // Map items to CheckableItem format
        const checkableItems: CheckableItem[] = items.map(item => ({
            rapItemId: item.rap_item_id,
            itemName: item.item_name || 'Unnamed Item',
            quantity: item.quantity,
            unitPrice: item.unit_price
        }))

        // Run budget check
        const budgetCheck = await checkBudgetAvailability(data.project_id, checkableItems)

        if (budgetCheck.hasExceeded) {
            throw new Error(budgetCheck.message)
        }

        // If requires approval but status is DRAFT, allow creation with warning
        // (Can be enhanced later with approval workflow)

        const poId = generateId()

        // 2. Create Header
        const { data: po, error: poError } = await upsertPurchaseOrder({
            id: poId,
            ...data,
            status: 'DRAFT'
        })

        if (poError) throw poError

        // 3. Create Items
        try {
            await Promise.all(items.map(item =>
                upsertPoItem({
                    id: generateId(),
                    po_id: poId,
                    ...item
                })
            ))

            // 4. Commit Budget for each RAP-linked item
            for (const item of items) {
                if (item.rap_item_id) {
                    const amount = item.quantity * item.unit_price
                    await commitBudget(item.rap_item_id, amount)
                }
            }

        } catch (itemError) {
            console.error("Failed to insert PO items", itemError)
            throw itemError
        }

        return poId
    },

    async getPurchaseOrders(projectId: string): Promise<PurchaseOrder[]> {
        const { data, error } = await fetchPurchaseOrders(projectId)
        if (error) {
            console.warn('[supplyChain] getPurchaseOrders error:', error.message)
            return []
        }

        return (data || []).map((row: any) => ({
            id: row.id,
            projectId: row.project_id,
            poNumber: row.po_number,
            vendorName: row.vendor_name,
            status: row.status as PoStatus,
            totalAmount: row.total_amount,
            createdBy: row.created_by,
            approvedBy: row.approved_by,
            approvedAt: row.approved_at,
            createdAt: row.created_at
        }))
    },

    async getPoItems(poId: string): Promise<PoItem[]> {
        const { data, error } = await fetchPoItems(poId)
        if (error) {
            console.warn('[supplyChain] getPoItems error:', error.message)
            return []
        }

        return (data || []).map((row: any) => ({
            id: row.id,
            poId: row.po_id,
            rapItemId: row.rap_item_id,
            rapItemName: row.rap_items?.rab_items?.name || 'Unknown Item',
            itemName: row.item_name,
            quantity: row.quantity,
            unitPrice: row.unit_price,
            totalPrice: row.quantity * row.unit_price, // recalc for safety
            createdAt: row.created_at
        }))
    },

    async updatePoStatus(id: string, status: PoStatus, approverId?: string) {
        const updates: Partial<PurchaseOrderRow> = { status }

        // Handle Approval
        if (status === 'APPROVED' && approverId) {
            updates.approved_by = approverId
            updates.approved_at = new Date().toISOString()
        }

        // Handle Rejection / Cancellation — rollback committed_cost
        if (status === 'REJECTED' || status === 'CANCELLED') {
            const items = await this.getPoItems(id)
            for (const item of items) {
                if (item.rapItemId) {
                    const { data: rapItem } = await assertSupabase()
                        .from('rap_items')
                        .select('committed_cost')
                        .eq('id', item.rapItemId)
                        .single()

                    if (rapItem) {
                        const newCommitted = Math.max(0, (rapItem.committed_cost || 0) - item.totalPrice)
                        await assertSupabase()
                            .from('rap_items')
                            .update({ committed_cost: newCommitted })
                            .eq('id', item.rapItemId)
                    }
                }
            }
        }

        // Handle Completion (Move Committed -> Actual)
        // Idempotency guard: only migrate if PO is not already COMPLETED
        if (status === 'COMPLETED') {
            // Check current PO status first
            const { data: currentPo } = await assertSupabase()
                .from('purchase_orders')
                .select('status')
                .eq('id', id)
                .single()

            if (currentPo?.status === 'COMPLETED') {
                // Already completed — skip cost migration to prevent double-move
                return upsertPurchaseOrder({ id, ...updates })
            }

            const items = await this.getPoItems(id)
            for (const item of items) {
                if (item.rapItemId) {
                    const { data: rapItem } = await assertSupabase()
                        .from('rap_items')
                        .select('committed_cost, actual_cost')
                        .eq('id', item.rapItemId)
                        .single()

                    if (rapItem) {
                        const amount = item.totalPrice
                        const newCommitted = Math.max(0, (rapItem.committed_cost || 0) - amount)
                        const newActual = (rapItem.actual_cost || 0) + amount

                        await assertSupabase()
                            .from('rap_items')
                            .update({
                                committed_cost: newCommitted,
                                actual_cost: newActual
                            })
                            .eq('id', item.rapItemId)
                    }
                }
            }

            // Propagate MR status: if PO was linked to an MR, mark it as fulfilled
            try {
                const { data: poRow } = await assertSupabase()
                    .from('purchase_orders')
                    .select('mr_id')
                    .eq('id', id)
                    .single()

                if (poRow?.mr_id) {
                    await this.updateMrStatus(poRow.mr_id, 'PO_CREATED')
                }
            } catch (mrErr) {
                console.warn('[SupplyChain] MR propagation failed (non-blocking):', mrErr)
            }
        }

        return upsertPurchaseOrder({ id, ...updates })
    },

    // --- Inventory ---

    async recordTransaction(data: Omit<InventoryTransactionRow, 'id' | 'created_at'>) {
        return upsertInventoryTransaction({
            id: generateId(),
            ...data
        })
    },

    async getInventoryTransactions(projectId: string): Promise<InventoryTransaction[]> {
        const { data, error } = await fetchInventoryTransactions(projectId)
        if (error) {
            console.warn('[supplyChain] getInventoryTransactions error:', error.message)
            return []
        }

        return (data || []).map((row: any) => ({
            id: row.id,
            projectId: row.project_id,
            wbsId: row.wbs_id,
            materialName: row.material_name,
            transactionType: row.transaction_type,
            quantity: row.quantity,
            unit: row.unit,
            referenceDoc: row.reference_doc,
            createdAt: row.created_at
        }))
    },

    // Calculate current stock from transactions
    async getInventoryStock(projectId: string): Promise<{ materialName: string, unit: string, totalIn: number, totalOut: number, current: number, currentStock: number }[]> {
        const transactions = await this.getInventoryTransactions(projectId)

        const stock: Record<string, { materialName: string, unit: string, totalIn: number, totalOut: number, current: number, currentStock: number }> = {}

        transactions.forEach(tx => {
            const key = tx.materialName.toLowerCase().trim()

            if (!stock[key]) {
                stock[key] = {
                    materialName: tx.materialName,
                    unit: tx.unit || 'unit',
                    totalIn: 0,
                    totalOut: 0,
                    current: 0,
                    currentStock: 0
                }
            }

            const qty = Number(tx.quantity) || 0

            if (tx.transactionType === 'IN' || tx.transactionType === 'RETURN') {
                stock[key].totalIn += qty
                stock[key].current += qty
            } else if (tx.transactionType === 'OUT' || tx.transactionType === 'TRANSFER') {
                stock[key].totalOut += qty
                stock[key].current -= qty
            }

            // Keep currentStock in sync for UI backward compatibility
            stock[key].currentStock = stock[key].current
        })

        return Object.values(stock)
    },

    /**
     * Analyze discrepancies between Procurement (Commitment) and Field Reporting
     */
    async getInventoryLeakageAnalysis(projectId: string): Promise<{
        itemName: string,
        procuredQty: number,
        reportedQty: number,
        delta: number,
        leakagePercentage: number,
        isAlert: boolean
    }[]> {
        const supabase = assertSupabase()

        // 1. Get all PO Items (Procured)
        const { data: poItems } = await supabase
            .from('po_items')
            .select('item_name, quantity, purchase_orders!inner(project_id)')
            .eq('purchase_orders.project_id', projectId)

        // 2. Get all Progress Logs (Reported Consumption)
        const { data: progressLogs } = await supabase
            .from('progress_logs')
            .select('notes, volume_daily')
            .eq('project_id', projectId)

        const analysis: Record<string, { itemName: string, procured: number, reported: number }> = {}

        poItems?.forEach(item => {
            const key = item.item_name.toLowerCase().trim()
            if (!analysis[key]) analysis[key] = { itemName: item.item_name, procured: 0, reported: 0 }
            analysis[key].procured += (item.quantity || 0)
        })

        progressLogs?.forEach(log => {
            // Heuristic matching
            Object.keys(analysis).forEach(key => {
                if (log.notes?.toLowerCase().includes(key)) {
                    analysis[key].reported += (log.volume_daily || 0)
                }
            })
        })

        return Object.values(analysis).map(item => {
            const delta = item.procured - item.reported
            const leakagePercentage = item.procured > 0 ? (delta / item.procured) * 100 : 0
            return {
                itemName: item.itemName,
                procuredQty: item.procured,
                reportedQty: item.reported,
                delta,
                leakagePercentage: parseFloat(leakagePercentage.toFixed(2)),
                isAlert: leakagePercentage > 15
            }
        })
    }
}
