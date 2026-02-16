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
    Hexagon
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface NavItem {
    href: string
    icon: React.ElementType
    label: string
    color: string
}

const NAV_ITEMS: NavItem[] = [
    { href: '/', icon: LayoutDashboard, label: 'Command Center', color: 'text-blue-500' },
    { href: '/projects', icon: FolderKanban, label: 'Projects', color: 'text-yellow-600' },
    { href: '/project-overview', icon: ClipboardList, label: 'Project Overview', color: 'text-sky-500' },
    { href: '/costing', icon: Calculator, label: 'Project Costing', color: 'text-emerald-500' },
    { href: '/schedule', icon: CalendarClock, label: 'Operation & Sch', color: 'text-indigo-500' },
    { href: '/supply-chain', icon: Truck, label: 'Supply Chain', color: 'text-orange-500' },
    { href: '/finance', icon: Wallet, label: 'Finance', color: 'text-teal-500' },
    { href: '/change-management', icon: FileDiff, label: 'Change Mgmt', color: 'text-rose-500' },
    { href: '/documents', icon: FolderOpen, label: 'Document', color: 'text-slate-500' },
    { href: '/handover', icon: ClipboardCheck, label: 'Handover', color: 'text-violet-500' },
    { href: '/tkdn', icon: Flag, label: 'TKDN', color: 'text-green-600' },
    { href: '/features', icon: Sliders, label: 'Feature Config', color: 'text-purple-500' },
    { href: '/settings', icon: Settings, label: 'Settings', color: 'text-gray-500' },
]

interface AppSidebarProps {
    collapsed: boolean
    setCollapsed: (v: boolean) => void
}

export function AppSidebar({ collapsed, setCollapsed }: AppSidebarProps) {
    const location = useLocation()
    const currentPath = location.pathname

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
                    <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">
                        Engineering Grade
                    </span>
                </div>
            </div>

            {/* Navigation - Scrollable Area */}
            <div className="flex-1 overflow-y-auto py-4 px-3 space-y-1 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-800">
                {NAV_ITEMS.map((item) => {
                    const isActive = currentPath === item.href

                    return (
                        <Link
                            key={item.href}
                            to={item.href}
                            className={cn(
                                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 relative overflow-hidden",
                                isActive
                                    ? "bg-blue-50/80 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 shadow-sm ring-1 ring-blue-100 dark:ring-blue-800"
                                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200"
                            )}
                            title={collapsed ? item.label : undefined}
                        >
                            {/* Active Indicator Bar */}
                            {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                            )}

                            <item.icon
                                size={20}
                                className={cn(
                                    "flex-shrink-0 transition-transform duration-200 group-hover:scale-110",
                                    isActive ? "text-blue-600 dark:text-blue-400" : item.color
                                )}
                            />

                            <span className={cn(
                                "truncate transition-all duration-300",
                                collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
                            )}>
                                {item.label}
                            </span>
                        </Link>
                    )
                })}
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
