import { useRef, useCallback } from 'react'
import type { WBSFlatRow } from '../../types/wbs'

export interface WBSMiniMapProps {
  /** All rows in the tree (including collapsed — i.e. all items flattened with depth) */
  allRows: WBSFlatRow[]
  /** Index of the first row currently visible in the virtual window */
  visibleStartIndex: number
  /** Index of the last row currently visible in the virtual window */
  visibleEndIndex: number
  /** Called when user clicks minimap — tree should scroll to this row index */
  onNavigate: (rowIndex: number) => void
}

function rowColor(row: WBSFlatRow): string {
  if (row.depth === 0) return 'hsl(var(--amber-500))'
  if (row.weightedProgress >= 80) return 'var(--wbs-progress-high)'
  if (row.weightedProgress >= 30) return 'var(--wbs-progress-mid)'
  if (row.recursiveBudget > 0) return 'var(--wbs-progress-low)'
  return 'var(--text-muted)'
}

export function WBSMiniMap({
  allRows,
  visibleStartIndex,
  visibleEndIndex,
  onNavigate,
}: WBSMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const total = allRows.length
  const BAR_HEIGHT = 3
  const MIN_INDENT = 4
  const MAX_WIDTH = 44

  const handleClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current || total === 0) return
    const rect = containerRef.current.getBoundingClientRect()
    const y = e.clientY - rect.top
    const fraction = y / rect.height
    const rowIndex = Math.floor(fraction * total)
    onNavigate(Math.max(0, Math.min(total - 1, rowIndex)))
  }, [total, onNavigate])

  const vpTop = total > 0 ? (visibleStartIndex / total) * 100 : 0
  const vpHeight = total > 0 ? ((visibleEndIndex - visibleStartIndex + 1) / total) * 100 : 100

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      className="w-[64px] shrink-0 border-r border-[var(--border-default)] bg-[var(--bg-page)] cursor-pointer overflow-hidden relative select-none"
      title="Mini-map — klik untuk navigasi"
    >
      <div className="px-[3px] py-[5px] flex flex-col gap-[1px]">
        {allRows.map((row, i) => {
          const indentFraction = Math.min(row.depth, 4) / 4
          const width = MAX_WIDTH - indentFraction * (MAX_WIDTH - MIN_INDENT)
          const marginLeft = indentFraction * MIN_INDENT
          return (
            <div
              key={i}
              style={{
                height: BAR_HEIGHT,
                width,
                marginLeft,
                background: rowColor(row),
                borderRadius: 1,
                opacity: 0.7,
              }}
            />
          )
        })}
      </div>

      {/* Viewport indicator */}
      <div
        className="pointer-events-none absolute left-[3px] right-[3px]"
        style={{
          top: `${vpTop}%`,
          height: `${Math.max(vpHeight, 3)}%`,
          border: '1px solid rgba(251,146,60,0.6)',
          background: 'rgba(249,115,22,0.04)',
          borderRadius: 2,
        }}
      />
    </div>
  )
}
