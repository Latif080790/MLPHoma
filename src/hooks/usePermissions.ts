/**
 * usePermissions.ts
 *
 * React hook for action-level permission checks using rbacService.
 * Wraps the current user's role from useAuthStore and provides
 * convenient can/canAny/canAll helpers.
 */

import { useAuthStore } from '@/store/authStore'
import { rbacService, type Action, type Role } from '@/services/rbacService'

export { ACTIONS } from '@/services/rbacService'
export type { Action, Role } from '@/services/rbacService'

export function usePermissions() {
    const profile = useAuthStore(s => s.profile)
    const role = (profile?.role as Role) || 'viewer'

    return {
        /** Current user role */
        role,

        /** Human label for current role */
        roleLabel: rbacService.getRoleLabel(role),

        /** Check single action permission */
        can: (action: Action) => rbacService.hasPermission(role, action),

        /** Check if user can perform ANY of the given actions */
        canAny: (actions: Action[]) => rbacService.hasAnyPermission(role, actions),

        /** Check if user can perform ALL of the given actions */
        canAll: (actions: Action[]) => rbacService.hasAllPermissions(role, actions),

        /** Get all actions the current user can perform */
        allowedActions: rbacService.getActionsForRole(role),
    }
}
