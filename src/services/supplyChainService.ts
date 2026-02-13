
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
        // 1. Validate Budget (Strict Locking)
        const rapItemIds = items.map(i => i.rap_item_id).filter(Boolean) as string[]
        const rapMap = new Map<string, any>()

        if (rapItemIds.length > 0) {
            // Fetch RAP Items directly using Supabase client
            const { data: dbRapItems, error: dbError } = await supabase!
                .from('rap_items')
                .select(`
                    id, 
                    qty_budget, 
                    unit_price_budget, 
                    committed_cost, 
                    ahsp_items ( name ), 
                    rab_items ( name )
                `)
                .in('id', rapItemIds)

            if (dbError) throw new Error("Failed to validate budget: " + dbError.message)
            if (dbRapItems) {
                dbRapItems.forEach((r: any) => rapMap.set(r.id, r))
            }
        }

        // START VALIDATION
        if (items.length === 0) throw new Error("PO must have at least one item")

        for (const item of items) {
            if (!item.rap_item_id) continue

            const rapItem = rapMap.get(item.rap_item_id)
            if (!rapItem) throw new Error(`RAP Item not found for item: ${item.item_name}`)

            const requestedTotal = item.quantity * item.unit_price

            // Calculate remaining: Budget - Committed
            const totalBudget = (rapItem.qty_budget || 0) * (rapItem.unit_price_budget || 0)
            const committed = rapItem.committed_cost || 0
            const remaining = totalBudget - committed

            if (requestedTotal > remaining) {
                const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })
                const itemName = rapItem.ahsp_items?.name || rapItem.rab_items?.name || item.item_name
                throw new Error(
                    `Budget Exceeded for ${itemName}!\n` +
                    `Requested: ${formatter.format(requestedTotal)}\n` +
                    `Remaining: ${formatter.format(remaining)}`
                )
            }
        }

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

            // 4. Update Committed Cost in RAP
            for (const item of items) {
                if (item.rap_item_id) {
                    const rapItem = rapMap.get(item.rap_item_id)
                    if (rapItem) {
                        const newCommitted = (rapItem.committed_cost || 0) + (item.quantity * item.unit_price)
                        // Fire and forget update
                        supabase!
                            .from('rap_items')
                            .update({ committed_cost: newCommitted })
                            .eq('id', rapItem.id)
                            .then(({ error }) => {
                                if (error) console.error("Failed to update committed cost", error)
                            })
                    }
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
