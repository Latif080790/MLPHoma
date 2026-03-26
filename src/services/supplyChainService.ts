
import {
    upsertMaterialRequest,
    fetchMaterialRequests,
    upsertPurchaseOrder,
    fetchPurchaseOrders,
    fetchPoItems,
    upsertPoItem,
    upsertInventoryTransaction,
    fetchInventoryTransactions,
    assertSupabase,
    MaterialRequestRow,
    PurchaseOrderRow,
    PoItemRow,
    InventoryTransactionRow
} from '../lib/supabaseClient'
import { MaterialRequest, PurchaseOrder, InventoryTransaction, MrStatus, PoStatus, PoItem } from '../types/supply-chain'
import { generateId } from '../lib/idGenerator'
import { checkBudgetAvailability, commitBudget, CheckableItem } from './budgetGuardService'
import { eventBus } from '../lib/eventBus'

// Local augmented row types for Supabase join results
type MrRowWithJoin = MaterialRequestRow & { wbs_items?: { name?: string; code?: string } | null }
type PoItemRowWithJoin = PoItemRow & { rap_items?: { rab_items?: { name?: string } | null } | null }

export const supplyChainService = {

    // --- Material Requests ---

    async createMaterialRequest(data: Omit<MaterialRequestRow, 'id' | 'created_at'> | Partial<MaterialRequest>) {
        // Support either snake_case (row) or camelCase (domain) input
        const row = 'projectId' in data ? {
            id: generateId(),
            project_id: (data as Partial<MaterialRequest>).projectId || '',
            wbs_id: (data as Partial<MaterialRequest>).wbsId,
            item_name: (data as Partial<MaterialRequest>).itemName || '',
            unit: (data as Partial<MaterialRequest>).unit,
            quantity_requested: (data as Partial<MaterialRequest>).quantityRequested || 0,
            date_required: (data as Partial<MaterialRequest>).dateRequired,
            status: 'PENDING',
            requested_by: (data as Partial<MaterialRequest>).requestedBy,
            notes: (data as Partial<MaterialRequest>).notes,
        } : { id: generateId(), ...data as Omit<MaterialRequestRow, 'id' | 'created_at'>, status: 'PENDING' }
        return upsertMaterialRequest(row)
    },

    async getMaterialRequests(projectId: string): Promise<MaterialRequest[]> {
        const { data, error } = await fetchMaterialRequests(projectId)
        if (error) {
            console.warn('[supplyChain] getMaterialRequests error:', error.message)
            return []
        }

        return (data || []).map((row: MrRowWithJoin) => ({
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
            createdAt: row.created_at || ''
        }))
    },

    async updateMrStatus(id: string, status: MrStatus) {
        return upsertMaterialRequest({ id, status })
    },

    // --- Purchase Orders ---

    async createPurchaseOrder(data: Omit<PurchaseOrderRow, 'id' | 'created_at'> | Partial<PurchaseOrder>, items: Omit<PoItemRow, 'id' | 'po_id'>[] | Partial<PoItem>[], bypassBudgetGuard = false) {
        // Support either snake_case (row) or camelCase (domain) input
        const isSnakeCase = 'project_id' in data
        const projectId = isSnakeCase ? (data as PurchaseOrderRow).project_id : (data as Partial<PurchaseOrder>).projectId || ''
        const poNumber = isSnakeCase ? (data as PurchaseOrderRow).po_number : (data as Partial<PurchaseOrder>).poNumber || ''
        const vendorName = isSnakeCase ? (data as PurchaseOrderRow).vendor_name : (data as Partial<PurchaseOrder>).vendorName
        const totalAmount = isSnakeCase ? (data as PurchaseOrderRow).total_amount : (data as Partial<PurchaseOrder>).totalAmount || 0
        const status = (data as { status?: string }).status || 'DRAFT'
        const createdBy = isSnakeCase ? (data as PurchaseOrderRow).created_by : (data as Partial<PurchaseOrder>).createdBy
        const approvedBy = isSnakeCase ? (data as PurchaseOrderRow).approved_by : (data as Partial<PurchaseOrder>).approvedBy
        const approvedAt = isSnakeCase ? (data as PurchaseOrderRow).approved_at : (data as Partial<PurchaseOrder>).approvedAt
        const rowData: Omit<PurchaseOrderRow, 'id' | 'created_at'> = { project_id: projectId, po_number: poNumber, vendor_name: vendorName, total_amount: totalAmount, status, created_by: createdBy, approved_by: approvedBy, approved_at: approvedAt }
        // Map items to PoItemRow format
        const mappedItems: Omit<PoItemRow, 'id' | 'po_id'>[] = items.map(item => {
            if ('rap_item_id' in item || 'item_name' in item || 'unit_price' in item) {
                return item as Omit<PoItemRow, 'id' | 'po_id'>
            }
            const di = item as Partial<PoItem>
            return { rap_item_id: di.rapItemId, item_name: di.itemName, quantity: di.quantity || 0, unit_price: di.unitPrice || 0 }
        })
        // 1. Validate Budget using Budget Guard Service
        if (mappedItems.length === 0) throw new Error("PO must have at least one item")

        // Map items to CheckableItem format
        const checkableItems: CheckableItem[] = mappedItems.map(item => ({
            rapItemId: item.rap_item_id,
            itemName: item.item_name || 'Unnamed Item',
            quantity: item.quantity,
            unitPrice: item.unit_price
        }))

        // Run budget check unless bypassed (e.g. approved via workflow)
        if (!bypassBudgetGuard) {
            const budgetCheck = await checkBudgetAvailability(projectId, checkableItems)

            if (budgetCheck.hasExceeded) {
                throw new Error(budgetCheck.message)
            }
        }

        // If requires approval but status is DRAFT, allow creation with warning
        // (Can be enhanced later with approval workflow)

        const poId = generateId()

        // 2. Create Header
        const { error: poError } = await upsertPurchaseOrder({
            id: poId,
            ...rowData,
            status: 'DRAFT'
        })

        if (poError) throw poError

        // 3. Create Items
        try {
            await Promise.all(mappedItems.map(item =>
                upsertPoItem({
                    id: generateId(),
                    po_id: poId,
                    ...item
                })
            ))

            // 4. Commit Budget for each RAP-linked item
            for (const item of mappedItems) {
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

        return (data || []).map((row: PurchaseOrderRow) => ({
            id: row.id,
            projectId: row.project_id,
            poNumber: row.po_number,
            vendorName: row.vendor_name,
            status: row.status as PoStatus,
            totalAmount: row.total_amount,
            createdBy: row.created_by,
            approvedBy: row.approved_by,
            approvedAt: row.approved_at,
            createdAt: row.created_at || ''
        }))
    },

    async getPoItems(poId: string): Promise<PoItem[]> {
        const { data, error } = await fetchPoItems(poId)
        if (error) {
            console.warn('[supplyChain] getPoItems error:', error.message)
            return []
        }

        return (data || []).map((row: PoItemRowWithJoin) => ({
            id: row.id,
            poId: row.po_id,
            rapItemId: row.rap_item_id,
            rapItemName: row.rap_items?.rab_items?.name || 'Unknown Item',
            itemName: row.item_name,
            quantity: row.quantity,
            unitPrice: row.unit_price,
            totalPrice: row.quantity * row.unit_price, // recalc for safety
            createdAt: row.created_at || ''
        }))
    },

    async updatePoStatus(id: string, status: PoStatus, approverId?: string) {
        const updates: Partial<PurchaseOrderRow> = { status }

        // Handle Approval
        if (status === 'APPROVED' && approverId) {
            updates.approved_by = approverId
            updates.approved_at = new Date().toISOString()
            
            // Emit Event for Finance Sync (Server trigger handles the DB, we just notify the UI)
            const { data: po } = await assertSupabase().from('purchase_orders').select('project_id').eq('id', id).single()
            if (po?.project_id) {
                eventBus.emit('po:approved', { projectId: po.project_id, poId: id })
            }
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

    async recordTransaction(data: Omit<InventoryTransactionRow, 'id' | 'created_at'> | Partial<InventoryTransaction>) {
        const isSnakeCase = 'project_id' in data || 'material_name' in data
        const row: Omit<InventoryTransactionRow, 'id' | 'created_at'> = isSnakeCase ? data as Omit<InventoryTransactionRow, 'id' | 'created_at'> : {
            project_id: (data as Partial<InventoryTransaction>).projectId || '',
            wbs_id: (data as Partial<InventoryTransaction>).wbsId,
            material_name: (data as Partial<InventoryTransaction>).materialName || '',
            transaction_type: (data as Partial<InventoryTransaction>).transactionType || 'IN',
            quantity: (data as Partial<InventoryTransaction>).quantity || 0,
            unit: (data as Partial<InventoryTransaction>).unit,
            reference_doc: (data as Partial<InventoryTransaction>).referenceDoc,
        }
        return upsertInventoryTransaction({
            id: generateId(),
            ...row
        })
    },

    async getInventoryTransactions(projectId: string): Promise<InventoryTransaction[]> {
        const { data, error } = await fetchInventoryTransactions(projectId)
        if (error) {
            console.warn('[supplyChain] getInventoryTransactions error:', error.message)
            return []
        }

        return (data || []).map((row: InventoryTransactionRow) => ({
            id: row.id,
            projectId: row.project_id,
            wbsId: row.wbs_id,
            materialName: row.material_name,
            transactionType: row.transaction_type as import('../types/supply-chain').TransactionType,
            quantity: row.quantity,
            unit: row.unit,
            referenceDoc: row.reference_doc,
            createdAt: row.created_at || ''
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
