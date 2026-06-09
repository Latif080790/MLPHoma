import type { WBSFlatRow } from '../../types/wbs'
import { formatIDR } from '../../lib/utils'
import { CheckCircle2 } from 'lucide-react'

export interface WBSTableViewProps {
  rows: WBSFlatRow[]
  timelineCountByWbs: Map<string, number>
  rabCountByWbs: Map<string, number>
}

function progressColor(p: number): string {
  if (p >= 80) return 'var(--wbs-progress-high)'
  if (p >= 30) return 'var(--wbs-progress-mid)'
  return 'var(--wbs-progress-low)'
}

export function WBSTableView({ rows, timelineCountByWbs, rabCountByWbs }: WBSTableViewProps) {
  if (rows.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-[var(--text-secondary)]">
        Belum ada data WBS.
      </div>
    )
  }

  return (
    <div className="overflow-auto w-full h-full">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-surface)' }}>
          <tr>
            <th className="text-left py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] w-[40%]" style={{ borderBottom: '1px solid var(--border-default)' }}>WBS</th>
            <th className="text-right py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]" style={{ borderBottom: '1px solid var(--border-default)' }}>Budget</th>
            <th className="text-center py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)] w-[80px]" style={{ borderBottom: '1px solid var(--border-default)' }}>Progress</th>
            <th className="text-center py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]" style={{ borderBottom: '1px solid var(--border-default)' }}>QC</th>
            <th className="text-center py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]" style={{ borderBottom: '1px solid var(--border-default)' }}>RAB</th>
            <th className="text-center py-2 px-3 text-[8px] font-bold uppercase tracking-wider text-[var(--text-muted)]" style={{ borderBottom: '1px solid var(--border-default)' }}>Timeline</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const item = row.item
            const p = row.weightedProgress
            const qcPassed = item.qc_status === 'PASSED'
            return (
              <tr
                key={item.id}
                className="transition-colors hover:bg-[var(--bg-surface-hover)]"
                style={{ borderBottom: '1px solid var(--bg-page)' }}
              >
                {/* WBS name */}
                <td className="py-1.5 px-3" style={{ paddingLeft: row.depth * 14 + 12 }}>
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="shrink-0 font-mono text-[7px] font-bold px-1 rounded py-0.5"
                      style={{ color: 'hsl(var(--cobalt-400))', background: 'hsl(var(--cobalt-400) / 0.08)' }}
                    >
                      {item.code}
                    </span>
                    <span
                      className="truncate"
                      style={{
                        fontWeight: row.depth === 0 ? 700 : 400,
                        color: row.depth === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                </td>
                {/* Budget */}
                <td className="py-1.5 px-3 text-right font-mono whitespace-nowrap text-[var(--text-idr)]">
                  {row.recursiveBudget > 0
                    ? <>
                        {formatIDR(row.recursiveBudget)}
                        {row.hasChildren && <span className="text-[var(--text-muted)] ml-0.5">↕</span>}
                      </>
                    : <span className="text-[var(--text-muted)]">—</span>}
                </td>
                {/* Progress */}
                <td className="py-1.5 px-3">
                  <div className="flex items-center gap-1.5 justify-center">
                    <div className="w-16 h-[3px] rounded overflow-hidden bg-[var(--border-default)]">
                      <div
                        className="h-full rounded"
                        style={{ width: `${Math.min(100, p)}%`, background: progressColor(p) }}
                      />
                    </div>
                    <span className="font-mono text-[8px]" style={{ color: progressColor(p) }}>
                      {p}%
                    </span>
                  </div>
                </td>
                {/* QC */}
                <td className="py-1.5 px-3 text-center">
                  {qcPassed
                    ? <CheckCircle2 size={11} className="mx-auto" style={{ color: 'var(--wbs-progress-high)' }} />
                    : <span className="text-[var(--text-muted)]">—</span>}
                </td>
                {/* RAB count */}
                <td className="py-1.5 px-3 text-center font-mono text-[var(--text-secondary)]">
                  {rabCountByWbs.get(item.id) ?? 0}
                </td>
                {/* Timeline count */}
                <td className="py-1.5 px-3 text-center font-mono text-[var(--text-secondary)]">
                  {timelineCountByWbs.get(item.id) ?? 0}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
