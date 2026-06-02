/**
 * WBSToolbar.tsx
 * MERIDIAN toolbar for the WBS module — search, level filter, expand/collapse,
 * import/export, generate codes, and the primary "Add Root" action.
 *
 * Pure presentational: emits callbacks only, holds no store state.
 */

import { Search, ChevronsDownUp, ChevronsUpDown, Upload, Download, Hash, Plus, Lock } from 'lucide-react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

/** Level filter value — null = all levels, otherwise max depth shown */
export type WBSLevelFilter = null | 1 | 2 | 3

export interface WBSToolbarProps {
  /** Current search text */
  filterText: string
  /** Search text change */
  onFilterChange: (value: string) => void
  /** Current level (max-depth) filter */
  levelFilter: WBSLevelFilter
  /** Level filter change */
  onLevelChange: (level: WBSLevelFilter) => void
  /** Expand every node */
  onExpandAll: () => void
  /** Collapse every node */
  onCollapseAll: () => void
  /** Import structure (opens file picker upstream) */
  onImport: () => void
  /** Export structure as JSON */
  onExport: () => void
  /** Regenerate WBS codes from hierarchy */
  onGenerateCodes: () => void
  /** Add a new root item */
  onAddRoot: () => void
  /** When true, mutating actions (add/import/gen-codes) are disabled */
  locked?: boolean
  /** Compact density for embedded pipeline usage */
  compact?: boolean
}

const LEVELS: { label: string; value: WBSLevelFilter }[] = [
  { label: 'Semua Level', value: null },
  { label: 'Level 1', value: 1 },
  { label: 'Level 1–2', value: 2 },
  { label: 'Level 1–3', value: 3 },
]

/** Thin vertical divider between toolbar groups */
function Sep() {
  return <div className="h-5 w-px shrink-0 bg-slate-200 dark:bg-white/[0.07]" aria-hidden />
}

export function WBSToolbar({
  filterText,
  onFilterChange,
  levelFilter,
  onLevelChange,
  onExpandAll,
  onCollapseAll,
  onImport,
  onExport,
  onGenerateCodes,
  onAddRoot,
  locked = false,
  compact = false,
}: WBSToolbarProps) {
  const btnH = compact ? 'h-7' : 'h-8'
  const iconBtn = `${btnH} gap-1.5 text-xs px-2.5`

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-sm px-2.5 py-2 dark:border-[#1e253c] dark:bg-[#131c2e] dark:shadow-none ${compact ? '' : 'sm:px-3'}`}
    >
      {/* Search */}
      <div className="relative min-w-[150px] flex-1 sm:flex-none sm:w-56">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Cari item WBS…"
          className={`${btnH} pl-8 text-xs`}
          aria-label="Cari item WBS"
        />
      </div>

      {/* Level filter — native select keeps it dependency-light and accessible */}
      <select
        value={levelFilter === null ? 'all' : String(levelFilter)}
        onChange={(e) => onLevelChange(e.target.value === 'all' ? null : (Number(e.target.value) as WBSLevelFilter))}
        aria-label="Filter level WBS"
        className={`${btnH} rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 dark:border-[#1e253c] dark:bg-[#0e1523] dark:text-[#7a90ab] focus:outline-none`}
      >
        {LEVELS.map((l) => (
          <option key={l.label} value={l.value === null ? 'all' : String(l.value)}>
            {l.label}
          </option>
        ))}
      </select>

      <Sep />

      {/* Expand / collapse */}
      <Button variant="outline" size="sm" className={iconBtn} onClick={onExpandAll}>
        <ChevronsUpDown size={13} />
        <span className="hidden md:inline">Expand</span>
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={onCollapseAll}>
        <ChevronsDownUp size={13} />
        <span className="hidden md:inline">Collapse</span>
      </Button>

      <Sep />

      {/* Data ops */}
      <Button variant="outline" size="sm" className={iconBtn} onClick={onImport} disabled={locked}>
        <Upload size={13} />
        <span className="hidden lg:inline">Import</span>
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={onExport}>
        <Download size={13} />
        <span className="hidden lg:inline">Export</span>
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={onGenerateCodes} disabled={locked}>
        <Hash size={13} />
        <span className="hidden lg:inline">Generate Codes</span>
      </Button>

      {/* Primary action pushed to the right */}
      <div className="ml-auto">
        <Button
          size="sm"
          className={`${btnH} gap-1.5 text-xs px-3 bg-blue-600 hover:bg-blue-500 dark:bg-blue-600 dark:hover:bg-blue-500 border-0 text-white`}
          onClick={onAddRoot}
          disabled={locked}
        >
          {locked ? <Lock size={13} /> : <Plus size={13} />}
          Root Item
        </Button>
      </div>
    </div>
  )
}

export default WBSToolbar
