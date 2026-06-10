import { useRef, useCallback, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, MoreHorizontal, CheckCircle2 } from 'lucide-react'
import { formatIDR } from '../../lib/utils'
import type { WBSFlatRow, WBSItem, KPIFilter } from '../../types/wbs'

const ROW_HEIGHT = 28

function progressColor(p: number): string {
  if (p >= 80) return 'var(--wbs-progress-high)'
  if (p >= 30) return 'var(--wbs-progress-mid)'
  return 'var(--wbs-progress-low)'
}

type DropMode = 'before' | 'after' | 'inside'
interface DropTarget { id: string; mode: DropMode }

export interface WBSVirtualTreeHandle {
  scrollToIndex: (index: number) => void
}

export interface WBSVirtualTreeProps {
  rows: WBSFlatRow[]
  selectedId: string | null
  flashId: string | null
  onSelect: (item: WBSItem) => void
  onToggleExpand: (id: string) => void
  onAddChild: (parentId: string | null) => void
  onEdit: (item: WBSItem) => void
  onDelete: (item: WBSItem) => void
  onMoveItem: (itemId: string, newParentId: string | null, index: number) => void
  onVisibleRangeChange: (start: number, end: number) => void
  onUndo: () => void
  rabCountByWbs: Map<string, number>
  onGenerateCodes?: () => void
  activeFilter: KPIFilter
  timelineCountByWbs: Map<string, number>
  showSetupChecklist?: boolean
  onUpdateProgress?: (id: string, progress: number) => void
  onBulkUpdateProgress?: (ids: string[], progress: number) => void
  onBulkDelete?: (ids: string[]) => void
}

function DropLine({ mode, id, dropTarget }: { mode: DropMode; id: string; dropTarget: DropTarget | null }) {
  if (!dropTarget || dropTarget.id !== id) return null
  if (mode === 'before' && dropTarget.mode === 'before') {
    return <div className="absolute top-0 left-0 right-0 h-[2px] z-10 rounded" style={{ background: 'hsl(var(--cobalt-400))' }} />
  }
  if (mode === 'after' && dropTarget.mode === 'after') {
    return <div className="absolute bottom-0 left-0 right-0 h-[2px] z-10 rounded" style={{ background: 'hsl(var(--cobalt-400))' }} />
  }
  return null
}

function rowMatchesFilter(
  row: WBSFlatRow,
  filter: KPIFilter,
  rabCount: number,
  timelineCountByWbs: Map<string, number>,
): boolean {
  if (!filter) return true
  switch (filter) {
    case 'rab-unlinked':    return rabCount === 0
    case 'qc-passed':       return row.item.qc_status === 'PASSED'
    case 'low-progress':    return row.weightedProgress < 30
    case 'timeline-linked': return (timelineCountByWbs.get(row.item.id) ?? 0) > 0
    default:                return true
  }
}

export const WBSVirtualTree = forwardRef<WBSVirtualTreeHandle, WBSVirtualTreeProps>(
  function WBSVirtualTree(
    { rows, selectedId, flashId, onSelect, onToggleExpand, onAddChild, onEdit, onDelete, onMoveItem, onVisibleRangeChange, onUndo, rabCountByWbs, onGenerateCodes, activeFilter, timelineCountByWbs, showSetupChecklist = false, onUpdateProgress, onBulkUpdateProgress, onBulkDelete },
    ref
  ) {
    const parentRef = useRef<HTMLDivElement>(null)
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)

    const [checklistDismissed, setChecklistDismissed] = useState(false)

    const [focusedIndex, setFocusedIndex] = useState<number | null>(null)
    const [editingProgressId, setEditingProgressId] = useState<string | null>(null)
    const [hoveredRowId, setHoveredRowId] = useState<string | null>(null)
    const [bulkSelectedIds, setBulkSelectedIds] = useState<Set<string>>(new Set())
    const anchorIdxRef = useRef<number | null>(null)
    const [showProgressPopover, setShowProgressPopover] = useState(false)
    const popoverInputRef = useRef<HTMLInputElement>(null)

    // Refs used inside the keydown handler to avoid stale closures
    const focusedIdxRef = useRef<number | null>(null)
    const rowsRef = useRef(rows)
    const selectedIdRef = useRef<string | null>(selectedId)
    const cbRef = useRef({ onUndo, onSelect, onToggleExpand, onAddChild, onEdit, onDelete })
    const cancelledRef = useRef(false)

    useEffect(() => { rowsRef.current = rows })
    useEffect(() => { selectedIdRef.current = selectedId })
    useEffect(() => { cbRef.current = { onUndo, onSelect, onToggleExpand, onAddChild, onEdit, onDelete } })
    useEffect(() => {
      if (selectedId) {
        const idx = rows.findIndex((r) => r.item.id === selectedId)
        if (idx >= 0) {
          focusedIdxRef.current = idx
          setFocusedIndex(idx)
        }
      }
    }, [selectedId, rows])

    const confirmProgressEdit = (input: HTMLInputElement) => {
      if (!editingProgressId) return
      if (cancelledRef.current) {
        cancelledRef.current = false
        return
      }
      const val = Math.round(Math.min(100, Math.max(0, Number(input.value) || 0)))
      onUpdateProgress?.(editingProgressId, val)
      setEditingProgressId(null)
    }

    const confirmBulkProgress = (input: HTMLInputElement) => {
      const val = Math.round(Math.min(100, Math.max(0, Number(input.value) || 0)))
      onBulkUpdateProgress?.(Array.from(bulkSelectedIds), val)
      anchorIdxRef.current = null
      setBulkSelectedIds(new Set())
      setShowProgressPopover(false)
    }

    const virtualizer = useVirtualizer({
      count: rows.length,
      getScrollElement: () => parentRef.current,
      estimateSize: () => ROW_HEIGHT,
      overscan: 5,
      onChange: (instance) => {
        const vItems = instance.getVirtualItems()
        if (vItems.length > 0) {
          onVisibleRangeChange(vItems[0].index, vItems[vItems.length - 1].index)
        }
      },
    })

    useImperativeHandle(ref, () => ({
      scrollToIndex: (index: number) => virtualizer.scrollToIndex(index, { align: 'start' }),
    }))

    useEffect(() => {
      const el = parentRef.current
      if (!el) return

      const handler = (e: KeyboardEvent) => {
        const { onUndo: undo, onSelect: select, onToggleExpand: toggleExp,
                onAddChild: addChild, onEdit: edit, onDelete: del } = cbRef.current
        const allRows = rowsRef.current

        // Ctrl+Z undo (unchanged behaviour)
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault()
          undo()
          return
        }

        // Ignore all other modified-key combos
        if (e.ctrlKey || e.metaKey || e.altKey) return
        if (allRows.length === 0) return

        // When focus is inside an editable element, only let text-editing shortcuts
        // pass through. Tree navigation keys must not fire.
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as Element).tagName)) {
          return
        }

        const curIdx = focusedIdxRef.current !== null
          ? focusedIdxRef.current
          : allRows.findIndex((r) => r.item.id === selectedIdRef.current)
        const safeIdx = Math.max(0, Math.min(allRows.length - 1, curIdx >= 0 ? curIdx : 0))
        const row = allRows[safeIdx]

        const moveTo = (idx: number) => {
          const clamped = Math.max(0, Math.min(allRows.length - 1, idx))
          focusedIdxRef.current = clamped
          setFocusedIndex(clamped)
          virtualizer.scrollToIndex(clamped)
        }

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            moveTo(safeIdx + 1)
            break
          case 'ArrowUp':
            e.preventDefault()
            moveTo(safeIdx - 1)
            break
          case 'ArrowRight':
            e.preventDefault()
            if (row.hasChildren && !row.isExpanded) toggleExp(row.item.id)
            break
          case 'ArrowLeft':
            e.preventDefault()
            if (row.hasChildren && row.isExpanded) {
              toggleExp(row.item.id)
            } else if (row.item.parentId) {
              const pi = allRows.findIndex((r) => r.item.id === row.item.parentId)
              if (pi >= 0) moveTo(pi)
            }
            break
          case 'Enter':
            e.preventDefault()
            anchorIdxRef.current = null
            setBulkSelectedIds(new Set())
            setShowProgressPopover(false)
            select(row.item)
            break
          case 'n':
            e.preventDefault(); addChild(row.item.id)
            break
          case 'e':
            e.preventDefault(); edit(row.item)
            break
          case 'Delete':
          case 'Backspace':
            e.preventDefault(); del(row.item)
            break
        }
      }

      el.addEventListener('keydown', handler)
      return () => el.removeEventListener('keydown', handler)
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])  // Empty: all values accessed via stable refs or captured-once stable virtualizer

    useEffect(() => {
      if (!openMenuId) return
      const handler = () => setOpenMenuId(null)
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [openMenuId])

    const handleDragStart = useCallback((e: React.DragEvent, rowId: string) => {
      e.dataTransfer.setData('text/plain', rowId)
      e.dataTransfer.effectAllowed = 'move'
      setDraggedId(rowId)
      anchorIdxRef.current = null
      setBulkSelectedIds(new Set())
      setShowProgressPopover(false)
    }, [])

    const handleDragOver = useCallback((e: React.DragEvent, row: WBSFlatRow) => {
      e.preventDefault()
      if (!draggedId || draggedId === row.item.id) return
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
      const y = e.clientY - rect.top
      const height = rect.height
      let mode: DropMode = 'inside'
      if (y < height * 0.25) mode = 'before'
      else if (y > height * 0.75) mode = 'after'
      setDropTarget({ id: row.item.id, mode })
    }, [draggedId])

    const handleDrop = useCallback((e: React.DragEvent, row: WBSFlatRow) => {
      e.preventDefault()
      if (!draggedId || !dropTarget || draggedId === row.item.id) {
        setDraggedId(null)
        setDropTarget(null)
        return
      }
      const { mode } = dropTarget
      let newParentId: string | null
      let newIndex: number

      if (mode === 'inside') {
        newParentId = row.item.id
        newIndex = 0
      } else {
        newParentId = row.item.parentId ?? null
        const siblings = rows.filter(r => (r.item.parentId ?? null) === newParentId)
        const targetIdx = siblings.findIndex(r => r.item.id === row.item.id)
        newIndex = mode === 'before' ? targetIdx : targetIdx + 1
      }
      onMoveItem(draggedId, newParentId, newIndex)
      setDraggedId(null)
      setDropTarget(null)
    }, [draggedId, dropTarget, rows, onMoveItem])

    const handleDragEnd = useCallback(() => {
      setDraggedId(null)
      setDropTarget(null)
    }, [])

    if (rows.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
          <p className="text-sm text-[var(--text-secondary)]">Belum ada item WBS.</p>
          <button
            onClick={() => onAddChild(null)}
            className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-semibold text-white transition-colors"
            style={{ background: 'hsl(var(--amber-500))' }}
          >
            <Plus size={13} />
            Buat Item WBS Pertama
          </button>
        </div>
      )
    }

    const handleRowClick = (e: React.MouseEvent, row: WBSFlatRow, idx: number) => {
      if (editingProgressId !== null) return
      if (e.shiftKey && anchorIdxRef.current !== null) {
        const lo = Math.min(anchorIdxRef.current, idx)
        const hi = Math.max(anchorIdxRef.current, idx)
        setBulkSelectedIds(new Set(rows.slice(lo, hi + 1).map((r) => r.item.id)))
        return
      }
      if (e.ctrlKey || e.metaKey) {
        anchorIdxRef.current = idx
        setBulkSelectedIds((prev) => {
          const next = new Set(prev)
          if (next.has(row.item.id)) { next.delete(row.item.id) } else { next.add(row.item.id) }
          return next
        })
        return
      }
      anchorIdxRef.current = idx
      setBulkSelectedIds(new Set())
      cbRef.current.onSelect(row.item)
    }

    const virtualItems = virtualizer.getVirtualItems()

    return (
      <div className="w-full h-full flex flex-col outline-none">
        <div ref={parentRef} className="flex-1 min-h-0 overflow-auto relative" tabIndex={0}>
        <span
          className="absolute top-1 right-2 select-none opacity-40 hover:opacity-100 transition-opacity z-10"
          style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'default' }}
          title="Ctrl+Z: undo pindah/hapus"
        >
          ⌨ ↩
        </span>

        {!checklistDismissed && showSetupChecklist && (
          <div
            className="mx-2 mb-1 rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface-hover)] p-2 relative"
          >
            <button
              onClick={() => setChecklistDismissed(true)}
              className="absolute top-1 right-1.5 leading-none text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
              style={{ fontSize: 12 }}
              title="Tutup"
            >
              ×
            </button>
            <div
              className="font-bold uppercase tracking-wider mb-1.5"
              style={{ color: 'var(--text-muted)', fontSize: 8 }}
            >
              Setup WBS Proyek
            </div>
            {[
              { done: true,       label: 'Item WBS dibuat',        action: null },
              { done: rows.some((r) => !!r.item.code), label: 'Generate kode WBS', action: onGenerateCodes ?? null },
              { done: false,      label: 'Hubungkan RAB ke item',  action: null },
              { done: false,      label: 'Isi progress pertama',   action: null },
            ].map((step, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span style={{
                  fontSize: 9,
                  color: step.done ? 'var(--wbs-progress-high)' : 'var(--wbs-progress-low)',
                }}>
                  {step.done ? '✓' : '○'}
                </span>
                <span
                  className="flex-1"
                  style={{
                    fontSize: 8,
                    color: 'var(--text-secondary)',
                    textDecoration: step.done ? 'line-through' : 'none',
                    opacity: step.done ? 0.5 : 1,
                  }}
                >
                  {step.label}
                </span>
                {step.action && (
                  <button
                    onClick={step.action}
                    className="font-bold px-1.5 py-0.5 rounded"
                    style={{
                      fontSize: 7,
                      background: 'hsl(var(--cobalt-400) / 0.15)',
                      color: 'hsl(var(--cobalt-400))',
                    }}
                  >
                    Jalankan
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualItems.map((vItem) => {
            const row = rows[vItem.index]
            const item = row.item
            const isSelected = item.id === selectedId
            const isFlashing = item.id === flashId
            const isDragOver = dropTarget?.id === item.id && dropTarget.mode === 'inside'
            const progress = row.weightedProgress
            const rabCount = rabCountByWbs.get(item.id) ?? 0
            const isDimmed =
              activeFilter !== null && !rowMatchesFilter(row, activeFilter, rabCount, timelineCountByWbs)
            const isBulkSelected = bulkSelectedIds.has(item.id)
            const codeColor = row.depth >= 2 ? 'hsl(var(--cobalt-300))' : 'hsl(var(--cobalt-400))'
            const codeBg = row.depth >= 2 ? 'hsl(var(--cobalt-300) / 0.12)' : 'hsl(var(--cobalt-400) / 0.18)'

            return (
              <div
                key={item.id}
                data-index={vItem.index}
                ref={virtualizer.measureElement}
                style={{
                  position: 'absolute',
                  top: vItem.start,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT,
                  paddingLeft: row.depth * 16 + 8,
                  outline: isDragOver ? '1px dashed hsl(var(--amber-400))' : 'none',
                  outlineOffset: '-1px',
                }}
                className={[
                  'group flex items-center gap-1.5 pr-2 select-none relative cursor-pointer transition-colors rounded',
                  isDimmed ? 'opacity-30' : '',
                  isSelected
                    ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--amber-500)/0.3)]'
                    : isBulkSelected
                      ? 'ring-1 ring-inset ring-[hsl(var(--cobalt-400)/0.35)] bg-[hsl(var(--cobalt-400)/0.10)]'
                      : vItem.index === focusedIndex
                        ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--cobalt-400)/0.4)]'
                        : 'hover:bg-[var(--bg-surface-hover)]',
                  isFlashing ? 'animate-pulse' : '',
                ].filter(Boolean).join(' ')}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, row)}
                onDrop={(e) => handleDrop(e, row)}
                onClick={(e) => handleRowClick(e, row, vItem.index)}
                onMouseEnter={() => setHoveredRowId(item.id)}
                onMouseLeave={() => setHoveredRowId(null)}
              >
                <DropLine mode="before" id={item.id} dropTarget={dropTarget} />
                <DropLine mode="after" id={item.id} dropTarget={dropTarget} />

                {/* Drag grip — visible on hover */}
                <span
                  className="shrink-0 text-xs select-none opacity-0 group-hover:opacity-100 transition-opacity leading-none"
                  style={{ color: 'var(--text-muted)', fontSize: 10 }}
                >
                  ⠿
                </span>

                {/* Expand/collapse */}
                <button
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(item.id) }}
                  className="w-4 h-4 flex items-center justify-center shrink-0 rounded hover:bg-[var(--border-default)]"
                >
                  {row.hasChildren
                    ? (row.isExpanded
                      ? <ChevronDown size={11} className="text-[var(--text-muted)]" />
                      : <ChevronRight size={11} className="text-[var(--text-muted)]" />)
                    : <span className="text-xs text-[var(--border-default)]">—</span>}
                </button>

                {/* WBS code badge — lighter cobalt for L3+ */}
                <span
                  className="shrink-0 font-mono font-bold px-1.5 rounded leading-none py-0.5"
                  style={{ fontSize: 8, color: codeColor, background: codeBg }}
                >
                  {item.code || '—'}
                </span>

                {/* RAB count badge — always shown for leaf items (amber=warning, cobalt=linked) */}
                {(rabCount > 0 || !row.hasChildren) && (
                  <span
                    className="shrink-0 font-mono font-semibold px-1 rounded leading-none py-0.5"
                    style={{
                      fontSize: 7,
                      color: rabCount > 0 ? 'hsl(var(--cobalt-300))' : 'var(--wbs-progress-low)',
                      background: rabCount > 0 ? 'hsl(var(--cobalt-300) / 0.12)' : 'hsl(var(--wbs-progress-low) / 0.15)',
                    }}
                  >
                    {rabCount} RAB
                  </span>
                )}

                {/* QC passed indicator */}
                {item.qc_status === 'PASSED' && (
                  <CheckCircle2
                    size={9}
                    className="shrink-0"
                    style={{ color: 'var(--wbs-progress-high)' }}
                  />
                )}

                {/* Name */}
                <span
                  className="flex-1 min-w-0 truncate"
                  style={{
                    fontSize: row.depth === 0 ? '10px' : '9px',
                    fontWeight: row.depth === 0 ? 700 : 400,
                    color: row.depth === 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                  }}
                >
                  {item.name}
                </span>

                {/* Budget */}
                {row.recursiveBudget > 0 && (
                  <span className="shrink-0 font-mono text-[7px] font-bold text-[var(--text-idr)]">
                    {formatIDR(row.recursiveBudget)}{row.hasChildren ? ' ↕' : ''}
                  </span>
                )}

                {/* Progress bar */}
                <div className="shrink-0 w-9 h-[3px] rounded overflow-hidden bg-[var(--border-default)]">
                  {progress > 0 && (
                    <div
                      className="h-full rounded"
                      style={{ width: `${Math.min(100, progress)}%`, background: progressColor(progress) }}
                    />
                  )}
                </div>

                {/* Progress badge — swaps to inline input when editingProgressId matches */}
                {editingProgressId === item.id ? (
                  <span className="flex items-center gap-0.5 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      defaultValue={item.progress ?? 0}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmProgressEdit(e.currentTarget)
                        if (e.key === 'Escape') {
                          cancelledRef.current = true
                          setEditingProgressId(null)
                        }
                      }}
                      onBlur={(e) => confirmProgressEdit(e.currentTarget)}
                      onClick={(e) => e.stopPropagation()}
                      className="w-9 rounded border text-right font-mono px-1 py-px"
                      style={{
                        fontSize: 10,
                        background: 'hsl(var(--bg-surface))',
                        borderColor: 'hsl(var(--cobalt-400))',
                        color: 'hsl(var(--cobalt-400))',
                      }}
                    />
                    <span style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>%</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-1 shrink-0">
                    <span
                      className="font-mono font-bold"
                      style={{
                        fontSize: 7,
                        color: progress > 0 ? progressColor(progress) : 'var(--text-muted)',
                      }}
                    >
                      {progress}%
                    </span>
                    {hoveredRowId === item.id && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingProgressId(item.id) }}
                        className="border-0 bg-transparent p-0 leading-none"
                        style={{ color: 'hsl(var(--amber-500))', fontSize: 11, opacity: 0.75 }}
                        tabIndex={-1}
                        aria-label="Edit progress"
                      >
                        ✎
                      </button>
                    )}
                  </span>
                )}

                {/* Quick actions — visible on hover */}
                <div
                  className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => onAddChild(item.id)}
                    className="p-0.5 rounded text-[var(--text-muted)] hover:bg-[var(--border-default)] hover:text-[var(--text-secondary)]"
                    title="Tambah child"
                  >
                    <Plus size={10} />
                  </button>
                  <button
                    onClick={() => onEdit(item)}
                    className="p-0.5 rounded text-[var(--text-muted)] hover:bg-[var(--border-default)] hover:text-[var(--text-secondary)]"
                    title="Edit"
                  >
                    <Edit2 size={10} />
                  </button>
                </div>

                {/* Context menu (delete + overflow) */}
                <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                    className="p-0.5 rounded text-[var(--text-muted)] hover:bg-[var(--border-default)] hover:text-[var(--text-secondary)]"
                  >
                    <MoreHorizontal size={12} />
                  </button>
                  {openMenuId === item.id && (
                    <div
                      className="absolute right-0 top-full mt-0.5 w-36 rounded-md shadow-lg z-50"
                      style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}
                    >
                      <button
                        onClick={() => { onAddChild(item.id); setOpenMenuId(null) }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-secondary)]"
                      >
                        <Plus size={11} />Tambah Child
                      </button>
                      <button
                        onClick={() => { onEdit(item); setOpenMenuId(null) }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-secondary)]"
                      >
                        <Edit2 size={11} />Edit
                      </button>
                      <button
                        onClick={() => { onDelete(item); setOpenMenuId(null) }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs hover:bg-[var(--bg-surface-hover)]"
                        style={{ color: 'var(--status-danger-fg)' }}
                      >
                        <Trash2 size={11} />Hapus
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
        </div>

        {bulkSelectedIds.size > 0 && (
          <div className="relative shrink-0" onMouseDown={(e) => e.preventDefault()}>
            {showProgressPopover && (
              <div
                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 z-20
                           flex items-center gap-2 rounded-md border px-3 py-2 shadow-lg"
                style={{
                  background: 'hsl(var(--bg-surface))',
                  borderColor: 'hsl(var(--cobalt-400) / 0.4)',
                }}
              >
                <span style={{ fontSize: 10, color: 'hsl(var(--text-muted))' }}>
                  Set {bulkSelectedIds.size} item →
                </span>
                <input
                  ref={popoverInputRef}
                  type="number"
                  min={0}
                  max={100}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') confirmBulkProgress(e.currentTarget)
                    if (e.key === 'Escape') setShowProgressPopover(false)
                  }}
                  className="w-10 rounded border text-right font-mono px-1 py-px"
                  style={{
                    fontSize: 11,
                    background: 'hsl(var(--bg-base))',
                    borderColor: 'hsl(var(--cobalt-400))',
                    color: 'hsl(var(--cobalt-400))',
                  }}
                />
                <span style={{ fontSize: 9, color: 'hsl(var(--text-muted))' }}>%</span>
                <button
                  onClick={() => popoverInputRef.current && confirmBulkProgress(popoverInputRef.current)}
                  className="rounded px-2 py-px text-white"
                  style={{ fontSize: 9, background: 'hsl(var(--cobalt-400))' }}
                >
                  ✓
                </button>
              </div>
            )}

            <div
              className="flex items-center gap-2 border-t px-3 py-1.5"
              style={{
                background: 'hsl(var(--bg-surface))',
                borderColor: 'hsl(var(--cobalt-400) / 0.25)',
              }}
            >
              <span className="font-bold" style={{ fontSize: 10, color: 'hsl(var(--cobalt-400))' }}>
                {bulkSelectedIds.size} dipilih
              </span>
              <span className="flex-1" />
              <button
                onClick={() => setShowProgressPopover((p) => !p)}
                className="rounded px-2 py-0.5"
                style={{
                  fontSize: 10,
                  background: 'hsl(var(--cobalt-400) / 0.15)',
                  color: 'hsl(var(--cobalt-400))',
                }}
              >
                Set %
              </button>
              <button
                onClick={() => {
                  onBulkDelete?.(Array.from(bulkSelectedIds))
                  anchorIdxRef.current = null
                  setBulkSelectedIds(new Set())
                  setShowProgressPopover(false)
                }}
                className="rounded px-2 py-0.5"
                style={{ fontSize: 10, background: 'hsl(0 70% 55% / 0.15)', color: 'hsl(0 70% 65%)' }}
              >
                Hapus
              </button>
              <button
                onClick={() => {
                  anchorIdxRef.current = null
                  setBulkSelectedIds(new Set())
                  setShowProgressPopover(false)
                }}
                className="border-0 bg-transparent leading-none"
                style={{ fontSize: 12, color: 'hsl(var(--text-muted))' }}
              >
                ✕
              </button>
            </div>
          </div>
        )}
      </div>
    )
  }
)
