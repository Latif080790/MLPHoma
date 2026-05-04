/**
 * grn.ts
 * Type definitions for Goods Receipt Notes
 */

export type GrnStatus = 'PENDING' | 'VERIFIED' | 'REJECTED'

export interface GrnItem {
    poItemId?: string
    itemName: string
    qtyOrdered: number
    qtyReceived: number
    unit: string
    notes?: string
}

export interface GoodsReceipt {
    id: string
    projectId: string
    poId: string

    grnNumber: string
    receivedBy?: string
    receiverName?: string
    receivedDate: string

    items: GrnItem[]

    photoUrl?: string
    deliveryNoteUrl?: string
    notes?: string

    status: GrnStatus
    verifiedBy?: string
    verifiedAt?: string

    createdAt: string
    updatedAt: string
}

export interface CreateGrnInput {
    projectId: string
    poId: string
    receivedDate: string
    items: GrnItem[]
    photoUrl?: string
    deliveryNoteUrl?: string
    notes?: string
}
