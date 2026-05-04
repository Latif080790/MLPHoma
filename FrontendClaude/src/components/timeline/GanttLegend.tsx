/**
 * GanttLegend.tsx
 * Small reusable legend for the Gantt chart.
 *
 * - Compact mode renders smaller labels suitable for mobile.
 * - Palette can be overridden via props for branding.
 */

import React from 'react'

/**
 * Props for GanttLegend
 */
export interface GanttLegendProps {
  compact?: boolean
  palette?: { primary?: string; critical?: string; progress?: string }
}

/**
 * GanttLegend
 * Visual legend with chips for Critical, Task, Progress and Today markers.
 */
export default function GanttLegend({ compact = false, palette }: GanttLegendProps) {
  const p = {
    primary: palette?.primary ?? '#0ea5a4',
    critical: palette?.critical ?? '#ef4444',
    progress: palette?.progress ?? '#16a34a',
  }

  return (
    <div className={`flex items-center gap-3 ${compact ? 'text-xs' : 'text-sm'}`} aria-hidden>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded" style={{ background: p.critical, boxShadow: '0 2px 6px rgba(239,68,68,0.14)' }} />
        <span className="text-neutral-600">Critical</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded" style={{ background: p.primary, boxShadow: '0 2px 6px rgba(14,165,164,0.12)' }} />
        <span className="text-neutral-600">Task</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded" style={{ background: p.progress, boxShadow: '0 2px 6px rgba(16,185,129,0.12)' }} />
        <span className="text-neutral-600">Progress</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 rounded bg-red-600" />
        <span className="text-neutral-600">Today</span>
      </div>
    </div>
  )
}