/**
 * RABWbsAllocationPanel.tsx
 * Drawer panel for managing WBS node links and allocation percentages for a RAB item.
 *
 * Opens as a Sheet (right drawer) from the RAB table row action button.
 * - Shows all WBS nodes linked to this RAB item
 * - Editable allocationPct per node (warns when sum ≠ 100%)
 * - "Re-balance Equally" resets to equal split
 * - Add new WBS node (searchable combobox)
 * - Delete individual links
 */

import React, { useState, useMemo, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '../ui/sheet'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Badge } from '../ui/badge'
import { ScrollArea } from '../ui/scroll-area'
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  RefreshCw,
  Trash2,
  Plus,
  X,
  Search,
} from 'lucide-react'
import { useRabWbsLinkStore } from '../../store/rabWbsLinkStore'
import { useWBSStore } from '../../store/wbsStore'
import { formatIDR } from '../../lib/utils'
import { allocatedAmount } from '../../types/rabWbsLink'
import { cn } from '../../lib/utils'

interface RABWbsAllocationPanelProps {
  projectId: string
  rabItemId: string | null
  rabItemName?: string
  rabItemTotal?: number
  open: boolean
  onClose: () => void
}

export function RABWbsAllocationPanel({
  projectId,
  rabItemId,
  rabItemName,
  rabItemTotal = 0,
  open,
  onClose,
}: RABWbsAllocationPanelProps) {
  const {
    linksByRabItem,
    addLink,
    removeLink,
    updateAllocation,
    rebalanceEqually,
  } = useRabWbsLinkStore()

  const { itemsByProject, fetchItems } = useWBSStore()
  const wbsItems = useMemo(
    () => (itemsByProject[projectId] || []).sort((a, b) => a.sortOrder - b.sortOrder),
    [itemsByProject, projectId]
  )

  // Fetch WBS items when panel opens (may not be loaded if user hasn't visited WBS page)
  useEffect(() => {
    if (open && itemsByProject[projectId] === undefined) {
      fetchItems(projectId)
    }
  }, [open, projectId, itemsByProject, fetchItems])

  // Build WBS map for orphan filtering
  const wbsMap = useMemo(() => {
    const m = new Map<string, (typeof wbsItems)[number]>()
    wbsItems.forEach((w) => m.set(w.id, w))
    return m
  }, [wbsItems])

  // Filter out orphan links (WBS items that were deleted but links remain)
  const links = useMemo(
    () => {
      const all = rabItemId ? (linksByRabItem[rabItemId] || []) : []
      return all.filter(l => wbsMap.has(l.wbsItemId))
    },
    [rabItemId, linksByRabItem, wbsMap]
  )
  const allocationSum = links.reduce((s, l) => s + l.allocationPct, 0)
  const isBalanced = Math.abs(allocationSum - 100) < 0.01 || links.length === 0

  // WBS picker state
  const [showPicker, setShowPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')

  const filteredWbsItems = useMemo(() => {
    const linkedWbsIds = new Set(links.map((l) => l.wbsItemId))
    return wbsItems.filter(
      (w) =>
        // Only show leaf nodes (not categories/parents that have children)
        !wbsItems.some(child => child.parentId === w.id) &&
        // Not already linked
        !linkedWbsIds.has(w.id) &&
        // Search filter
        (pickerSearch === '' ||
          w.name.toLowerCase().includes(pickerSearch.toLowerCase()) ||
          (w.code || '').toLowerCase().includes(pickerSearch.toLowerCase()))
    )
  }, [wbsItems, links, pickerSearch])

  // Local pct editing (draft values before blur-commit)
  const [draftPcts, setDraftPcts] = useState<Record<string, string>>({})

  function getDisplayPct(wbsItemId: string, allocationPct: number): string {
    return draftPcts[wbsItemId] !== undefined
      ? draftPcts[wbsItemId]
      : String(allocationPct)
  }

  function handlePctChange(wbsItemId: string, raw: string) {
    setDraftPcts((d) => ({ ...d, [wbsItemId]: raw }))
  }

  function handlePctBlur(wbsItemId: string) {
    if (!rabItemId) return
    const raw = draftPcts[wbsItemId]
    if (raw === undefined) return
    const parsed = parseFloat(raw)
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
      updateAllocation(rabItemId, wbsItemId, parsed)
    }
    setDraftPcts((d) => {
      const next = { ...d }
      delete next[wbsItemId]
      return next
    })
  }

  async function handleAddLink(wbsItemId: string) {
    if (!rabItemId) return
    await addLink(rabItemId, wbsItemId)
    setShowPicker(false)
    setPickerSearch('')
  }

  async function handleRemoveLink(wbsItemId: string) {
    if (!rabItemId) return
    await removeLink(rabItemId, wbsItemId)
  }

  async function handleRebalance() {
    if (!rabItemId) return
    await rebalanceEqually(rabItemId)
    setDraftPcts({})
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <SheetContent side="right" className="w-[420px] sm:w-[480px] flex flex-col p-0">
        {/* ── Header ── */}
        <SheetHeader className="px-5 py-4 border-b bg-card">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <SheetTitle className="text-sm font-bold leading-snug line-clamp-2">
                {rabItemName || 'RAB Item'}
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground mt-0.5">
                Link ke WBS node · Alokasi budget proporsional
              </SheetDescription>
            </div>
            {rabItemTotal > 0 && (
              <Badge variant="outline" className="shrink-0 text-xs font-mono bg-emerald-50 border-emerald-200 text-emerald-700">
                {formatIDR(rabItemTotal)}
              </Badge>
            )}
          </div>
        </SheetHeader>

        {/* ── Content ── */}
        <ScrollArea className="flex-1">
          <div className="px-5 py-4 space-y-3">
            {/* Allocation health indicator */}
            {links.length > 0 && (
              <div
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium',
                  isBalanced
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-amber-50 text-amber-700 border border-amber-200'
                )}
              >
                {isBalanced ? (
                  <CheckCircle2 size={13} className="shrink-0" />
                ) : (
                  <AlertTriangle size={13} className="shrink-0" />
                )}
                <span>
                  Total alokasi:{' '}
                  <strong>{allocationSum.toFixed(2)}%</strong>
                  {!isBalanced && ' — harus total 100%'}
                </span>
                {!isBalanced && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto h-6 px-2 text-xs text-amber-700 hover:bg-amber-100"
                    onClick={handleRebalance}
                  >
                    <RefreshCw size={11} className="mr-1" />
                    Re-balance
                  </Button>
                )}
              </div>
            )}

            {/* Linked nodes list */}
            {links.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center text-muted-foreground">
                <Link2 size={28} className="opacity-30" />
                <p className="text-sm font-medium">Belum ada WBS node ter-link</p>
                <p className="text-xs text-muted-foreground">
                  Klik &quot;Tambah WBS Node&quot; di bawah untuk mulai.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {links.map((link) => {
                  const wbs = wbsMap.get(link.wbsItemId)
                  const itemTotal = allocatedAmount(rabItemTotal, link.allocationPct)
                  return (
                    <div
                      key={link.wbsItemId}
                      className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5"
                    >
                      {/* WBS code badge */}
                      <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-mono font-bold text-indigo-600 border border-indigo-100">
                        {wbs?.code || '—'}
                      </span>

                      {/* WBS name */}
                      <span className="flex-1 truncate text-xs text-muted-foreground font-medium">
                        {wbs?.name || link.wbsItemId}
                      </span>

                      {/* Allocated amount */}
                      {rabItemTotal > 0 && (
                        <span className="shrink-0 text-xs font-mono text-muted-foreground">
                          {formatIDR(itemTotal)}
                        </span>
                      )}

                      {/* Pct input */}
                      <div className="shrink-0 flex items-center gap-0.5">
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          step={0.01}
                          value={getDisplayPct(link.wbsItemId, link.allocationPct)}
                          onChange={(e) => handlePctChange(link.wbsItemId, e.target.value)}
                          onBlur={() => handlePctBlur(link.wbsItemId)}
                          className="h-6 w-16 text-right text-xs font-mono border-border focus:border-blue-400"
                        />
                        <span className="text-xs text-muted-foreground">%</span>
                      </div>

                      {/* Remove */}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0 text-foreground hover:text-red-500 hover:bg-red-50"
                        onClick={() => handleRemoveLink(link.wbsItemId)}
                        title="Hapus link ini"
                      >
                        <Trash2 size={11} />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Re-balance equally (always visible if >1 link) */}
            {links.length > 1 && isBalanced && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full h-7 text-xs text-muted-foreground hover:bg-muted/30"
                onClick={handleRebalance}
              >
                <RefreshCw size={11} className="mr-1.5" />
                Re-balance rata (equal split)
              </Button>
            )}
          </div>
        </ScrollArea>

        {/* ── Footer: Add WBS picker ── */}
        <div className="border-t bg-muted/30 px-5 py-3 space-y-2">
          {showPicker ? (
            <div className="space-y-2">
              {/* Search input */}
              <div className="relative">
                <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  autoFocus
                  placeholder="Cari kode atau nama WBS…"
                  value={pickerSearch}
                  onChange={(e) => setPickerSearch(e.target.value)}
                  className="h-7 pl-7 pr-7 text-xs"
                />
                <button
                  onClick={() => { setShowPicker(false); setPickerSearch('') }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  <X size={11} />
                </button>
              </div>

              {/* WBS options */}
              <ScrollArea className="h-48 rounded-md border border-border bg-card">
                {filteredWbsItems.length === 0 ? (
                  <p className="py-6 text-center text-xs text-muted-foreground">
                    {wbsItems.length === 0
                      ? 'Belum ada WBS node. Buat dulu di modul WBS.'
                      : 'Semua WBS node sudah ter-link atau tidak ditemukan.'}
                  </p>
                ) : (
                  <div className="p-1 space-y-0.5">
                    {filteredWbsItems.map((w) => (
                      <button
                        key={w.id}
                        onClick={() => handleAddLink(w.id)}
                        className="w-full flex items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-blue-50 transition-colors"
                      >
                        <span className="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-mono font-bold text-indigo-600 border border-indigo-100">
                          {w.code || '—'}
                        </span>
                        <span className="flex-1 truncate text-muted-foreground">{w.name}</span>
                        <Plus size={11} className="shrink-0 text-foreground" />
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>
          ) : (
            <Button
              className="w-full h-8 text-xs"
              variant="outline"
              onClick={() => setShowPicker(true)}
            >
              <Plus size={13} className="mr-1.5" />
              Tambah WBS Node
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
