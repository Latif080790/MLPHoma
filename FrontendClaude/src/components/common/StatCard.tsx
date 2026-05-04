/**
 * StatCard.tsx
 * Visual card for small KPI metrics with icon, label, and value.
 * Used in dashboards to highlight key figures.
 */

import React from "react"

export interface StatCardProps {
  /** Icon element displayed on the left */
  icon: React.ReactNode
  /** Label of the metric */
  label: string
  /** Display value */
  value: string
  /** Optional subtext or trend info */
  subtext?: string
}

/**
 * StatCard
 * Renders a small metric card with clear contrast and hover feedback.
 */
export function StatCard({ icon, label, value, subtext }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700 group-hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {label}
          </div>
          <div className="truncate text-xl font-semibold">{value}</div>
          {subtext ? (
            <div className="text-xs text-neutral-500 dark:text-neutral-400">{subtext}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
