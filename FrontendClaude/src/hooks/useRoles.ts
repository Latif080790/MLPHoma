import { useAuthStore } from '@/store/authStore'

export type UserRole = 'admin' | 'manager' | 'user'

export const useRoles = () => {
    const profile = useAuthStore((s) => s.profile)
    const role = profile?.role || 'user' // Default to 'user' if undefined

    const isAdmin = role === 'admin'
    const isManager = role === 'manager' || role === 'admin' // Managers also have manager rights, Admins have all
    const isUser = true // Everyone is at least a user

    return {
        role,
        isAdmin,
        isManager,
        isUser,
        // Helper to check if user has at least this role
        hasRole: (requiredRole: UserRole) => {
            if (requiredRole === 'admin') return isAdmin
            if (requiredRole === 'manager') return isManager
            return true
        }
    }
}
