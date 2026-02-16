import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'
import { cn } from '@/lib/utils'

const ROUTE_LABELS: Record<string, string> = {
    'projects': 'Projects',
    'project-overview': 'Overview',
    'costing': 'Costing',
    'schedule': 'Schedule & Ops',
    'supply-chain': 'Supply Chain',
    'finance': 'Finance',
    'change-management': 'Change Mgmt',
    'documents': 'Documents',
    'handover': 'Handover',
    'tkdn': 'TKDN',
    'features': 'Features',
    'settings': 'Settings'
}

export function AppBreadcrumbs({ projectName }: { projectName?: string }) {
    const location = useLocation()
    const pathSegments = location.pathname.split('/').filter(Boolean)

    return (
        <nav className="flex items-center text-sm font-medium text-muted-foreground">
            <Link
                to="/"
                className="flex items-center hover:text-foreground transition-colors"
                title="Command Center"
            >
                <Home size={14} />
            </Link>

            {pathSegments.map((segment: string, index: number) => {
                const path = `/${pathSegments.slice(0, index + 1).join('/')}`
                const isLast = index === pathSegments.length - 1
                const label = ROUTE_LABELS[segment] || segment

                return (
                    <div key={path} className="flex items-center">
                        <ChevronRight size={14} className="mx-1 text-muted-foreground/50" />
                        {isLast ? (
                            <span className={cn(
                                "text-foreground font-semibold",
                                "animate-in fade-in slide-in-from-left-2 duration-300"
                            )}>
                                {label}
                            </span>
                        ) : (
                            <Link
                                to={path}
                                className="hover:text-foreground transition-colors hover:underline underline-offset-4"
                            >
                                {label}
                            </Link>
                        )}
                    </div>
                )
            })}

            {projectName && (
                <div className="flex items-center ml-2 pl-2 border-l border-border/50">
                    <span className="text-xs text-muted-foreground mr-1">of</span>
                    <span className="text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full">
                        {projectName}
                    </span>
                </div>
            )}
        </nav>
    )
}
