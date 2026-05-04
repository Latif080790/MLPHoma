import React from 'react'
import { useLocation } from 'react-router'
import { Link } from 'react-router-dom'
import {
    LayoutDashboard,
    FolderKanban,
    ClipboardList,
    Calculator,
    CalendarClock,
    Truck,
    Wallet,
    FileDiff,
    FolderOpen,
    ClipboardCheck,
    Flag,
    Sliders,
    Settings,
    ChevronLeft,
    ChevronRight,
    Hexagon,
    Zap,
    BarChart3,
    Layers,
    PieChart
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { approvalService } from '@/services/approvalService'
import { useProjectStore } from '@/store/projectStore'
import { getSidebarGroups, type NavIconKey } from '@/config/navRegistry'

const ICON_MAP: Record<NavIconKey, React.ElementType> = {
    LayoutDashboard,
    FolderKanban,
    ClipboardList,
    Calculator,
    BarChart3,
    CalendarClock,
    Truck,
    Wallet,
    FileDiff,
    FolderOpen,
    ClipboardCheck,
    Flag,
    Layers,
    PieChart,
    Zap,
    Sliders,
    Settings,
}

interface AppSidebarProps {
    collapsed: boolean
    setCollapsed: (v: boolean) => void
    /** Mobile/Tablet drawer open state */
    open?: boolean
    /** Whether sidebar is in overlay mode (mobile/tablet) */
    isOverlay?: boolean
}

/**
 * AppSidebar v3.1 — Responsive with drawer support.
 *
 * Key fixes:
 *   - added drawer behavior for mobile/tablet (isOverlay mode)
 *   - z-drawer (400) ensures it stays above backdrop
 */
export function AppSidebar({ collapsed, setCollapsed, open = true, isOverlay = false }: AppSidebarProps) {
    const location = useLocation()
    const currentPath = location.pathname
    const { activeProjectId } = useProjectStore()
    const [pendingApprovals, setPendingApprovals] = React.useState(0)
    // Removed useMemo cache here to avoid Rollup artifacting
    const navGroups = getSidebarGroups()

    React.useEffect(() => {
        let mounted = true
        const loadPending = async () => {
            try {
                const count = await approvalService.getPendingCount(activeProjectId)
                if (mounted) {
                    setPendingApprovals(count)
                }
            } catch {
                if (mounted) {
                    setPendingApprovals(0)
                }
            }
        }

        void loadPending()

        return () => {
            mounted = false
        }
    }, [activeProjectId, currentPath])

    return (
        <aside
            className={cn(
                "fixed inset-y-0 left-0 z-[1000] flex flex-col overflow-hidden",
                "border-r border-border-semantic-subtle",
                "bg-surface-panel shadow-2xl",
                "transition-all duration-normal ease-standard",
                // Rigid width definitions to prevent layout collapse
                isOverlay 
                    ? (open ? "translate-x-0 w-[280px]" : "-translate-x-full w-[280px]")
                    : (collapsed ? "w-[72px]" : "w-[280px]")
            )}
        >
            {/* Logo Area */}
            <div className="flex h-14 items-center gap-3 px-4 border-b border-slate-200 dark:border-slate-800 shrink-0">
                <div className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 shadow-md text-white">
                    <Hexagon size={18} />
                </div>

                {!collapsed && (
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                            MLPHoma
                        </span>
                        <span className="text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                            Construction Platform
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation - Scrollable Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4">
                {navGroups.map((group) => (
                    <div key={group.label}>
                        {/* Group Label */}
                        {!collapsed && (
                            <div className="mb-1 px-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                                    {group.label}
                                </span>
                            </div>
                        )}
                        <div className="space-y-0.5">
                            {group.items.map((item) => {
                                const isActive = currentPath === item.path
                                const Icon = ICON_MAP[item.iconKey]
                                return (
                                    <Link
                                        key={item.path}
                                        to={item.path}
                                        className={cn(
                                            "group flex items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors relative overflow-hidden",
                                            isActive
                                                ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                                                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                                        )}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-600 rounded-r-full" />
                                        )}
                                        <Icon
                                            size={16}
                                            className={cn(
                                                "flex-shrink-0",
                                                isActive ? "text-blue-600 dark:text-blue-400" : item.colorClass
                                            )}
                                        />
                                        {!collapsed && (
                                            <span className="truncate">
                                                {item.label}
                                            </span>
                                        )}
                                        {!collapsed && item.path === '/' && pendingApprovals > 0 && (
                                            <span className="ml-auto rounded-full bg-red-500 px-1.5 py-0.5 text-xs font-bold text-white leading-none">
                                                {pendingApprovals}
                                            </span>
                                        )}
                                    </Link>
                                )
                            })}
                        </div>
                    </div>
                ))}
            </div>

            {/* Footer / Collapse Toggle */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 shrink-0">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex w-full items-center justify-center gap-3 rounded-lg p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
                    {!collapsed && (
                        <span className="text-xs font-medium">Collapse</span>
                    )}
                </button>
            </div>
        </aside>
    )
}
