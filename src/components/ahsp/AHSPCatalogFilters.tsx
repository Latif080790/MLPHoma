/**
 * AHSPCatalogFilters.tsx
 * Filter + action toolbar for the AHSP catalog (search, category/zone selects,
 * export/import/add actions, sync status, and the active-zone banner).
 * Extracted from AHSPCatalog.tsx — no logic changes.
 */

import React from 'react'
import { Search, Plus, Download, Upload, X, RotateCcw, MoreHorizontal, MapPin } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { TooltipProvider } from '../ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { ZoneManager } from './ZoneManager'
import { SyncStatusBadge } from './SyncStatusBadge'
import type { Zone } from '../../types/ahsp'

export interface AHSPCatalogFiltersProps {
  /** Current search query */
  searchQuery: string
  /** Update search query */
  onSearchChange: (value: string) => void
  /** Currently selected category ('all' for no filter) */
  selectedCategory: string
  /** Update selected category */
  onCategoryChange: (value: string) => void
  /** Available categories */
  categories: string[]
  /** Currently selected zone ('default' for master) */
  selectedZone: string
  /** Update selected zone */
  onZoneChange: (value: string) => void
  /** Available zones */
  zones: Zone[]
  /** Export the full catalog (JSON) */
  onExport: () => void
  /** Export current catalog view to XLSX */
  onExportXLSX: () => void
  /** Disable XLSX export (loading / empty catalog) */
  exportXLSXDisabled: boolean
  /** Handle JSON file import */
  onImport: (event: React.ChangeEvent<HTMLInputElement>) => void
  /** Open the add-item flow */
  onAddItem: () => void
  /** Export selected items (or full catalog when none selected) */
  onExportSelected: () => void
  /** Disable "Ekspor Terpilih" (empty catalog) */
  exportSelectedDisabled: boolean
  /** Open the system reset confirmation */
  onResetClick: () => void
  /** Disable the reset action (no data) */
  resetDisabled: boolean
  /** Resolved name of the active zone (for the banner) */
  activeZoneName?: string
}

/**
 * AHSP catalog filter + action toolbar.
 */
export function AHSPCatalogFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  categories,
  selectedZone,
  onZoneChange,
  zones,
  onExport,
  onExportXLSX,
  exportXLSXDisabled,
  onImport,
  onAddItem,
  onExportSelected,
  exportSelectedDisabled,
  onResetClick,
  resetDisabled,
  activeZoneName,
}: AHSPCatalogFiltersProps) {
  return (
    <div className="sticky top-0 z-10 bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[160px] max-w-[280px] shrink">
          <Search size={10} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Cari item AHSP..."
            className="w-full h-7 pl-7 pr-6 text-xs border border-border rounded bg-muted/30 focus:outline-none focus:border-orange-400 focus:bg-card transition-colors placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground hover:text-muted-foreground"
            >
              <X size={9} />
            </button>
          )}
        </div>

        {/* Category */}
        <Select value={selectedCategory} onValueChange={onCategoryChange}>
          <SelectTrigger className="h-7 w-[152px] text-xs border-border bg-muted/30 focus:ring-0 focus:border-orange-400 rounded">
            <SelectValue placeholder="Kategori" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Semua Kategori</SelectItem>
            {categories.map(category => (
              <SelectItem key={category} value={category}>{category}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Zone */}
        <div className="flex items-center gap-1">
          <Select value={selectedZone} onValueChange={onZoneChange}>
            <SelectTrigger className={`h-7 w-[148px] text-xs focus:ring-0 rounded ${
              selectedZone !== 'default'
                ? 'border-orange-300 bg-orange-50 text-orange-700 focus:border-orange-400'
                : 'border-border bg-muted/30 focus:border-orange-400'
            }`}>
              <div className="flex items-center gap-1 min-w-0">
                <MapPin size={9} className={selectedZone !== 'default' ? 'text-orange-500 shrink-0' : 'text-foreground shrink-0'} />
                <SelectValue placeholder="Zona" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="default">Default (Master)</SelectItem>
              {zones.map(z => (
                <SelectItem key={z.id} value={z.id}>{z.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <ZoneManager />
        </div>

        {/* Separator — pushes the action group to the far right (single-row toolbar) */}
        <div className="h-4 w-px bg-muted ml-auto mx-0.5 shrink-0" />

        {/* Sync Status */}
        <TooltipProvider>
          <SyncStatusBadge />
        </TooltipProvider>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={onExport}
            title="Ekspor katalog AHSP"
            className="flex items-center gap-1 text-xs text-muted-foreground h-7 px-2.5 rounded border border-border hover:border-border hover:bg-muted/30 transition-all"
          >
            <Download size={11} />
            <span>Ekspor</span>
          </button>

          <button
            onClick={onExportXLSX}
            disabled={exportXLSXDisabled}
            title="Ekspor katalog AHSP ke Excel"
            className="flex items-center gap-1 text-xs text-muted-foreground h-7 px-2.5 rounded border border-border hover:border-border hover:bg-muted/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Download size={11} />
            <span>Ekspor XLSX</span>
          </button>

          <label className="flex items-center gap-1 text-xs text-muted-foreground h-7 px-2.5 rounded border border-border hover:border-border hover:bg-muted/30 transition-all cursor-pointer">
            <Upload size={11} />
            <span>Impor</span>
            <input type="file" accept=".json" onChange={onImport} className="hidden" />
          </label>

          <button
            onClick={onAddItem}
            className="flex items-center gap-1 text-xs bg-orange-500 text-white font-semibold h-7 px-3 rounded hover:bg-orange-600 transition-all"
          >
            <Plus size={11} />
            <span>Tambah Item</span>
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center justify-center text-muted-foreground h-7 w-7 rounded border border-border hover:border-border hover:bg-muted/30 hover:text-muted-foreground transition-all">
                <MoreHorizontal size={12} />
                <span className="sr-only">More actions</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                onClick={onExportSelected}
                disabled={exportSelectedDisabled}
              >
                <Download className="mr-2 h-3.5 w-3.5" />
                Ekspor Terpilih
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:bg-red-50 focus:text-red-700 dark:focus:bg-red-900/20"
                onClick={onResetClick}
                disabled={resetDisabled}
              >
                <RotateCcw className="mr-2 h-3.5 w-3.5" />
                Reset Sistem
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Zone active banner */}
      {selectedZone !== 'default' && (
        <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-50 border-t border-orange-100 text-xs text-orange-700">
          <MapPin size={10} className="text-orange-500 shrink-0" />
          <span>Zona: <strong>{activeZoneName ?? selectedZone}</strong> — harga zona menimpa harga master.</span>
        </div>
      )}
    </div>
  )
}
