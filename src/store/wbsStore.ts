
/**
 * wbsStore.ts
 * Zustand store for WBS management with hierarchical operations
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { notify as toast } from '../lib/toast'
import type { WBSStore, WBSItem } from '../types/wbs'
import { validate, mergeErrorMessages } from '../lib/validationMiddleware'
import { wbsItemInputSchema, wbsItemUpdateSchema } from '../lib/validationSchemas'
import { syncWBSItem, syncDelete, syncWBSItems } from '../lib/supabaseSyncService'
import { generateId } from '../lib/idGenerator'
import { supabase } from '../lib/supabaseClient'
import { useRabWbsLinkStore } from './rabWbsLinkStore'

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
        // Validate input
        const validation = validate(wbsItemInputSchema, { ...item, projectId })
        if (!validation.success) {
          const errorMsg = mergeErrorMessages(validation.errors)
          toast.error('Failed to add WBS item', errorMsg)
          set({ error: errorMsg })
          return
        }

        const newItem = {
          ...validation.data,
          id: generateId('wbs'),
          projectId,
          code: validation.data?.code ?? '',
          name: validation.data?.name ?? '',
          level: validation.data?.level ?? 1,
          parentId: validation.data?.parentId ?? null,
          sortOrder: validation.data?.sortOrder ?? 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as WBSItem

        set((state) => {
          const currentItems = state.itemsByProject[projectId] || []
          const updatedItems = [...currentItems, newItem]

          // Assign sortOrder: append new item at the end of its sibling group
          const existingSiblings = updatedItems
            .filter(i => i.parentId === newItem.parentId && i.id !== newItem.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
          existingSiblings.forEach((sibling, index) => {
            sibling.sortOrder = index
          })
          newItem.sortOrder = existingSiblings.length  // append at end

          // Generate codes for the entire project (codes are derived from sortOrder)
          const finalItems = generateCodesForProject(updatedItems)

          return {
            itemsByProject: {
              ...state.itemsByProject,
              [projectId]: finalItems,
            },
            selectedId: newItem.id,
          }
        })

        // Sync ALL project items so every code change (siblings included) persists
        const allItems = get().itemsByProject[projectId] || []
        syncWBSItems(allItems, projectId)
      },

      // Update WBS item
      updateItem: (projectId, id, updates) => {
        // Validate updates
        const validation = validate(wbsItemUpdateSchema, updates)
        if (!validation.success) {
          const errorMsg = mergeErrorMessages(validation.errors)
          toast.error('Failed to update WBS item', errorMsg)
          set({ error: errorMsg })
          return
        }

        // Logic: QC Gate
        // If progress is being set to 100, ensure QC is PASSED or NOT_REQUIRED
        if (updates.progress === 100) {
          const currentState = get()
          const currentItem = currentState.itemsByProject[projectId]?.find(i => i.id === id)
          if (currentItem) {
            // If qc_status is in updates, use it; otherwise use current
            const nextQcStatus = updates.qc_status || currentItem.qc_status || 'NOT_REQUIRED'
            if (nextQcStatus !== 'PASSED' && nextQcStatus !== 'NOT_REQUIRED') {
              toast.error(
                "QC Gate Enforcement",
                "Cannot complete task (100%) because Quality Control is not PASSED."
              )
              return // Abort
            }
          }
        }

        let updatedItem: WBSItem | null = null

        set((state) => {
          const currentItems = state.itemsByProject[projectId] || []
          const updatedItems = currentItems.map(item => {
            if (item.id === id) {
              updatedItem = { ...item, ...validation.data, updatedAt: new Date().toISOString() }
              return updatedItem
            }
            return item
          })

          return {
            itemsByProject: {
              ...state.itemsByProject,
              [projectId]: updatedItems,
            },
          }
        })

        // Sync to Supabase
        if (updatedItem) {
          syncWBSItem(updatedItem)
        }
      },

      // Delete WBS item (and children)
      deleteItem: (projectId, id) => {
        const toDeleteIds: string[] = []

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

          toDeleteIds.push(...toDelete)

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

        // Sync deletions + re-sync remaining items (codes of siblings changed)
        toDeleteIds.forEach(itemId => {
          syncDelete('wbs_items', itemId)
          // Auto-unlink all RAB items that pointed to this WBS node
          useRabWbsLinkStore.getState().unlinkByWbsId(itemId)
        })
        const remaining = get().itemsByProject[projectId] || []
        if (remaining.length > 0) syncWBSItems(remaining, projectId)
      },

      // Move item (drag & drop)
      moveItem: (projectId, itemId, newParentId, newIndex) => {
        set((state) => {
          const currentItems = state.itemsByProject[projectId] || []
          // Deep copy to avoid mutation issues
          const updatedItems = currentItems.map(item => ({ ...item }))

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

        // Sync all items — codes and sortOrders for multiple rows changed
        const movedItems = get().itemsByProject[projectId] || []
        syncWBSItems(movedItems, projectId)
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

        // Sync reordered items — sortOrders and codes changed
        const reorderedItems = get().itemsByProject[projectId] || []
        syncWBSItems(reorderedItems, projectId)
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

      // Import WBS structure — async: deletes all existing DB rows first to prevent accumulation
      importWBS: async (projectId, items) => {
        // Step 0: Clean up ALL junction links for this project's WBS items.
        // Without this, regenerating WBS creates orphan links (old wbs_item_ids no longer exist).
        const oldWbsItems = get().itemsByProject[projectId] || []
        if (oldWbsItems.length > 0 && supabase) {
          for (const wbs of oldWbsItems) {
            try {
              await supabase.rpc('rpc_unlink_wbs_node', { p_wbs_item_id: wbs.id })
            } catch { /* best effort */ }
          }
          // Also clear local link state for these WBS items
          const { linksByRabItem } = useRabWbsLinkStore.getState()
          const oldWbsIds = new Set(oldWbsItems.map(w => w.id))
          const cleaned: Record<string, import('../types/rabWbsLink').RabWbsLink[]> = {}
          for (const [rabId, links] of Object.entries(linksByRabItem)) {
            cleaned[rabId] = links.filter(l => !oldWbsIds.has(l.wbsItemId))
          }
          useRabWbsLinkStore.setState({ linksByRabItem: cleaned })
        }

        // Step 1: Delete ALL existing WBS rows for this project from Supabase.
        // This prevents the accumulation bug where repeated "Generate WBS" clicks
        // produce new IDs on each call, so old rows are never overwritten by upsert.
        if (supabase) {
          await supabase.from('wbs_items').delete().eq('project_id', projectId)
        }

        const now = new Date().toISOString()
        const newItems: WBSItem[] = items.map((item, index) => ({
          ...item,
          id: (item as WBSItem & { id?: string }).id || generateId('wbs'),
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

        // Step 2: Batch-upsert the new items to Supabase
        const finalItems = get().itemsByProject[projectId] || []
        syncWBSItems(finalItems, projectId)
      },

      // Export WBS structure
      exportWBS: (projectId) => {
        const items = get().itemsByProject[projectId] || []
        return sortHierarchy(items)
      },

      // Find all descendants of an item (recursive)
      findDescendants: (projectId, itemId) => {
        const items = get().itemsByProject[projectId] || []
        const descendants: WBSItem[] = []

        function collectDescendants(parentId: string) {
          const children = items.filter(item => item.parentId === parentId)
          children.forEach(child => {
            descendants.push(child)
            collectDescendants(child.id)
          })
        }

        collectDescendants(itemId)
        return descendants
      },

      // Load WBS items from Supabase
      fetchItems: async (projectId: string) => {
        if (!supabase) return
        set({ loading: true, error: null })
        const { data, error } = await supabase
          .from('wbs_items')
          .select('*')
          .eq('project_id', projectId)
          .order('sort_order', { ascending: true })
        if (error) {
          set({ loading: false, error: error.message })
          toast.error('Failed to load WBS', error.message)
          return
        }
        type WBSRow = { id: string; project_id: string; code: string; name: string; description?: string; level: number; parent_id: string | null; sort_order: number; qc_status?: string; progress?: number; created_at: string; updated_at: string }
        const items: WBSItem[] = ((data || []) as WBSRow[]).map((row) => ({
          id: row.id,
          projectId: row.project_id,
          code: row.code || '',
          name: row.name,
          description: row.description,
          level: row.level ?? 1,
          parentId: row.parent_id ?? null,
          sortOrder: row.sort_order ?? 0,
          qc_status: (row.qc_status as WBSItem['qc_status']) ?? 'NOT_REQUIRED',
          progress: row.progress ?? 0,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
        }))
        const finalItems = generateCodesForProject(items)
        set((state) => ({
          itemsByProject: { ...state.itemsByProject, [projectId]: finalItems },
          loading: false,
        }))
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
  const itemMap = new Map(items.map(item => [item.id, { ...item, children: [] as WBSItem[] }]))
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
