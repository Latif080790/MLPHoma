/**
 * work-order.ts
 * Type definitions for SPK (Surat Perintah Kerja) / Work Orders
 */

export type WorkOrderStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'

export interface WorkOrder {
    id: string
    projectId: string

    spkNumber: string
    wbsId?: string
    wbsName?: string

    mandorName: string
    mandorContact?: string

    scopeDescription: string
    unit: string
    unitPrice: number
    maxVolume: number
    maxAmount: number  // Generated: unitPrice * maxVolume

    actualVolume: number
    actualAmount: number  // Generated: unitPrice * actualVolume

    paidAmount: number
    remainingPayment: number  // Generated: actualAmount - paidAmount

    status: WorkOrderStatus

    startDate?: string
    endDate?: string

    notes?: string
    createdAt: string
    updatedAt: string
}

export interface CreateWorkOrderInput {
    projectId: string
    wbsId?: string
    wbsName?: string
    mandorName: string
    mandorContact?: string
    scopeDescription: string
    unit: string
    unitPrice: number
    maxVolume: number
    startDate?: string
    endDate?: string
    notes?: string
}

export interface OpnameInput {
    workOrderId: string
    volume: number
    notes?: string
    photoUrl?: string
}
