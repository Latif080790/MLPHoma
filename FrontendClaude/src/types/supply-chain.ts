
export type MrStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PO_CREATED'
export type PoStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'PARTIALLY_RECEIVED' | 'COMPLETED'
export type TransactionType = 'IN' | 'OUT' | 'TRANSFER' | 'RETURN'

export interface MaterialRequest {
    id: string
    projectId: string
    wbsId?: string
    wbsName?: string // Joined
    wbsCode?: string // Joined

    itemName: string
    unit?: string
    quantityRequested: number
    dateRequired?: string

    status: MrStatus
    requestedBy?: string
    notes?: string
    createdAt: string

    // Virtual for UI
    isSelected?: boolean
}

export interface PurchaseOrder {
    id: string
    projectId: string
    poNumber: string
    vendorName?: string

    status: PoStatus
    totalAmount: number

    createdBy?: string
    approvedBy?: string
    approvedAt?: string
    createdAt: string

    items?: PoItem[]
}

export interface PoItem {
    id: string
    poId: string
    rapItemId?: string
    rapItemName?: string // Joined via rab_items

    itemName?: string // Manual override if no RAP
    quantity: number
    unitPrice: number
    totalPrice: number

    createdAt: string
}

export interface InventoryTransaction {
    id: string
    projectId: string
    wbsId?: string

    materialName: string
    transactionType: TransactionType
    quantity: number
    unit?: string

    referenceDoc?: string
    createdAt: string
}

export interface InventoryStock {
    materialName: string
    unit: string
    totalIn: number
    totalOut: number
    current: number
    /** Alias for current (kept for backward compatibility) */
    currentStock?: number
}
