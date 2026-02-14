/**
 * material-transfer.ts
 * Type definitions for Material Transfer Requests with approval workflow
 */

export type TransferStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXECUTED'

export interface MaterialTransferRequest {
    id: string
    projectId: string

    requesterId?: string
    requesterName?: string

    sourceWbsId: string
    sourceWbsName?: string
    targetWbsId: string
    targetWbsName?: string

    itemName: string
    itemId?: string
    unit?: string
    quantity: number

    unitCost: number
    totalCost: number  // Generated: quantity * unitCost

    reason: string
    isEmergency: boolean

    status: TransferStatus

    approvalRequestId?: string
    approvedBy?: string
    approvedAt?: string
    rejectionReason?: string

    createdAt: string
    updatedAt: string
}

export interface CreateTransferInput {
    projectId: string
    sourceWbsId: string
    sourceWbsName?: string
    targetWbsId: string
    targetWbsName?: string
    itemName: string
    itemId?: string
    unit?: string
    quantity: number
    unitCost?: number
    reason: string
    isEmergency?: boolean
}
