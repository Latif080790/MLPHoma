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
    ChevronDown,
    Hexagon,
    Zap,
    BarChart3,
    Layers,
    PieChart,
    Wrench,
    ShieldCheck,
    HardHat
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
    Wrench,
    ShieldCheck,
    HardHat,
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

    // ── Group collapse state (persisted in localStorage) ─────────────────────
    const STORAGE_KEY = 'mlphoma:sidebar:collapsed-groups'
    const [collapsedGroups, setCollapsedGroups] = React.useState<Record<string, boolean>>(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY)
            if (stored) return JSON.parse(stored) as Record<string, boolean>
        } catch { /* ignore */ }
        // Default: use defaultCollapsed from registry
        return Object.fromEntries(navGroups.map((g) => [g.label, g.defaultCollapsed]))
    })

    const toggleGroup = (label: string) => {
        setCollapsedGroups((prev) => {
            const next = { ...prev, [label]: !prev[label] }
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)) } catch { /* ignore */ }
            return next
        })
    }

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
            <div className="flex h-14 items-center gap-3 px-4 border-b border-border shrink-0">
                <div
                    className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg"
                    style={{ background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)' }}
                >
                    <Hexagon size={16} color="#F97316" strokeWidth={1.5} />
                </div>

                {!collapsed && (
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-foreground truncate tracking-tight">
                            NATA LABA
                        </span>
                        <span className="text-xs tracking-widest text-nl-orange/70 font-semibold truncate uppercase">
                            Construction Suite
                        </span>
                    </div>
                )}
            </div>

            {/* Navigation - Scrollable Area */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden py-3 px-2 space-y-4">
                {navGroups.map((group) => {
                    const isGroupCollapsed = !collapsed && !!collapsedGroups[group.label]
                    const hasActiveItem = group.items.some((item) => currentPath === item.path)
                    return (
                        <div key={group.label}>
                            {/* Group Label */}
                            {!collapsed && (
                                <button
                                    onClick={() => toggleGroup(group.label)}
                                    className="w-full flex items-center justify-between mb-1 px-2 pb-1 border-b border-border/40 group/grp"
                                    aria-expanded={!isGroupCollapsed}
                                    aria-label={`${isGroupCollapsed ? 'Expand' : 'Collapse'} ${group.label}`}
                                >
                                    <span className="text-xs font-bold uppercase tracking-wider text-foreground/50 group-hover/grp:text-foreground/70 transition-colors">
                                        {group.label}
                                        {hasActiveItem && isGroupCollapsed && (
                                            <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-nl-orange align-middle" />
                                        )}
                                    </span>
                                    <ChevronDown
                                        size={11}
                                        className={`text-foreground/30 group-hover/grp:text-foreground/60 transition-transform duration-200 ${isGroupCollapsed ? '-rotate-90' : ''}`}
                                    />
                                </button>
                            )}
                            {!isGroupCollapsed && (
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
                                                        ? "bg-[rgba(249,115,22,0.1)] text-[#FB923C] dark:bg-[rgba(249,115,22,0.12)] dark:text-[#FB923C]"
                                                        : "text-foreground/65 hover:bg-accent/60 hover:text-foreground"
                                                )}
                                                title={collapsed ? item.label : undefined}
                                            >
                                                {isActive && (
                                                    <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-nl-orange rounded-r-full" />
                                                )}
                                                <Icon
                                                    size={16}
                                                    className={cn(
                                                        "flex-shrink-0",
                                                        isActive ? "text-nl-orange" : item.colorClass
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
                            )}
                        </div>
                    )
                })}
            </div>

            {/* Footer / Collapse Toggle */}
            <div className="p-3 border-t border-border shrink-0">
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="flex w-full items-center justify-center gap-3 rounded-lg p-2 text-foreground/50 hover:bg-accent/60 hover:text-foreground transition-colors"
                    aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
                >
                    {collapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
                    {!collapsed && (
                        <span className="text-xs font-medium">Ciutkan</span>
                    )}
                </button>
            </div>
        </aside>
    )
}
