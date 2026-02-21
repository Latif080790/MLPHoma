/**
 * audit.ts
 * Type definitions for the Audit Trail system
 */

export type AuditAction =
    // Generic actions
    | 'CREATE'
    | 'UPDATE'
    | 'DELETE'
    | 'APPROVE'
    | 'REJECT'
    | 'STATUS_CHANGE'
    | 'BUDGET_CHANGE'
    | 'TRANSFER'
    | 'PAYMENT'
    | 'LOGIN'
    | 'EXPORT'
    | 'SNAPSHOT'
    | 'PRICE_OVERRIDE'
    | 'REVERT'
    | 'DEACTIVATE'
    | 'ASSIGN'
    | 'PROJECT_ARCHIVED'
    // Finance actions
    | 'INVOICE_CREATED'
    | 'INVOICE_PAID'
    | 'CLAIM_SUBMITTED'
    | 'CLAIM_APPROVED'
    | 'CLAIM_PAID'
    // Document actions
    | 'DOCUMENT_UPLOADED'
    | 'DOCUMENT_VERSION_CREATED'
    | 'DOCUMENT_LOCKED'
    | 'DOCUMENT_UNLOCKED'
    | 'DOCUMENT_ARCHIVED'
    | 'DOCUMENT_DELETED'
    // Change order actions
    | 'CO_CREATED'
    | 'CO_APPROVED'
    | 'CO_REJECTED'
    // Approval actions
    | 'APPROVAL_GRANTED'
    | 'APPROVAL_REJECTED'
    // Procurement actions
    | 'PO_CREATED'
    | 'PO_APPROVED'
    | 'GRN_VERIFIED'

export interface AuditLogEntry {
    id: string
    userId?: string
    userName?: string

    action: AuditAction
    entity: string      // Table/module name: 'purchase_orders', 'rap_items', etc.
    entityType?: string  // e.g., 'PO', 'RAP', 'MR'
    entityId?: string

    details: Record<string, any>
    // Example: { oldValue: {...}, newValue: {...}, reason: "Budget override" }

    ipAddress?: string
    createdAt: string
}

export interface CreateAuditInput {
    userId?: string
    userName?: string
    action: AuditAction
    entity: string
    entityType?: string
    entityId?: string
    details?: Record<string, any>
}
