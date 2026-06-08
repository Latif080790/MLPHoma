import { formatIDR } from '../../lib/utils'
import type { KPIFilter } from '../../types/wbs'

export interface WBSKPIStripProps {
  totalItems: number
  totalBudget: number
  projectWeightedProgress: number
  qcPassed: number
  rabUnlinked: number
  timelineLinked: number
  activeFilter: KPIFilter
  onFilterChange: (filter: KPIFilter) => void
}

interface Cell {
  id: KPIFilter
  label: string
  value: string | number
  valueColor: string
  subtitle?: string
}

export function WBSKPIStrip({
  totalItems,
  totalBudget,
  projectWeightedProgress,
  qcPassed,
  rabUnlinked,
  timelineLinked,
  activeFilter,
  onFilterChange,
}: WBSKPIStripProps) {
  const cells: Cell[] = [
    { id: null, label: 'Total Item', value: totalItems, valueColor: 'hsl(var(--cobalt-400))' },
    { id: null, label: 'Budget RAB ↕', value: formatIDR(totalBudget), valueColor: 'var(--text-idr)' },
    {
      id: null,
      label: 'Progress',
      value: `${Math.round(projectWeightedProgress)}%`,
      valueColor: 'var(--wbs-progress-mid)',
      subtitle: 'Σ(p×b)/Σb',
    },
    { id: 'qc-passed', label: 'QC Passed', value: qcPassed, valueColor: 'var(--wbs-progress-high)' },
    { id: 'rab-unlinked', label: 'RAB Unlinked', value: rabUnlinked, valueColor: 'var(--wbs-progress-low)' },
    { id: 'timeline-linked', label: 'Timeline Linked', value: timelineLinked, valueColor: 'var(--text-secondary)' },
  ]

  return (
    <div className="flex shrink-0 border-b border-[var(--border-default)] bg-[var(--bg-page)]">
      {cells.map((cell, i) => {
        const isFilterable = cell.id !== null
        const isActive = isFilterable && activeFilter === cell.id
        return (
          <button
            key={i}
            onClick={() => isFilterable && onFilterChange(cell.id)}
            disabled={!isFilterable}
            className={[
              'flex-1 px-2.5 py-1.5 text-left border-r border-[var(--border-default)] last:border-r-0 transition-colors',
              isFilterable ? 'cursor-pointer hover:bg-[var(--bg-surface-hover)]' : 'cursor-default',
              isActive ? 'bg-[var(--bg-surface-hover)] border-b-2 border-b-[hsl(var(--amber-500))]' : '',
            ].join(' ')}
          >
            <div className="flex items-center gap-1 mb-0.5">
              {isActive && (
                <span className="text-[7px] leading-none" style={{ color: 'hsl(var(--amber-500))' }}>●</span>
              )}
              <span className="text-[7px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                {cell.label}
              </span>
            </div>
            <div
              className="text-xs font-bold font-mono leading-none"
              style={{ color: cell.valueColor }}
            >
              {cell.value}
            </div>
            {cell.subtitle && (
              <div className="text-[6px] text-[var(--text-muted)] mt-0.5">{cell.subtitle}</div>
            )}
          </button>
        )
      })}
    </div>
  )
}
