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
}

export function AppSidebar({ collapsed, setCollapsed }: AppSidebarProps) {
    const location = useLocation()
    const currentPath = location.pathname
    const { activeProjectId } = useProjectStore()
    const [pendingApprovals, setPendingApprovals] = React.useState(0)
    const navGroups = React.useMemo(() => getSidebarGroups(), [])

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
                "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-slate-200/50 dark:border-slate-800/50 bg-white/80 dark:bg-slate-950/80 backdrop-blur-xl transition-all duration-300 ease-in-out shadow-sm",
                collapsed ? "w-[72px]" : "w-[280px]"
            )}
        >
            {/* Logo Area - Glass Header */}
            <div className="flex h-16 items-center gap-3 px-4 border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/20 text-white">
                    <Hexagon size={24} className="animate-pulse-slow" />
                    <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/20"></div>
                </div>

                <div className={cn(
                    "flex flex-col overflow-hidden transition-all duration-300",
                    collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                )}>
                    <span className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        Estimator Pro
                    </span>
                    <span className="text-xs uppercase tracking-wider text-slate-500 font-semibold">
                        Engineering Grade
                    </span>
                </div>
            </div>

            {/* Navigation - Scrollable Area */}
            <div className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                {navGroups.map((group) => (
                    <div key={group.label}>
                        {/* Group Label */}
                        {!collapsed && (
                            <div className="mb-1 px-2 pb-1 border-b border-slate-100 dark:border-slate-800">
                                <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-600">
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
                                            "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 relative overflow-hidden",
                                            isActive
                                                ? "bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800"
                                                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                                        )}
                                        title={collapsed ? item.label : undefined}
                                    >
                                        {isActive && (
                                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-blue-500 rounded-r-full shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                                        )}
                                        <Icon
                                            size={18}
                                            className={cn(
                                                "flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                                                isActive ? "text-blue-600 dark:text-blue-400" : item.colorClass
                                            )}
                                        />
                                        <span className={cn(
                                            "truncate transition-all duration-300",
                                            collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                                        )}>
                                            {item.label}
                                        </span>
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

            {/* Footer / User Profile Stub */}
            <div className="p-3 border-t border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex w-full items-center justify-center gap-3 rounded-lg p-2 text-slate-500 hover:bg-slate-200/50 dark:hover:bg-slate-800/50 transition-colors"
                >
                    {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
            </div>
        </aside>
    )
}
