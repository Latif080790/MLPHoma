/**
 * ModuleCard.tsx
 * Card to represent a core application module with icon, title, description, and actions.
 * Ensures consistent appearance and accessibility across all module entrances.
 */

import React from "react"

export interface ModuleCardProps {
  /** Icon element */
  icon: React.ReactNode
  /** Module title */
  title: string
  /** Short description */
  description: string
  /** Called when primary action is invoked */
  onOpen?: () => void
  /** Optional extra action */
  onDocs?: () => void
}

/**
 * ModuleCard
 * Displays module info with buttons to open or view docs.
 */
export function ModuleCard({ icon, title, description, onOpen, onDocs }: ModuleCardProps) {
  return (
    <div className="flex h-full flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-3 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
        {icon}
      </div>
      <div className="mb-1 text-base font-semibold">{title}</div>
      <p className="mb-4 line-clamp-3 text-sm text-neutral-600 dark:text-neutral-400">
        {description}
      </p>
      <div className="mt-auto flex items-center gap-2">
        <button
          onClick={onOpen}
          className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
        >
          Open
        </button>
        <button
          onClick={onDocs}
          className="inline-flex items-center justify-center rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
        >
          Docs
        </button>
      </div>
    </div>
  )
}
