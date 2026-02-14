/**
 * audit.ts
 * Type definitions for the Audit Trail system
 */

export type AuditAction =
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
