/**
 * notification.ts
 * Type definitions for the Notification Engine
 */

export type NotificationType =
    | 'BUDGET_WARNING'
    | 'BUDGET_CRITICAL'
    | 'SCHEDULE_ALERT'
    | 'SCHEDULE_REMINDER'
    | 'APPROVAL_REQUEST'
    | 'APPROVAL_RESULT'
    | 'MATERIAL_ALERT'
    | 'TRANSFER_REQUEST'
    | 'QUALITY_ALERT'
    | 'CHANGE_ORDER'
    | 'SYSTEM_INFO'
    | 'BILLING_MILESTONE'
    | 'SYSTEM'

export type NotificationSeverity = 'info' | 'warning' | 'critical'

export interface AppNotification {
    id: string
    projectId?: string
    userId: string

    type: NotificationType
    severity: NotificationSeverity

    title: string
    message: string

    metadata?: Record<string, unknown>

    entityType?: string  // 'PO', 'MR', 'TRANSFER', 'VO', 'TASK', etc.
    entityId?: string

    isRead: boolean
    readAt?: string

    createdAt: string
}

/**
 * Input for creating a notification
 */
export interface CreateNotificationInput {
    projectId?: string
    userId: string
    type: NotificationType
    severity: NotificationSeverity
    title: string
    message: string
    metadata?: Record<string, unknown>
    entityType?: string
    entityId?: string
}

/**
 * Notification display config per type
 */
export const NOTIFICATION_CONFIG: Record<NotificationType, { icon: string; color: string; label: string }> = {
    BUDGET_WARNING: { icon: 'AlertTriangle', color: 'text-yellow-500', label: 'Budget Warning' },
    BUDGET_CRITICAL: { icon: 'AlertOctagon', color: 'text-red-600', label: 'Budget Critical' },
    SCHEDULE_ALERT: { icon: 'Clock', color: 'text-orange-500', label: 'Schedule Alert' },
    SCHEDULE_REMINDER: { icon: 'Bell', color: 'text-blue-500', label: 'Schedule Reminder' },
    APPROVAL_REQUEST: { icon: 'FileCheck', color: 'text-purple-500', label: 'Approval Needed' },
    APPROVAL_RESULT: { icon: 'CheckCircle', color: 'text-green-500', label: 'Approval Result' },
    MATERIAL_ALERT: { icon: 'Package', color: 'text-amber-500', label: 'Material Alert' },
    TRANSFER_REQUEST: { icon: 'ArrowRightLeft', color: 'text-indigo-500', label: 'Transfer Request' },
    QUALITY_ALERT: { icon: 'ShieldAlert', color: 'text-red-500', label: 'Quality Alert' },
    CHANGE_ORDER: { icon: 'FileEdit', color: 'text-teal-500', label: 'Change Order' },
    SYSTEM_INFO: { icon: 'Info', color: 'text-slate-500', label: 'System Info' },
    BILLING_MILESTONE: { icon: 'Receipt', color: 'text-green-600', label: 'Billing Milestone' },
    SYSTEM: { icon: 'Info', color: 'text-slate-400', label: 'System' },
}
