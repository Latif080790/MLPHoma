/**
 * AppShell.tsx
 * Modern application shell with collapsible sidebar navigation.
 * Provides consistent layout across all pages.
 */

import React, { useState } from "react"
import { useLocation } from "react-router"
import { AppHeader } from "./AppHeader"
import {
  LayoutDashboard,
  Calculator,
  CalendarClock,
  Truck,
  Wallet,
  FileDiff,
  FolderOpen,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"

/** Navigation item definition */
interface NavItem {
  href: string
  icon: React.ReactNode
  label: string
  color: string
}

const NAV_ITEMS: NavItem[] = [
  { href: "#/", icon: <LayoutDashboard size={20} />, label: "Command Center", color: "text-blue-500" },
  { href: "#/costing", icon: <Calculator size={20} />, label: "Project Costing", color: "text-emerald-500" },
  { href: "#/schedule", icon: <CalendarClock size={20} />, label: "Schedule & Ops", color: "text-indigo-500" },
  { href: "#/supply-chain", icon: <Truck size={20} />, label: "Supply Chain", color: "text-orange-500" },
  { href: "#/finance", icon: <Wallet size={20} />, label: "Finance", color: "text-teal-500" },
  { href: "#/change-management", icon: <FileDiff size={20} />, label: "Change Mgmt", color: "text-rose-500" },
  { href: "#/documents", icon: <FolderOpen size={20} />, label: "Documents", color: "text-slate-500" },
  { href: "#/settings", icon: <Settings size={20} />, label: "Settings", color: "text-gray-500" },
]

export interface AppShellProps {
  projectName?: string
  onSearch?: (value: string) => void
  children: React.ReactNode
}

export function AppShell({ projectName, onSearch, children }: AppShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()

  // Determine active route from hash
  const currentPath = location.pathname || "/"

  return (
    <div className="flex min-h-screen bg-[hsl(var(--background))]">
      {/* Sidebar */}
      <aside
        className={`sidebar-transition fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border/40 glass ${collapsed ? "w-[68px]" : "w-[260px]"
          }`}
      >
        {/* Logo area */}
        <div className="flex h-16 items-center gap-3 border-b px-4">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm">
            CE
          </div>
          {!collapsed && (
            <div className="sidebar-label min-w-0">
              <div className="truncate text-sm font-semibold text-[hsl(var(--foreground))]">
                Estimator Pro
              </div>
              <div className="truncate text-[11px] text-[hsl(var(--muted-foreground))]">
                Construction Suite
              </div>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = currentPath === item.href.replace("#", "") ||
              (item.href === "#/" && currentPath === "/")
            return (
              <a
                key={item.href}
                href={item.href}
                title={item.label}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150 ${isActive
                  ? "bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"
                  : "text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
                  }`}
              >
                <span className={`flex-shrink-0 ${isActive ? "text-blue-600 dark:text-blue-400" : item.color}`}>
                  {item.icon}
                </span>
                {!collapsed && (
                  <span className="sidebar-label truncate">{item.label}</span>
                )}
              </a>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t p-3">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
            {!collapsed && <span className="sidebar-label">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Main content area */}
      <div
        className={`main-transition flex flex-1 flex-col ${collapsed ? "ml-[68px]" : "ml-[260px]"
          }`}
      >
        <AppHeader projectName={projectName} onSearch={onSearch} />
        <main className="flex-1 px-6 py-6">
          <div className="mx-auto w-full max-w-7xl">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
