/**
 * AppHeader.tsx
 * Modern glassmorphism header with project context and theme toggle.
 */

import React from "react"
import { ThemeToggle } from "../shared/ThemeToggle"
import { Bell } from "lucide-react"

export interface AppHeaderProps {
  projectName?: string
  onSearch?: (value: string) => void
}

export function AppHeader({ projectName, onSearch }: AppHeaderProps) {
  return (
    <header className="glass sticky top-0 z-30 border-b">
      <div className="flex items-center gap-4 px-6 py-3">
        {/* Breadcrumb / Page context */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-[hsl(var(--foreground))]">
            {projectName || "Dashboard"}
          </span>
          {projectName && projectName !== "Dashboard" && projectName !== "Welcome" && (
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
              Active
            </span>
          )}
        </div>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          {/* Search */}
          {onSearch && (
            <input
              type="text"
              placeholder="Search…"
              aria-label="Search"
              onChange={(e) => onSearch(e.target.value)}
              className="w-48 rounded-lg border bg-[hsl(var(--background))] px-3 py-1.5 text-sm outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--ring))] sm:w-56 transition-shadow"
            />
          )}

          {/* Notifications */}
          <button
            className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))] transition-colors"
            title="Notifications"
          >
            <Bell size={18} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-blue-500" />
          </button>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* User avatar placeholder */}
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs font-semibold text-white">
            U
          </div>
        </div>
      </div>
    </header>
  )
}

export default AppHeader
