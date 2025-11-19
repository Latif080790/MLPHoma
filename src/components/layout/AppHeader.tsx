/**
 * AppHeader.tsx
 * Application top header with brand, active project context, search input, and theme toggle.
 * Keep it lightweight (Tailwind only), no external UI deps.
 */

import React from "react"
import { ThemeToggle } from "../shared/ThemeToggle"

/**
 * Props for AppHeader component.
 */
export interface AppHeaderProps {
  /** Current project name (context info) */
  projectName?: string
  /** Optional search handler shown when provided */
  onSearch?: (value: string) => void
}

/**
 * AppHeader
 * Renders app brand + project context + optional search + theme toggle.
 */
export function AppHeader({ projectName, onSearch }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b bg-white/80 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/80">
      <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
        {/* Brand */}
        <div
          className="select-none whitespace-nowrap text-sm font-semibold tracking-wide"
          title="Construction Estimator Pro"
        >
          Construction Estimator Pro
        </div>

        {/* Divider */}
        <span className="h-5 w-px bg-neutral-200 dark:bg-neutral-800" aria-hidden />

        {/* Project context */}
        <div className="min-w-0 truncate text-sm text-neutral-600 dark:text-neutral-400">
          {projectName ? `Project: ${projectName}` : "—"}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Optional search */}
          {onSearch ? (
            <div className="relative">
              <input
                type="text"
                placeholder="Search…"
                aria-label="Search"
                onChange={(e) => onSearch?.(e.target.value)}
                className="w-48 rounded-md border bg-white px-3 py-1.5 text-sm outline-none ring-0 placeholder:text-neutral-400 hover:border-neutral-300 focus:border-blue-500 dark:border-neutral-700 dark:bg-neutral-900 sm:w-64"
              />
            </div>
          ) : null}

          {/* Theme toggle */}
          <ThemeToggle />
        </div>
      </div>
    </header>
  )
}

export default AppHeader
