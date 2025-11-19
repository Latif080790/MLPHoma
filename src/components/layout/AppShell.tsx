/**
 * AppShell.tsx
 * Provides the top-level shell with header and responsive content container.
 * Ensures consistent padding and max-width across pages.
 */

import React from "react"
import { AppHeader } from "./AppHeader"

/**
 * Props for AppShell component.
 */
export interface AppShellProps {
  /** Current project name for header context */
  projectName?: string
  /** Optional handler for header search */
  onSearch?: (value: string) => void
  /** Page content */
  children: React.ReactNode
}

/**
 * AppShell
 * Wraps application content with the AppHeader and content container.
 */
export function AppShell({ projectName, onSearch, children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100">
      <AppHeader projectName={projectName} onSearch={onSearch} />
      <main className="mx-auto w-full max-w-7xl px-4 py-6">{children}</main>
    </div>
  )
}
