// src/components/wbs/WBSToolbar.tsx
import { Search, ChevronsDownUp, ChevronsUpDown, Plus, Lock, Wrench, List } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

export type WBSLevelFilter = null | 1 | 2 | 3

export interface WBSToolbarProps {
  filterText: string
  onFilterChange: (value: string) => void
  levelFilter: WBSLevelFilter
  onLevelChange: (level: WBSLevelFilter) => void
  onExpandAll: () => void
  onCollapseAll: () => void
  onImport: () => void
  onExport: () => void
  onGenerateCodes: () => void
  onAddRoot: () => void
  onBulkPaste: () => void
  viewMode: 'tree' | 'table'
  onViewModeChange: (mode: 'tree' | 'table') => void
  locked?: boolean
  compact?: boolean
}

const LEVELS: { label: string; value: WBSLevelFilter }[] = [
  { label: 'Semua Level', value: null },
  { label: 'Level 1', value: 1 },
  { label: 'Level 1–2', value: 2 },
  { label: 'Level 1–3', value: 3 },
]

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
  onBulkPaste,
  viewMode,
  onViewModeChange,
  locked = false,
  compact = false,
}: WBSToolbarProps) {
  const btnH = compact ? 'h-7' : 'h-8'
  const iconBtn = `${btnH} gap-1.5 text-xs px-2.5`

  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 bg-white shadow-sm px-2.5 py-2 dark:border-[var(--border-default)] dark:bg-[var(--bg-surface)] dark:shadow-none ${compact ? '' : 'sm:px-3'}`}>
      {/* ── Nav-left group ── */}
      <div className="relative min-w-[130px] sm:w-44">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <Input
          value={filterText}
          onChange={(e) => onFilterChange(e.target.value)}
          placeholder="Cari item WBS…"
          className={`${btnH} pl-8 text-xs`}
          aria-label="Cari item WBS"
        />
      </div>

      <select
        value={levelFilter === null ? 'all' : String(levelFilter)}
        onChange={(e) => onLevelChange(e.target.value === 'all' ? null : (Number(e.target.value) as WBSLevelFilter))}
        aria-label="Filter level WBS"
        className={`${btnH} rounded-md border border-slate-200 bg-slate-50 px-2 text-xs font-medium text-slate-700 dark:border-[var(--border-default)] dark:bg-[var(--bg-page)] dark:text-[var(--text-secondary)] focus:outline-none`}
      >
        {LEVELS.map((l) => (
          <option key={l.label} value={l.value === null ? 'all' : String(l.value)}>
            {l.label}
          </option>
        ))}
      </select>

      <Button variant="outline" size="sm" className={iconBtn} onClick={onExpandAll}>
        <ChevronsUpDown size={13} />
        <span className="hidden md:inline">Expand</span>
      </Button>
      <Button variant="outline" size="sm" className={iconBtn} onClick={onCollapseAll}>
        <ChevronsDownUp size={13} />
        <span className="hidden md:inline">Collapse</span>
      </Button>

      {/* ── Actions-right group ── */}
      <div className="ml-auto flex items-center gap-2">
        <Sep />

        {/* Tools dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className={`${iconBtn}`} disabled={locked}>
              <Wrench size={13} />
              <span className="hidden sm:inline">Tools</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem onClick={onBulkPaste} disabled={locked}>
              Buat Massal…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onImport} disabled={locked}>
              Import JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onExport}>
              Export JSON
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onGenerateCodes} disabled={locked}>
              Generate Kode
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Primary action */}
        <Button
          size="sm"
          className={`${btnH} gap-1.5 text-xs px-3 bg-[hsl(var(--amber-500))] hover:bg-[hsl(var(--amber-600))] border-0 text-white`}
          onClick={onAddRoot}
          disabled={locked}
        >
          {locked ? <Lock size={13} /> : <Plus size={13} />}
          <span className="hidden sm:inline">Root Item</span>
        </Button>

        <Sep />

        {/* Tree / Table toggle */}
        <div className="flex rounded-md border border-slate-200 dark:border-[var(--border-default)] overflow-hidden">
          <button
            onClick={() => onViewModeChange('tree')}
            className={`${btnH} px-2.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              viewMode === 'tree'
                ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)]'
                : 'bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            🌳 Tree
          </button>
          <button
            onClick={() => onViewModeChange('table')}
            className={`${btnH} px-2.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              viewMode === 'table'
                ? 'bg-[var(--bg-surface-hover)] text-[var(--text-primary)]'
                : 'bg-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <List size={12} /> Tabel
          </button>
        </div>
      </div>
    </div>
  )
}

export default WBSToolbar
