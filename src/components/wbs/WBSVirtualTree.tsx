import { useRef, useCallback, useEffect, useState, useImperativeHandle, forwardRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronRight, ChevronDown, Plus, Edit2, Trash2, MoreHorizontal, CheckCircle2 } from 'lucide-react'
import { formatIDR } from '../../lib/utils'
import type { WBSFlatRow, WBSItem } from '../../types/wbs'

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

export const WBSVirtualTree = forwardRef<WBSVirtualTreeHandle, WBSVirtualTreeProps>(
  function WBSVirtualTree(
    { rows, selectedId, flashId, onSelect, onToggleExpand, onAddChild, onEdit, onDelete, onMoveItem, onVisibleRangeChange, onUndo, rabCountByWbs },
    ref
  ) {
    const parentRef = useRef<HTMLDivElement>(null)
    const [draggedId, setDraggedId] = useState<string | null>(null)
    const [dropTarget, setDropTarget] = useState<DropTarget | null>(null)
    const [openMenuId, setOpenMenuId] = useState<string | null>(null)

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
        if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
          e.preventDefault()
          onUndo()
        }
      }
      el.addEventListener('keydown', handler)
      return () => el.removeEventListener('keydown', handler)
    }, [onUndo])

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

    const virtualItems = virtualizer.getVirtualItems()

    return (
      <div
        ref={parentRef}
        className="w-full h-full overflow-auto outline-none relative"
        tabIndex={0}
      >
        <span
          className="absolute top-1 right-2 select-none opacity-40 hover:opacity-100 transition-opacity z-10"
          style={{ fontSize: 9, color: 'var(--text-muted)', cursor: 'default' }}
          title="Ctrl+Z: undo pindah/hapus"
        >
          ⌨ ↩
        </span>

        <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
          {virtualItems.map((vItem) => {
            const row = rows[vItem.index]
            const item = row.item
            const isSelected = item.id === selectedId
            const isFlashing = item.id === flashId
            const isDragOver = dropTarget?.id === item.id && dropTarget.mode === 'inside'
            const progress = row.weightedProgress
            const rabCount = rabCountByWbs.get(item.id) ?? 0
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
                  isSelected
                    ? 'bg-[var(--bg-surface-hover)] ring-1 ring-inset ring-[hsl(var(--amber-500)/0.3)]'
                    : 'hover:bg-[var(--bg-surface-hover)]',
                  isFlashing ? 'animate-pulse' : '',
                ].join(' ')}
                draggable
                onDragStart={(e) => handleDragStart(e, item.id)}
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleDragOver(e, row)}
                onDrop={(e) => handleDrop(e, row)}
                onClick={() => onSelect(item)}
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

                {/* Progress bar + badge — always shown; muted when 0% */}
                <div className="shrink-0 w-9 h-[3px] rounded overflow-hidden bg-[var(--border-default)]">
                  {progress > 0 && (
                    <div
                      className="h-full rounded"
                      style={{ width: `${Math.min(100, progress)}%`, background: progressColor(progress) }}
                    />
                  )}
                </div>
                <span
                  className="shrink-0 font-mono font-bold"
                  style={{
                    fontSize: 7,
                    color: progress > 0 ? progressColor(progress) : 'var(--text-muted)',
                  }}
                >
                  {progress}%
                </span>

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
    )
  }
)
