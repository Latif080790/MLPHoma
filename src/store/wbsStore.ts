
/**
 * wbsStore.ts
 * Zustand store for WBS management with hierarchical operations
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { WBSStore, WBSItem } from '../types/wbs'

/**
 * Generate unique ID
 */
function generateId(): string {
  return `wbs-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate WBS code based on hierarchy
 */
function generateWBSCode(items: WBSItem[], parentId: string | null, index: number): string {
  if (!parentId) {
    // Root level: use numeric (1, 2, 3...)
    const siblings = items.filter(item => !item.parentId)
    const siblingIndex = siblings.findIndex(item => item.sortOrder === index)
    return (siblingIndex + 1).toString()
  } else {
    // Child level: extend parent code (1.1, 1.2, ...)
    const parent = items.find(item => item.id === parentId)
    if (!parent) return (index + 1).toString()
    
    const siblings = items.filter(item => item.parentId === parentId)
    const siblingIndex = siblings.findIndex(item => item.sortOrder === index)
    return `${parent.code}.${siblingIndex + 1}`
  }
}

/**
 * Sort items by hierarchy and order
 */
function sortHierarchy(items: WBSItem[]): WBSItem[] {
  const result: WBSItem[] = []
  const visited = new Set<string>()

  function visit(item: WBSItem) {
    if (visited.has(item.id)) return
    visited.add(item.id)
    result.push(item)
    
    // Visit children in order
    const children = items
      .filter(i => i.parentId === item.id)
      .sort((a, b) => a.sortOrder - b.sortOrder)
    
    children.forEach(visit)
  }

  // Start with root items
  items
    .filter(item => !item.parentId)
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .forEach(visit)

  return result
}

/**
 * Create WBS Store with Zustand
 */
export const useWBSStore = create<WBSStore>()(
  devtools(
    (set, get) => ({
      // Initial state
      itemsByProject: {},
      selectedId: null,
      expandedIds: new Set(),
      loading: false,
      error: null,

      // Add new WBS item
      addItem: (projectId, item) => {
        const newItem: WBSItem = {
          ...item,
          id: generateId(),
          projectId,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set((state) => {
          const currentItems = state.itemsByProject[projectId] || []
          const updatedItems = [...currentItems, newItem]
          
          // Update sort order for siblings
          const siblings = updatedItems.filter(i => i.parentId === newItem.parentId)
          siblings.forEach((sibling, index) => {
            if (sibling.id !== newItem.id) {
              sibling.sortOrder = index + 1
            }
          })
          newItem.sortOrder = 0

          // Generate codes for affected items
          const finalItems = generateCodesForProject(updatedItems)

          return {
            itemsByProject: {
              ...state.itemsByProject,
              [projectId]: finalItems,
            },
            selectedId: newItem.id,
          }
        })
      },

      // Update WBS item
      updateItem: (projectId, id, updates) => {
        set((state) => {
          const currentItems = state.itemsByProject[projectId] || []
          const updatedItems = currentItems.map(item =>
            item.id === id
              ? { ...item, ...updates, updatedAt: new Date().toISOString() }
              : item
          )

          return {
            itemsByProject: {
              ...state.itemsByProject,
              [projectId]: updatedItems,
            },
          }
        })
      },

      // Delete WBS item (and children)
      deleteItem: (projectId, id) => {
        set((state) => {
          const currentItems = state.itemsByProject[projectId] || []
          
          // Find all descendants
          const toDelete = new Set<string>([id])
          let added = true
          while (added) {
            added = false
            currentItems.forEach(item => {
              if (item.parentId && toDelete.has(item.parentId)) {
                if (!toDelete.has(item.id)) {
                  toDelete.add(item.id)
                  added = true
                }
              }
            })
          }

          // Remove items
          const updatedItems = currentItems.filter(item => !toDelete.has(item.id))
          
          // Regenerate codes
          const finalItems = generateCodesForProject(updatedItems)

          // Update selection if needed
          const newSelectedId = state.selectedId && toDelete.has(state.selectedId) 
            ? null 
            : state.selectedId

          return {
            itemsByProject: {
              ...state.itemsByProject,
              [projectId]: finalItems,
            },
            selectedId: newSelectedId,
          }
        })
      },

      // Move item (drag & drop)
      moveItem: (projectId, itemId, newParentId, newIndex) => {
        set((state) => {
          const currentItems = state.itemsByProject[projectId] || []
          // Deep copy to avoid mutation issues
          let updatedItems = currentItems.map(item => ({ ...item }))

          // Find the item to move
          const itemIndex = updatedItems.findIndex(i => i.id === itemId)
          if (itemIndex === -1) return state

          const item = updatedItems[itemIndex]
          const oldParentId = item.parentId

          // Prevent moving item into its own descendant
          let current = newParentId
          while (current) {
            if (current === itemId) return state
            const parent = updatedItems.find(i => i.id === current)
            current = parent?.parentId || null
          }

          // 1. Remove item from the array temporarily
          updatedItems.splice(itemIndex, 1)
          item.parentId = newParentId

          // 2. Get siblings in the new parent (excluding the moved item)
          // Sort them by current sortOrder to ensure stable insertion
          const newSiblings = updatedItems
            .filter(i => i.parentId === newParentId)
            .sort((a, b) => a.sortOrder - b.sortOrder)

          // 3. Insert item at the correct position in the siblings array
          // Clamp index to valid range
          const targetIndex = Math.max(0, Math.min(newIndex, newSiblings.length))
          newSiblings.splice(targetIndex, 0, item)

          // 4. Update sortOrder for all new siblings
          newSiblings.forEach((sibling, index) => {
            sibling.sortOrder = index
          })

          // 5. Re-integrate siblings into the main array
          // We removed the item, now we need to update the siblings in the main array
          // Since we have references in newSiblings, the objects in updatedItems (which are the same references) are updated?
          // No, we mapped at the start. newSiblings contains references to objects in updatedItems.
          // So modifying sibling.sortOrder updates the object in updatedItems.
          
          // However, we need to put 'item' back into updatedItems array.
          updatedItems.push(item)

          // 6. Also update sortOrder for old siblings to close gaps (optional but good for cleanliness)
          if (oldParentId !== newParentId) {
             const oldSiblings = updatedItems
                .filter(i => i.parentId === oldParentId)
                .sort((a, b) => a.sortOrder - b.sortOrder)
             
             oldSiblings.forEach((sibling, index) => {
                sibling.sortOrder = index
             })
          }

          // 7. Generate codes
          const finalItems = generateCodesForProject(updatedItems)

          return {
            itemsByProject: {
              ...state.itemsByProject,
              [projectId]: finalItems,
            },
          }
        })
      },

      // Toggle item expansion
      toggleExpanded: (id) => {
        set((state) => {
          const expandedIds = new Set(state.expandedIds)
          if (expandedIds.has(id)) {
            expandedIds.delete(id)
          } else {
            expandedIds.add(id)
          }
          return { expandedIds }
        })
      },

      // Select item
      selectItem: (id) => {
        set({ selectedId: id })
      },

      // Reorder items
      reorderItems: (projectId, parentId, itemIds) => {
        set((state) => {
          const currentItems = state.itemsByProject[projectId] || []
          const updatedItems = [...currentItems]

          itemIds.forEach((itemId, index) => {
            const item = updatedItems.find(i => i.id === itemId)
            if (item && item.parentId === parentId) {
              item.sortOrder = index
            }
          })

          const finalItems = generateCodesForProject(updatedItems)

          return {
            itemsByProject: {
              ...state.itemsByProject,
              [projectId]: finalItems,
            },
          }
        })
      },

      // Generate WBS codes
      generateCodes: (projectId) => {
        set((state) => {
          const currentItems = state.itemsByProject[projectId] || []
          const finalItems = generateCodesForProject(currentItems)

          return {
            itemsByProject: {
              ...state.itemsByProject,
              [projectId]: finalItems,
            },
          }
        })
      },

      // Import WBS structure
      importWBS: (projectId, items) => {
        const now = new Date().toISOString()
        const newItems: WBSItem[] = items.map((item, index) => ({
          ...item,
          id: item.id || generateId(),
          projectId,
          createdAt: now,
          updatedAt: now,
          sortOrder: item.sortOrder ?? index,
        }))

        set((state) => {
          const finalItems = generateCodesForProject(newItems)

          return {
            itemsByProject: {
              ...state.itemsByProject,
              [projectId]: finalItems,
            },
          }
        })
      },

      // Export WBS structure
      exportWBS: (projectId) => {
        const items = get().itemsByProject[projectId] || []
        return sortHierarchy(items)
      },

      // Clear project WBS
      clearProject: (projectId) => {
        set((state) => {
          const newItemsByProject = { ...state.itemsByProject }
          delete newItemsByProject[projectId]
          return {
            itemsByProject: newItemsByProject,
            selectedId: null,
            expandedIds: new Set(),
          }
        })
      },
    }),
    {
      name: 'wbs-store',
    }
  )
)

/**
 * Generate WBS codes for all items in a project
 */
function generateCodesForProject(items: WBSItem[]): WBSItem[] {
  const updatedItems = [...items]
  
  // Process root items first
  const rootItems = updatedItems.filter(item => !item.parentId)
  rootItems.sort((a, b) => a.sortOrder - b.sortOrder)
  
  rootItems.forEach((item, index) => {
    item.code = (index + 1).toString()
  })

  // Process children recursively
  function processChildren(parentId: string) {
    const children = updatedItems.filter(item => item.parentId === parentId)
    children.sort((a, b) => a.sortOrder - b.sortOrder)
    
    const parent = updatedItems.find(item => item.id === parentId)
    if (!parent) return

    children.forEach((child, index) => {
      child.code = `${parent.code}.${index + 1}`
      processChildren(child.id)
    })
  }

  rootItems.forEach(item => processChildren(item.id))

  return updatedItems
}

/**
 * Get tree structure for rendering
 */
export function getWBSTree(items: WBSItem[]): WBSItem[] {
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
}

/**
 * Validation helper
 */
export function validateWBS(items: WBSItem[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  const codes = new Set<string>()

  items.forEach(item => {
    // Check for duplicate codes
    if (codes.has(item.code)) {
      errors.push(`Duplicate WBS code: ${item.code}`)
    } else {
      codes.add(item.code)
    }

    // Check for invalid parent reference
    if (item.parentId && !items.find(i => i.id === item.parentId)) {
      errors.push(`Invalid parent reference for item ${item.code}`)
    }
  })

  return {
    isValid: errors.length === 0,
    errors,
  }
}
