
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
    MaterialRequestRow,
    PurchaseOrderRow,
    PoItemRow,
    InventoryTransactionRow
} from '../lib/supabaseClient'
import { MaterialRequest, PurchaseOrder, InventoryTransaction, MrStatus, PoStatus, PoItem } from '../types/supply-chain'
import { generateId } from '../lib/idGenerator'

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
        if (error) throw error

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
        const poId = generateId()

        // 1. Create Header
        const { data: po, error: poError } = await upsertPurchaseOrder({
            id: poId,
            ...data,
            status: 'DRAFT'
        })

        if (poError) throw poError

        // 2. Create Items
        // Use Promise.all for parallel insertion (could be improved with batch insert if available)
        try {
            await Promise.all(items.map(item =>
                upsertPoItem({
                    id: generateId(),
                    po_id: poId,
                    ...item
                })
            ))
        } catch (itemError) {
            console.error("Failed to insert PO items", itemError)
            // Ideally rollback PO here, but Supabase generic client doesn't support transactions easily without RPC
            throw itemError
        }

        return poId
    },

    async getPurchaseOrders(projectId: string): Promise<PurchaseOrder[]> {
        const { data, error } = await fetchPurchaseOrders(projectId)
        if (error) throw error

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
        if (error) throw error

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
        if (status === 'APPROVED' && approverId) {
            updates.approved_by = approverId
            updates.approved_at = new Date().toISOString()
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
        if (error) throw error

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
    async getInventoryStock(projectId: string) {
        const transactions = await this.getInventoryTransactions(projectId)

        const stock: Record<string, { materialName: string, unit: string, totalIn: number, totalOut: number, current: number }> = {}

        transactions.forEach(tx => {
            const key = tx.materialName.toLowerCase().trim()

            if (!stock[key]) {
                stock[key] = {
                    materialName: tx.materialName,
                    unit: tx.unit || 'unit',
                    totalIn: 0,
                    totalOut: 0,
                    current: 0
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
        })

        return Object.values(stock)
    }
}
