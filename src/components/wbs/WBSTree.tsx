
/**
 * WBSTree.tsx
 * Hierarchical WBS tree component with drag & drop functionality
 */

import React, { useCallback, useRef } from 'react'
import { 
  ChevronRight, 
  ChevronDown, 
  MoreHorizontal, 
  Plus, 
  Edit2, 
  Trash2,
  GripVertical
} from 'lucide-react'
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
}) {
  const [showMenu, setShowMenu] = React.useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const itemRef = useRef<HTMLDivElement>(null)

  const isSelected = item.id === selectedId
  const isExpanded = expandedIds?.has(item.id) ?? false

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
    <div className="select-none">
      <div
        ref={itemRef}
        draggable
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`
          group relative flex items-center gap-2 rounded-lg px-2 py-2 transition-colors
          ${isSelected 
            ? 'bg-blue-50 border border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
            : 'hover:bg-neutral-50 dark:hover:bg-neutral-800'
          }
          ${item.isDragging ? 'opacity-50' : ''}
          ${item.isDropTarget ? 'border-2 border-dashed border-blue-400' : ''}
        `}
        style={{ paddingLeft: `${level * 24 + 8}px` }}
      >
        {/* Drag handle */}
        <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover:opacity-100 transition-opacity">
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
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                {item.code}
              </span>
              <span className="text-sm font-medium truncate">
                {item.name}
              </span>
            </div>
          )}
        </div>

        {/* Action menu */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-neutral-200 dark:hover:bg-neutral-700"
          >
            <MoreHorizontal size={14} />
          </button>

          {showMenu && (
            <div 
              ref={menuRef}
              className="absolute right-0 top-full mt-1 w-40 rounded-lg border bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900 z-10"
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

      {/* Children */}
      {isExpanded && item.children && (
        <div className="ml-2">
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
  onReorderItems,
  maxNestingLevel = 5,
  expandAll = false,
}: WBSTreeProps) {
  const [draggedItem, setDraggedItem] = React.useState<string | null>(null)
  const [dropTarget, setDropTarget] = React.useState<{ id: string; position: 'before' | 'after' | 'inside' } | null>(null)

  // Build tree structure
  const tree = React.useMemo(() => {
    const itemMap = new Map(items.map(item => [item.id, { ...item, children: [] }]))
    const rootItems: WBSItem[] = []

    items.forEach(item => {
      const itemWithChildren = itemMap.get(item.id)!
      
      if (item.parentId) {
        const parent = itemMap.get(item.parentId)
        if (parent) {
          parent.children!.push(itemWithChildren)
        }
      } else {
        rootItems.push(itemWithChildren)
      }
    })

    return rootItems
  }, [items])

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

  const handleDrop = useCallback((e: React.DragEvent, targetId: string, index: number) => {
    e.preventDefault()
    
    if (!draggedItem || !onMoveItem) return

    let newParentId: string | null = null
    let newIndex = index

    if (dropTarget) {
      switch (dropTarget.position) {
        case 'before':
          // Find parent and insert before target
          const targetItem = items.find(item => item.id === targetId)
          newParentId = targetItem?.parentId || null
          const siblings = items.filter(item => item.parentId === newParentId)
          newIndex = siblings.findIndex(item => item.id === targetId)
          break
        case 'after':
          // Find parent and insert after target
          const targetItem2 = items.find(item => item.id === targetId)
          newParentId = targetItem2?.parentId || null
          const siblings2 = items.filter(item => item.parentId === newParentId)
          const targetIndex = siblings2.findIndex(item => item.id === targetId)
          newIndex = targetIndex + 1
          break
        case 'inside':
          // Insert as child
          newParentId = targetId
          newIndex = 0
          break
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
        No WBS items found. Create your first item to get started.
      </div>
    )
  }

  return (
    <div className="w-full">
      {/* Add root item button */}
      {onAddItem && (
        <div className="mb-4">
          <button
            onClick={() => onAddItem(null)}
            className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 px-3 py-2 text-sm text-neutral-600 hover:border-neutral-400 hover:text-neutral-800 dark:border-neutral-600 dark:text-neutral-400 dark:hover:border-neutral-500 dark:hover:text-neutral-200"
          >
            <Plus size={16} />
            Add Root Item
          </button>
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
          />
        ))}
      </div>

      {/* Drop indicator */}
      {dropTarget && (
        <div className="fixed inset-0 pointer-events-none z-50">
          <div className="border-2 border-blue-400 border-dashed rounded-lg bg-blue-50/20 dark:bg-blue-900/20">
            Drop here
          </div>
        </div>
      )}
    </div>
  )
}

export default WBSTree
