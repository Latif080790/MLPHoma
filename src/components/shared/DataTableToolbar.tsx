/**
 * DataTableToolbar.tsx
 * Reusable toolbar for pairing with EnterpriseDataTable.
 *
 * Features:
 * - Debounced search input (300ms) to avoid over-fetching
 * - Column visibility manager dropdown (checkboxes per column)
 * - Active filter chips: dismissible blue pills
 * - Bulk action bar: slides in from top when selectedCount > 0
 * - Extra actions slot (right side) for custom buttons
 *
 * @usage
 * <DataTableToolbar
 *   columns={columns}
 *   visibleColumns={visibleCols}
 *   onColumnVisibilityChange={toggleCol}
 *   searchValue={search}
 *   onSearchChange={setSearch}
 *   searchPlaceholder="Cari item RAB..."
 *   activeFilters={[{ label: 'Kategori: Struktur', onRemove: clearCat }]}
 *   selectedCount={selected.size}
 *   bulkActions={<Button size="sm" variant="destructive">Hapus Terpilih</Button>}
 * />
 */
import React, { useState, useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ColumnDef } from './EnterpriseDataTable'

export interface ActiveFilter {
  label: string
  onRemove: () => void
}

export interface DataTableToolbarProps<T> {
  columns: ColumnDef<T>[]
  visibleColumns: Set<string>
  onColumnVisibilityChange: (key: string, visible: boolean) => void
  /** Controlled search string */
  searchValue?: string
  /** Called with debounced value (300ms) */
  onSearchChange?: (value: string) => void
  searchPlaceholder?: string
  /** Dismissible filter chips shown below the toolbar */
  activeFilters?: ActiveFilter[]
  /** Number of selected rows — triggers bulk action bar when > 0 */
  selectedCount?: number
  /** Content shown inside the bulk action bar (Buttons, etc.) */
  bulkActions?: React.ReactNode
  /** Extra controls appended to the right of the toolbar row */
  extraActions?: React.ReactNode
  className?: string
}

export function DataTableToolbar<T>({
  columns,
  visibleColumns,
  onColumnVisibilityChange,
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Cari...',
  activeFilters = [],
  selectedCount = 0,
  bulkActions,
  extraActions,
  className,
}: DataTableToolbarProps<T>) {
  const [localSearch, setLocalSearch] = useState(searchValue)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /* Sync external value changes */
  useEffect(() => { setLocalSearch(searchValue) }, [searchValue])

  /* Debounce search changes */
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSearchChange?.(localSearch)
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [localSearch, onSearchChange])

  const clearSearch = () => {
    setLocalSearch('')
    onSearchChange?.('')
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* ── Main toolbar row ── */
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        {onSearchChange !== undefined && (
          <div className="relative flex-1 min-w-[150px] max-w-xs">
            <Search
              size={13}
              aria-hidden="true"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            />
            <Input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder={searchPlaceholder}
              className="h-8 pl-8 pr-7 text-sm"
              aria-label={searchPlaceholder}
            />
            {localSearch && (
              <button
                onClick={clearSearch}
                aria-label="Hapus pencarian"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X size={12} />
              </button>
            )}
          </div>
        )}

        {/* Column manager */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 gap-1.5">
              <SlidersHorizontal size={13} aria-hidden="true" />
              <span className="hidden sm:inline">Kolom</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Tampilkan Kolom
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {columns.map((col) => (
              <DropdownMenuCheckboxItem
                key={col.key}
                checked={visibleColumns.has(col.key)}
                onCheckedChange={(checked) =>
                  onColumnVisibilityChange(col.key, checked)
                }
                className="text-xs cursor-pointer"
              >
                {col.header}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Extra right-side actions */}
        {extraActions}
      </div>

      {/* ── Active filter chips ── */}
      {activeFilters.length > 0 && (
        <div className="flex flex-wrap gap-1.5" role="list" aria-label="Filter aktif">
          {activeFilters.map((f, i) => (
            <span
              key={i}
              role="listitem"
              className="inline-flex items-center gap-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 px-2 py-0.5 text-xs"
            >
              {f.label}
              <button
                onClick={f.onRemove}
                aria-label={`Hapus filter: ${f.label}`}
                className="hover:text-blue-900 dark:hover:text-blue-100 transition-colors"
              >
                <X size={10} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* ── Bulk action bar ── */}
      {selectedCount > 0 && (
        <div
          role="toolbar"
          aria-label="Aksi massal"
          className={cn(
            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm',
            'bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800',
            'text-blue-700 dark:text-blue-300',
            'animate-in slide-in-from-top-1 duration-150',
          )}
        >
          <span className="font-medium text-xs">
            {selectedCount} item dipilih
          </span>
          {bulkActions && (
            <div className="flex items-center gap-2 ml-1">{bulkActions}</div>
          )}
        </div>
      )}
    </div>
  )
}