/**
 * rbacService.ts
 *
 * Role-Based Access Control (RBAC) Service.
 * Defines a formal permission matrix mapping roles to allowed actions.
 * Used by usePermissions hook and PermissionGuard component.
 *
 * Roles: owner, admin, manager, engineer, procurement, finance, foreman, viewer
 * Actions: granular per-feature actions (approve_po, approve_cco, delete_project, etc.)
 */

// ─── Role Definitions ───

export const ROLES = [
    'owner',
    'admin',
    'manager',
    'engineer',
    'procurement',
    'finance',
    'foreman',
    'viewer',
] as const

export type Role = typeof ROLES[number]

// ─── Action Definitions ───

export const ACTIONS = {
    // Project
    CREATE_PROJECT: 'create_project',
    EDIT_PROJECT: 'edit_project',
    DELETE_PROJECT: 'delete_project',
    VIEW_PROJECT: 'view_project',

    // RAB / AHSP
    EDIT_RAB: 'edit_rab',
    PUBLISH_RAB: 'publish_rab',
    LOCK_BASELINE: 'lock_baseline',

    // RAP
    EDIT_RAP: 'edit_rap',

    // Supply Chain
    CREATE_MR: 'create_mr',
    APPROVE_MR: 'approve_mr',
    CREATE_PO: 'create_po',
    APPROVE_PO: 'approve_po',
    OVERRIDE_BUDGET: 'override_budget',
    RECORD_GRN: 'record_grn',

    // Finance
    CREATE_INVOICE: 'create_invoice',
    APPROVE_PAYMENT: 'approve_payment',
    VIEW_FINANCE: 'view_finance',

    // Change Order
    CREATE_CCO: 'create_cco',
    SUBMIT_CCO: 'submit_cco',
    REVIEW_CCO: 'review_cco',
    APPROVE_CCO: 'approve_cco',

    // Timeline
    EDIT_TIMELINE: 'edit_timeline',
    SET_BASELINE: 'set_baseline',

    // Progress
    SUBMIT_PROGRESS: 'submit_progress',
    VIEW_PROGRESS: 'view_progress',

    // Documents
    UPLOAD_DOCUMENT: 'upload_document',
    DELETE_DOCUMENT: 'delete_document',

    // Admin
    MANAGE_USERS: 'manage_users',
    VIEW_AUDIT: 'view_audit',
    EXPORT_DATA: 'export_data',
} as const

export type Action = typeof ACTIONS[keyof typeof ACTIONS]

// ─── Permission Matrix ───

const PERMISSION_MATRIX: Record<Role, Set<Action>> = {
    owner: new Set(Object.values(ACTIONS) as Action[]),

    admin: new Set(Object.values(ACTIONS) as Action[]),

    manager: new Set([
        ACTIONS.VIEW_PROJECT, ACTIONS.EDIT_PROJECT,
        ACTIONS.EDIT_RAB, ACTIONS.PUBLISH_RAB, ACTIONS.LOCK_BASELINE,
        ACTIONS.EDIT_RAP,
        ACTIONS.CREATE_MR, ACTIONS.APPROVE_MR,
        ACTIONS.CREATE_PO, ACTIONS.APPROVE_PO, ACTIONS.OVERRIDE_BUDGET,
        ACTIONS.RECORD_GRN,
        ACTIONS.VIEW_FINANCE, ACTIONS.APPROVE_PAYMENT,
        ACTIONS.CREATE_CCO, ACTIONS.SUBMIT_CCO, ACTIONS.REVIEW_CCO, ACTIONS.APPROVE_CCO,
        ACTIONS.EDIT_TIMELINE, ACTIONS.SET_BASELINE,
        ACTIONS.SUBMIT_PROGRESS, ACTIONS.VIEW_PROGRESS,
        ACTIONS.UPLOAD_DOCUMENT, ACTIONS.DELETE_DOCUMENT,
        ACTIONS.VIEW_AUDIT, ACTIONS.EXPORT_DATA,
    ] as Action[]),

    engineer: new Set([
        ACTIONS.VIEW_PROJECT,
        ACTIONS.EDIT_RAB, ACTIONS.EDIT_RAP,
        ACTIONS.CREATE_MR,
        ACTIONS.CREATE_CCO, ACTIONS.SUBMIT_CCO,
        ACTIONS.EDIT_TIMELINE,
        ACTIONS.SUBMIT_PROGRESS, ACTIONS.VIEW_PROGRESS,
        ACTIONS.UPLOAD_DOCUMENT,
        ACTIONS.EXPORT_DATA,
    ] as Action[]),

    procurement: new Set([
        ACTIONS.VIEW_PROJECT,
        ACTIONS.CREATE_MR, ACTIONS.APPROVE_MR,
        ACTIONS.CREATE_PO, ACTIONS.RECORD_GRN,
        ACTIONS.CREATE_INVOICE,
        ACTIONS.VIEW_PROGRESS,
        ACTIONS.UPLOAD_DOCUMENT,
        ACTIONS.EXPORT_DATA,
    ] as Action[]),

    finance: new Set([
        ACTIONS.VIEW_PROJECT,
        ACTIONS.VIEW_FINANCE,
        ACTIONS.CREATE_INVOICE, ACTIONS.APPROVE_PAYMENT,
        ACTIONS.VIEW_PROGRESS,
        ACTIONS.UPLOAD_DOCUMENT,
        ACTIONS.EXPORT_DATA,
    ] as Action[]),

    foreman: new Set([
        ACTIONS.VIEW_PROJECT,
        ACTIONS.CREATE_MR,
        ACTIONS.SUBMIT_PROGRESS, ACTIONS.VIEW_PROGRESS,
        ACTIONS.UPLOAD_DOCUMENT,
    ] as Action[]),

    viewer: new Set([
        ACTIONS.VIEW_PROJECT,
        ACTIONS.VIEW_FINANCE,
        ACTIONS.VIEW_PROGRESS,
        ACTIONS.VIEW_AUDIT,
    ] as Action[]),
}

// ─── Service ───

export const rbacService = {

    /**
     * Check if a role has permission to perform an action.
     */
    hasPermission(role: Role | string, action: Action): boolean {
        const perms = PERMISSION_MATRIX[role as Role]
        if (!perms) return false
        return perms.has(action)
    },

    /**
     * Get all actions allowed for a role.
     */
    getActionsForRole(role: Role | string): Action[] {
        const perms = PERMISSION_MATRIX[role as Role]
        if (!perms) return []
        return Array.from(perms)
    },

    /**
     * Check if a role can perform ANY of the given actions.
     */
    hasAnyPermission(role: Role | string, actions: Action[]): boolean {
        return actions.some(action => this.hasPermission(role, action))
    },

    /**
     * Check if a role can perform ALL of the given actions.
     */
    hasAllPermissions(role: Role | string, actions: Action[]): boolean {
        return actions.every(action => this.hasPermission(role, action))
    },

    /**
     * Get a human-readable label for each role.
     */
    getRoleLabel(role: Role | string): string {
        const labels: Record<string, string> = {
            owner: 'Owner',
            admin: 'Administrator',
            manager: 'Project Manager',
            engineer: 'Engineer',
            procurement: 'Procurement',
            finance: 'Finance',
            foreman: 'Site Foreman',
            viewer: 'Viewer',
        }
        return labels[role] || role
    },
}
