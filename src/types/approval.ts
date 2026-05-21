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
    | 'PROGRESS_CLAIM'
    | 'BUDGET_REVISION'

export type ApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED'

export type ApproverRole = 'supervisor' | 'manager' | 'director' | 'admin'

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

    // SLA & Assignment (added in migration 075)
    slaDeadline?: string
    slaHours?: number
    assignedApproverId?: string

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

// ------------------------------------------------------------------
// Approval Chains (multi-step routing templates)
// ------------------------------------------------------------------

export interface ApprovalChainStep {
    order: number
    approverRole: string
    amountMin?: number
    amountMax?: number
}

export interface ApprovalChain {
    id: string
    projectId: string
    entityType: string
    name: string
    steps: ApprovalChainStep[]
    escalationHours: number
    isActive: boolean
}

// ------------------------------------------------------------------
// Approval Delegates
// ------------------------------------------------------------------

export interface ApprovalDelegate {
    id: string
    projectId: string
    delegatorId: string
    delegateId: string
    entityTypes: string[]
    validFrom: string
    validUntil: string
    isActive: boolean
}

// ------------------------------------------------------------------
// Display config for approval entity types
// ------------------------------------------------------------------

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
    PROGRESS_CLAIM: 'Progress Claim',
    BUDGET_REVISION: 'Budget Revision',
}
