
/**
 * WBSTree.tsx
 * Hierarchical WBS tree component with drag & drop, keyboard nav, and budget badges
 */

import React, { useCallback, useRef, useMemo } from 'react'
import {
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Plus,
  Edit2,
  Trash2,
  GripVertical,
  Calculator,
} from 'lucide-react'
import { formatIDR } from '../../lib/utils'
import type { WBSItem } from '../../types/wbs'

/** Props for WBSTree component */
export interface WBSTreeProps {
  /** Tree data */
  items: WBSItem[]
  /** Currently selected item ID */
  selectedId?: string | null
  /** Expanded item IDs */
  expandedIds?: Set<string>
  /** Whether currently loading */
  loading?: boolean
  /** Optional custom render for item content */
  renderItem?: (item: WBSItem) => React.ReactNode
  /** Item click handler */
  onItemClick?: (item: WBSItem) => void
  /** Toggle expansion handler */
  onToggleExpand?: (id: string) => void
  /** Add new item handler */
  onAddItem?: (parentId: string | null) => void
  /** Edit item handler */
  onEditItem?: (item: WBSItem) => void
  /** Delete item handler */
  onDeleteItem?: (item: WBSItem) => void
  /** Move item handler */
  onMoveItem?: (itemId: string, newParentId: string | null, index: number) => void
  /** Reorder items handler */
  onReorderItems?: (parentId: string | null, itemIds: string[]) => void
  /** Maximum nesting level */
  maxNestingLevel?: number
  /** Expand all items */
  expandAll?: boolean
  /** Filter text — shows only matching items + their ancestors */
  filterText?: string
  /** Budget per WBS node (Task 18: budget badges) */
  budgetByWbs?: Map<string, number>
}

/**
 * WBSTreeItem component for individual tree nodes
 */
function WBSTreeItem({
  item,
  level = 0,
  selectedId,
  expandedIds,
  onToggleExpand,
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDrop,
  renderItem,
  maxNestingLevel = 5,
  budgetByWbs,
}: {
  item: WBSItem
  level?: number
  selectedId?: string | null
  expandedIds?: Set<string>
  onToggleExpand: (id: string) => void
  onSelect: (item: WBSItem) => void
  onAdd: (parentId: string | null) => void
  onEdit: (item: WBSItem) => void
  onDelete: (item: WBSItem) => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragOver: (e: React.DragEvent) => void
  onDrop: (e: React.DragEvent, newParentId: string | null, index: number) => void
  renderItem?: (item: WBSItem) => React.ReactNode
  maxNestingLevel?: number
  budgetByWbs?: Map<string, number>
}) {
  const [showMenu, setShowMenu] = React.useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRef = useRef<HTMLDivElement>(null)

  const isSelected = item.id === selectedId
  const isExpanded = expandedIds?.has(item.id) ?? false
  const budget = budgetByWbs?.get(item.id) ?? 0

  // ── Level-based visual style helpers ──────────────────────────────────────
  const lvl = item.level ?? 1
  const rowBg = isSelected
    ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800'
    : lvl === 1
      ? 'bg-slate-50/80 dark:bg-slate-800/40 hover:bg-slate-100 dark:hover:bg-slate-700/50 border border-transparent'
      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800 border border-transparent'
  const nameClass = lvl === 1
    ? 'text-sm font-bold text-neutral-800 dark:text-neutral-100'
    : lvl === 2
      ? 'text-sm font-semibold text-neutral-700 dark:text-neutral-200'
      : 'text-xs font-medium text-neutral-600 dark:text-neutral-300'
  const codeClass = lvl === 1
    ? 'font-mono text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 py-0.5 rounded'
    : lvl === 2
      ? 'font-mono text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1 rounded'
      : 'font-mono text-xs text-slate-400 dark:text-slate-500 px-1'

  // Close menu on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleDragStart = useCallback((e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', item.id)
    e.dataTransfer.effectAllowed = 'move'
    onDragStart()

    if (itemRef.current) {
      itemRef.current.style.opacity = '0.5'
    }
  }, [item.id, onDragStart])

  const handleDragEnd = useCallback(() => {
    onDragEnd()
    if (itemRef.current) {
      itemRef.current.style.opacity = ''
    }
  }, [onDragEnd])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    onDragOver(e)
  }, [onDragOver])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const draggedId = e.dataTransfer.getData('text/plain')
    if (draggedId !== item.id) {
      onDrop(e, item.id, 0)
    }
  }, [item.id, onDrop])

  const canAddChild = level < maxNestingLevel
  const hasChildren = item.children && item.children.length > 0

  return (
    <div className="select-none" data-wbs-item-id={item.id}>
      <div
        ref={itemRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          group relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors
          ${rowBg}
          ${item.isDragging ? 'opacity-50' : ''}
          ${item.isDropTarget ? 'border-2 border-dashed border-blue-400' : ''}
        `}
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {/* Drag handle */}
        <div className="cursor-grab active:cursor-grabbing opacity-80 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
          <GripVertical size={14} className="text-neutral-400" />
        </div>

        {/* Expand/Collapse button */}
        <button
          onClick={() => onToggleExpand(item.id)}
          className="flex h-4 w-4 items-center justify-center rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
        >
          {(hasChildren || isExpanded) && (
            isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />
          )}
        </button>

        {/* Item content */}
        <div
          className="flex-1 min-w-0"
          onClick={() => onSelect(item)}
        >
          {renderItem ? renderItem(item) : (
            <div className="flex items-center gap-2 min-w-0 overflow-hidden">
              <span className={`${codeClass} shrink-0`}>
                {item.code}
              </span>
              <span className={`${nameClass} truncate min-w-0 flex-1`}>
                {item.name}
              </span>
              {/* Budget badge (Task 18) */}
              {budget > 0 && (
                <span className="hidden sm:inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0 text-xs font-mono font-semibold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 shrink-0 ml-auto">
                  <Calculator size={9} />
                  {formatIDR(budget)}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Action menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="opacity-80 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            <MoreHorizontal size={14} />
          </button>

          {showMenu && (
            <div
              ref={menuRef}
              className="absolute right-0 top-full mt-1 w-44 rounded-lg border bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900 z-10"
            >
              <button
                onClick={() => {
                  onAdd(item.id)
                  setShowMenu(false)
                }}
                disabled={!canAddChild}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus size={14} />
                Add Child
              </button>
              <button
                onClick={() => {
                  onEdit(item)
                  setShowMenu(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
              >
                <Edit2 size={14} />
                Edit
              </button>
              <button
                onClick={() => {
                  onDelete(item)
                  setShowMenu(false)
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Children — left border creates the tree-line visual */}
      {isExpanded && item.children && (
        <div className="ml-4 border-l-2 border-slate-200 dark:border-slate-700 pl-1">
          {item.children.map((child) => (
            <WBSTreeItem
              key={child.id}
              item={child}
              level={level + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onSelect={onSelect}
              onAdd={onAdd}
              onEdit={onEdit}
              onDelete={onDelete}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onDragOver={onDragOver}
              onDrop={onDrop}
              renderItem={renderItem}
              maxNestingLevel={maxNestingLevel}
              budgetByWbs={budgetByWbs}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * WBSTree Component
 */
export function WBSTree({
  items,
  selectedId = null,
  expandedIds = new Set(),
  loading = false,
  renderItem,
  onItemClick,
  onToggleExpand,
  onAddItem,
  onEditItem,
  onDeleteItem,
  onMoveItem,
  onReorderItems: _onReorderItems,
  maxNestingLevel = 5,
  expandAll: _expandAll = false,
  filterText = '',
  budgetByWbs,
}: WBSTreeProps) {
  const [draggedItem, setDraggedItem] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(null)
  const treeContainerRef = useRef<HTMLDivElement>(null)

  // Compute visible items based on filterText (matching items + all ancestors)
  const displayedItems = React.useMemo(() => {
    if (!filterText.trim()) return items
    const q = filterText.toLowerCase()
    const matchingIds = new Set(
      items
        .filter(i => i.name.toLowerCase().includes(q) || (i.code ?? '').toLowerCase().includes(q))
        .map(i => i.id)
    )
    // Walk up to collect ancestors
    const visibleIds = new Set(matchingIds)
    const parentMap = new Map(items.map(i => [i.id, i.parentId ?? null]))
    matchingIds.forEach(id => {
      let cur = parentMap.get(id)
      while (cur) {
        visibleIds.add(cur)
        cur = parentMap.get(cur) ?? null
      }
    })
    return items.filter(i => visibleIds.has(i.id))
  }, [items, filterText])

  // Build tree structure
  const tree = React.useMemo(() => {
    const itemMap = new Map(displayedItems.map(item => [item.id, { ...item, children: [] as WBSItem[] }]))
    const rootItems: WBSItem[] = []

    displayedItems.forEach(item => {
      const itemWithChildren = itemMap.get(item.id)!

      if (item.parentId) {
        const parent = itemMap.get(item.parentId)
        if (parent) {
          parent.children!.push(itemWithChildren)
        } else {
          // Parent filtered out or missing — promote to root
          rootItems.push(itemWithChildren)
        }
      } else {
        rootItems.push(itemWithChildren)
      }
    })

    return rootItems
  }, [displayedItems])

  // Flatten tree for keyboard navigation (Task 15)
  const flatVisibleIds = useMemo(() => {
    const ids: string[] = []
    function walk(nodes: WBSItem[]) {
      for (const n of nodes) {
        ids.push(n.id)
        if (expandedIds.has(n.id) && n.children?.length) {
          walk(n.children)
        }
      }
    }
    walk(tree)
    return ids
  }, [tree, expandedIds])

  // Keyboard navigation handler (Task 15)
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!flatVisibleIds.length) return
    const currentIdx = selectedId ? flatVisibleIds.indexOf(selectedId) : -1

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault()
        const nextIdx = Math.min(currentIdx + 1, flatVisibleIds.length - 1)
        const nextId = flatVisibleIds[nextIdx]
        const nextItem = items.find(i => i.id === nextId)
        if (nextItem) onItemClick?.(nextItem)
        // Scroll into view
        const el = treeContainerRef.current?.querySelector(`[data-wbs-item-id="${nextId}"]`)
        el?.scrollIntoView({ block: 'nearest' })
        break
      }
      case 'ArrowUp': {
        e.preventDefault()
        const prevIdx = Math.max(currentIdx - 1, 0)
        const prevId = flatVisibleIds[prevIdx]
        const prevItem = items.find(i => i.id === prevId)
        if (prevItem) onItemClick?.(prevItem)
        const el = treeContainerRef.current?.querySelector(`[data-wbs-item-id="${prevId}"]`)
        el?.scrollIntoView({ block: 'nearest' })
        break
      }
      case 'ArrowRight': {
        e.preventDefault()
        if (selectedId && !expandedIds.has(selectedId)) {
          onToggleExpand?.(selectedId)
        }
        break
      }
      case 'ArrowLeft': {
        e.preventDefault()
        if (selectedId && expandedIds.has(selectedId)) {
          onToggleExpand?.(selectedId)
        }
        break
      }
      case 'Enter': {
        e.preventDefault()
        if (selectedId) {
          const item = items.find(i => i.id === selectedId)
          if (item) onEditItem?.(item)
        }
        break
      }
    }
  }, [flatVisibleIds, selectedId, items, onItemClick, onToggleExpand, expandedIds, onEditItem])

  const handleDragStart = useCallback((itemId: string) => {
    setDraggedItem(itemId)
  }, [])

  const handleDragEnd = useCallback(() => {
    setDraggedItem(null)
    setDropTarget(null)
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent, itemId: string) => {
    e.preventDefault()

    if (!draggedItem || draggedItem === itemId) return

    const rect = e.currentTarget.getBoundingClientRect()
    const y = e.clientY - rect.top
    const height = rect.height

    let position: 'before' | 'after' | 'inside' = 'inside'

    if (y < height * 0.25) {
      position = 'before'
    } else if (y > height * 0.75) {
      position = 'after'
    }

    setDropTarget({ id: itemId, position })
  }, [draggedItem])

  const handleDrop = useCallback((e: React.DragEvent, targetId: string | null, index: number) => {
    e.preventDefault()

    if (!draggedItem || !onMoveItem) return

    let newParentId: string | null = null
    let newIndex = index

    if (dropTarget) {
      switch (dropTarget.position) {
        case 'before': {
          // Find parent and insert before target
          const targetItem = items.find(item => item.id === targetId)
          newParentId = targetItem?.parentId || null
          const siblings = items.filter(item => item.parentId === newParentId)
          newIndex = siblings.findIndex(item => item.id === targetId)
          break
        }
        case 'after': {
          // Find parent and insert after target
          const targetItem2 = items.find(item => item.id === targetId)
          newParentId = targetItem2?.parentId || null
          const siblings2 = items.filter(item => item.parentId === newParentId)
          const targetIndex = siblings2.findIndex(item => item.id === targetId)
          newIndex = targetIndex + 1
          break
        }
        case 'inside': {
          // Insert as child
          newParentId = targetId
          newIndex = 0
          break
        }
      }
    }

    onMoveItem(draggedItem, newParentId, newIndex)
    setDraggedItem(null)
    setDropTarget(null)
  }, [draggedItem, dropTarget, items, onMoveItem])

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!items.length) {
    return (
      <div className="text-center p-8 text-neutral-500 dark:text-neutral-400">
        <p className="mb-3 text-sm">Belum ada item WBS.</p>
        {onAddItem && (
          <button
            onClick={() => onAddItem(null)}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            Buat Item WBS Pertama
          </button>
        )}
      </div>
    )
  }

  return (
    <div
      ref={treeContainerRef}
      className="w-full outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Add root item button (shown only when items exist) */}
      {onAddItem && (
        <div className="mb-2">
          <button
            onClick={() => onAddItem(null)}
            className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-1.5 text-xs text-neutral-600 hover:border-neutral-400 hover:text-neutral-800 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-200"
          >
            <Plus size={13} />
            Add Root Item
          </button>
        </div>
      )}

      {/* No results for search */}
      {filterText.trim() && displayedItems.length === 0 && (
        <div className="py-6 text-center text-xs text-neutral-400">
          No items match &ldquo;{filterText}&rdquo;
        </div>
      )}

      {/* Tree items */}
      <div className="space-y-1">
        {tree.map((item) => (
          <WBSTreeItem
            key={item.id}
            item={item}
            selectedId={selectedId}
            expandedIds={expandedIds}
            onToggleExpand={(id) => onToggleExpand?.(id)}
            onSelect={(item) => onItemClick?.(item)}
            onAdd={(parentId) => onAddItem?.(parentId)}
            onEdit={(item) => onEditItem?.(item)}
            onDelete={(item) => onDeleteItem?.(item)}
            onDragStart={() => handleDragStart(item.id)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, item.id)}
            onDrop={handleDrop}
            renderItem={renderItem}
            maxNestingLevel={maxNestingLevel}
            budgetByWbs={budgetByWbs}
          />
        ))}
      </div>

      {/* Inline drop position indicator (replaces fullscreen overlay) */}
      {dropTarget && (
        <div className="pointer-events-none mt-1 rounded border border-dashed border-blue-400 bg-blue-50/30 py-1 text-center text-xs text-blue-500 dark:bg-blue-900/20">
          Drop {dropTarget.position === 'inside' ? 'inside' : dropTarget.position}
        </div>
      )}
    </div>
  )
}

export default WBSTree
