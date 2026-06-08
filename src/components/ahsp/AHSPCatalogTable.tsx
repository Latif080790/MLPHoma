/**
 * AHSPCatalogTable.tsx
 * Main data table for the AHSP catalog: virtualized DataTable with grouped
 * section rows, the floating bulk-action bar, and the footer totals row.
 * Extracted from AHSPCatalog.tsx — no logic changes.
 */

import React from 'react'
import { Trash2, Download, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '../ui/button'
import { TableCell, TableRow } from '../ui/table'
import { formatIDR } from '../../lib/utils'
import type { AHSPItem, AHSPStatus } from '../../types/ahsp'
import { DataTable } from '../shared/DataTable'
import { getAHSPColumns } from './AHSPColumns'
import { useAHSPStore } from '../../store/ahspStore'

/** Grouped row shape produced by the catalog (section header or item row). */
type GroupedDisplayRow =
  | { type: 'section'; label: string }
  | { type: 'item'; item: AHSPItem; rowNumber: number }

export interface AHSPCatalogTableProps {
  /** Whether AHSP items are currently loading */
  loading: boolean
  /** Items currently displayed (after filter + zone overrides) */
  displayItems: AHSPItem[]
  /** Grouped rows (section headers + items) feeding the table */
  groupedDisplayRows: GroupedDisplayRow[]
  /** Ref applied to the scroll container (used for scroll-to-top on filter change) */
  parentRef: React.RefObject<HTMLDivElement>
  /** Whether a non-default zone override is active */
  hasZoneOverride: boolean
  /** RAB usage count per AHSP item */
  ahspUsageMap: Map<string, number>
  /** Toggle derived bid price display (read-only) */
  showBidPrice: boolean
  /** Default project margin percentage for derived bid price */
  bidMarginPct: number
  /** Compact (embedded) view — reserves more height for surrounding chrome */
  compact: boolean
  /** Currently selected item ids */
  selectedIds: Set<string>
  /** Replace the full selection set */
  onSelectedIdsChange: (ids: Set<string>) => void
  /** Footer totals breakdown */
  totals: {
    materialTotal: number
    laborTotal: number
    equipmentTotal: number
    subconTotal: number
    unallocatedTotal: number
    grandTotal: number
  }
  /** Edit an item (opens the appropriate editor) */
  onEditItem: (item: AHSPItem) => void
  /** Open price history for an item */
  onHistoryClick: (item: AHSPItem) => void
  /** Delete a single item */
  onDeleteItem: (item: AHSPItem) => void
  /** Open the add-item flow (empty state) */
  onAddItem: () => void
  /** Trigger bulk delete of the current selection */
  onBulkDelete: () => void
  /** Export the given items */
  onExport: (itemsToExport?: AHSPItem[]) => void
}

/**
 * AHSP catalog main table + bulk action bar + totals footer.
 */
export function AHSPCatalogTable({
  loading,
  displayItems,
  groupedDisplayRows,
  parentRef,
  hasZoneOverride,
  ahspUsageMap,
  showBidPrice,
  bidMarginPct,
  compact,
  selectedIds,
  onSelectedIdsChange,
  totals,
  onEditItem,
  onHistoryClick,
  onDeleteItem,
  onAddItem,
  onBulkDelete,
  onExport,
}: AHSPCatalogTableProps) {
  const updateAHSPItemStatus = useAHSPStore(state => state.updateAHSPItemStatus)

  return (
    <div className="hidden rounded-lg border border-border overflow-hidden shadow-sm bg-card md:block">
      <div
        ref={parentRef}
        className="relative"
      >
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : displayItems.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="text-sm">Belum ada item AHSP.</p>
            <Button variant="link" onClick={onAddItem} className="mt-2 text-blue-600">Buat item baru</Button>
          </div>
        ) : (
          <DataTable
            columns={getAHSPColumns({
              onEditItem,
              onHistoryClick,
              onDeleteItem,
              hasZoneOverride,
              ahspUsageMap,
              showBidPrice,
              bidMarginPct,
              onStatusChange: (id: string, status: AHSPStatus) => updateAHSPItemStatus(id, status),
            })}
            data={groupedDisplayRows.map(r => r.type === 'section' ? r : r.item)}
            virtualized={true}
            // Embedded (compact) view has extra chrome above (pipeline tabs + budget
            // strip), so reserve more height there to keep the last rows reachable.
            maxHeight={compact ? 'calc(100vh - 420px)' : 'calc(100vh - 280px)'}
            enableRowSelection={true}
            rowSelection={Object.fromEntries(Array.from(selectedIds).map(id => [id, true]))}
            onRowSelectionChange={(updater) => {
              const newSelection = typeof updater === 'function' ? updater(Object.fromEntries(Array.from(selectedIds).map(id => [id, true]))) : updater;
              const newIds = new Set<string>();
              for (const key in newSelection) {
                 if (newSelection[key]) newIds.add(key);
              }
              onSelectedIdsChange(newIds);
            }}
            getRowId={(row: any) => row.id || `section-${row.label}`}
            isCustomRow={(row: any) => row.type === 'section'}
            renderCustomRow={(row: any) => (
              <TableRow
                key={`section-${row.label}`}
                className="bg-muted/30 hover:bg-accent/40"
              >
                <TableCell colSpan={10} className="py-2 px-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {row.label}
                </TableCell>
              </TableRow>
            )}
          />
        )}
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="bg-background text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-6 border border-border ring-4 ring-slate-900/10 backdrop-blur-md">
            <div className="flex items-center gap-3 pr-6 border-r border-border">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-sm font-bold tracking-tight">
                <span className="text-primary pr-1">{selectedIds.size}</span> Item Dipilih
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                className="text-foreground hover:text-white hover:bg-muted gap-2 h-9 px-4 font-semibold text-xs"
                onClick={() => onSelectedIdsChange(new Set())}
              >
                <X className="h-3.5 w-3.5" />
                Bersihkan
              </Button>

              <Button
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white gap-2 h-9 px-4 font-bold text-xs shadow-lg shadow-red-900/20"
                onClick={onBulkDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
                Hapus Terpilih
              </Button>

              <Button
                size="sm"
                className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2 h-9 px-4 font-bold text-xs shadow-lg shadow-blue-900/20"
                onClick={() => {
                  onExport(displayItems.filter(i => selectedIds.has(i.id)))
                  toast.success('Mengekspor item terpilih...')
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Ekspor
              </Button>
            </div>
          </div>
        </div>
      )}

      {!loading && displayItems.length > 0 && (
        <div className="border-t border-border bg-white/80 backdrop-blur-sm px-6 py-4 sticky bottom-0 z-30 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-6 items-center">
            <div className="md:col-span-1">
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Material</div>
              <div className="font-mono text-xs font-bold text-primary">{formatIDR(totals.materialTotal)}</div>
            </div>
            <div className="md:col-span-1">
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Labor</div>
              <div className="font-mono text-xs font-bold text-orange-700">{formatIDR(totals.laborTotal)}</div>
            </div>
            <div className="md:col-span-1">
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Equipment</div>
              <div className="font-mono text-xs font-bold text-indigo-700">{formatIDR(totals.equipmentTotal)}</div>
            </div>
            <div className="md:col-span-1">
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Subcon</div>
              <div className="font-mono text-xs font-bold text-purple-700">{formatIDR(totals.subconTotal)}</div>
            </div>
            {totals.unallocatedTotal > 0 && (
              <div className="md:col-span-1">
                <div className="text-xs uppercase font-bold tracking-widest text-red-400 mb-1">Belum Teralokasi</div>
                <div className="font-mono text-xs font-bold text-red-600">{formatIDR(totals.unallocatedTotal)}</div>
              </div>
            )}
            <div className={totals.unallocatedTotal > 0 ? "md:col-span-1 text-right" : "md:col-span-2 text-right"}>
              <div className="text-xs uppercase font-bold tracking-widest text-muted-foreground mb-1">Grand Total Katalog</div>
              <div className="font-mono text-lg font-black text-foreground tabular-nums">
                {formatIDR(totals.grandTotal)}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
