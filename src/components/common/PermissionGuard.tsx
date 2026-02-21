import React from 'react'
import { useRoles, UserRole } from '@/hooks/useRoles'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface PermissionGuardProps {
    children: React.ReactNode
    requiredRole: UserRole
    /** 
     * If true, renders children but disabled/greyed out with a tooltip.
     * If false (default), does not render children at all.
     */
    showDisabled?: boolean
    fallback?: React.ReactNode
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
    children,
    requiredRole,
    showDisabled = false,
    fallback = null
}) => {
    const { hasRole } = useRoles()
    const hasPermission = hasRole(requiredRole)

    if (hasPermission) {
        return <>{children}</>
    }

    if (showDisabled) {
        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <div className="opacity-50 pointer-events-none cursor-not-allowed inline-block">
                            {children}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>You need <strong>{requiredRole}</strong> permissions to perform this action.</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        )
    }

    return <>{fallback}</>
}
