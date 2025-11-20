/**
 * ModuleHeader.tsx
 * Consistent header for each module page with icon, title, description, and right-aligned actions.
 */

import React from "react"
import { ArrowLeft } from "lucide-react"

/**
 * Props for ModuleHeader
 */
export interface ModuleHeaderProps {
  /** Leading icon for the module */
  icon?: React.ReactNode
  /** Module title */
  title: string
  /** Short description */
  description?: string
  /** Right side actions (buttons, etc.) */
  actions?: React.ReactNode
  /** Optional back link URL (defaults to #/) */
  backUrl?: string
  /** Whether to show back button (default: true) */
  showBackButton?: boolean
}

/**
 * ModuleHeader
 * Simple, accessible header bar for modules.
 */
export function ModuleHeader({ icon, title, description, actions, backUrl = "#/", showBackButton = true }: ModuleHeaderProps) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-white p-4 shadow-sm dark:border-neutral-800 dark:bg-neutral-900 md:flex-row md:items-center md:justify-between">
      <div className="flex items-start gap-3">
        {showBackButton && (
          <a
            href={backUrl}
            className="mt-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
            title="Go Back"
          >
            <ArrowLeft size={20} />
          </a>
        )}
        {icon ? (
          <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
            {icon}
          </div>
        ) : null}
        <div>
          <div className="text-base font-semibold">{title}</div>
          {description ? (
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
          ) : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  )
}

export default ModuleHeader
