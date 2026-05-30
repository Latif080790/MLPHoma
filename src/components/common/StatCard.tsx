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
    <div className="group relative overflow-hidden rounded-xl border bg-card p-4 shadow-sm transition-all duration-200 hover:shadow-md hover:-translate-y-px">
      <div className="flex items-center gap-3">
        <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary/15 transition-colors">
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">
            {label}
          </div>
          <div className="truncate text-xl font-semibold">{value}</div>
          {subtext ? (
            <div className="text-xs text-muted-foreground">{subtext}</div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
