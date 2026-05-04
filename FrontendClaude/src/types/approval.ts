/**
 * approval.ts
 * Type definitions for the Approval Workflow Engine
 */

export type ApprovalEntityType =
    | 'PURCHASE_ORDER'
    | 'MATERIAL_TRANSFER'
    | 'BUDGET_OVERRIDE'
    | 'BUDGET_TRANSFER'
    | 'PAYMENT'
    | 'CHANGE_ORDER'
    | 'EMERGENCY_TRANSFER'

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

export type ApproverRole = 'manager' | 'admin'

export interface ApprovalRequest {
    id: string
    projectId: string

    requesterId?: string
    requesterName?: string

    entityType: ApprovalEntityType
    entityId: string

    approverRole: ApproverRole

    title: string
    description?: string

    impactSummary: Record<string, unknown>
    // Example: { budgetImpact: -500000, sourceWbs: "Kolom", targetWbs: "Dinding", warning: "3rd transfer this week" }

    status: ApprovalStatus

    approvedBy?: string
    approverName?: string
    approvedAt?: string
    rejectionReason?: string
    notes?: string

    createdAt: string
    updatedAt: string
}

export interface CreateApprovalInput {
    projectId: string
    requesterId?: string
    requesterName?: string
    entityType: ApprovalEntityType
    entityId: string
    approverRole?: ApproverRole
    title: string
    description?: string
    impactSummary?: Record<string, unknown>
}

/**
 * Display config for approval entity types
 */
export const APPROVAL_ENTITY_LABELS: Record<ApprovalEntityType, string> = {
    PURCHASE_ORDER: 'Purchase Order',
    MATERIAL_TRANSFER: 'Material Transfer',
    BUDGET_OVERRIDE: 'Budget Override',
    BUDGET_TRANSFER: 'Budget Transfer',
    PAYMENT: 'Payment',
    CHANGE_ORDER: 'Change Order',
    EMERGENCY_TRANSFER: 'Emergency Transfer (Urgent)',
}
