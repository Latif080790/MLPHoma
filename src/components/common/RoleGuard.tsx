import React from 'react'
import { useAuthStore } from '@/store/authStore'

export type AllowedRole = 'PROJECT_MANAGER' | 'QC_ENGINEER' | 'FINANCE' | 'ADMIN' | 'ENGINEER'

interface RoleGuardProps {
    allowedRoles: AllowedRole[]
    children: React.ReactNode
    fallback?: React.ReactNode
}

/**
 * RoleGuard Component
 * 
 * Conditionally renders children if the current user has one of the allowed roles.
 * Primarily used to hide/disable sensitive buttons (like Approve PO, Pay Invoice).
 */
export function RoleGuard({ allowedRoles, children, fallback = null }: RoleGuardProps) {
    const role = useAuthStore((state) => state.role)

    // Admin passes all checks
    if (role === 'ADMIN') {
        return <>{children}</>
    }

    // Role check
    if (role && allowedRoles.includes(role)) {
        return <>{children}</>
    }

    return <>{fallback}</>
}
