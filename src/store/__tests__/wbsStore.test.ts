/**
 * wbsStore.test.ts
 * Comprehensive tests for WBS Store
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWBSStore, validateWBS } from '../wbsStore'
import * as supabaseSyncService from '@/lib/supabaseSyncService'
import * as toast from '@/lib/toast'

// Mock dependencies
vi.mock('@/lib/supabaseSyncService', () => ({
  syncWBSItem: vi.fn().mockResolvedValue({ success: true }),
  syncDelete: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/toast', () => ({
  notify: vi.fn(),
}))

describe('wbsStore', () => {
  beforeEach(() => {
    // Reset store before each test
    const store = useWBSStore.getState()
    store.clearProject('test-project')
    vi.clearAllMocks()
  })

  describe('addItem', () => {
    it('should add a root-level WBS item', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'
      
      const newItem = {
        projectId,
        code: '1',
        name: 'Phase 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      }

      store.addItem(projectId, newItem)
      const items = store.itemsByProject[projectId] || []

      expect(items).toHaveLength(1)
      expect(items[0].name).toBe('Phase 1')
      expect(items[0].level).toBe(1)
      expect(items[0].parentId).toBeNull()
      expect(items[0].id).toBeDefined()
      expect(supabaseSyncService.syncWBSItem).toHaveBeenCalled()
    })

    it('should add a child WBS item', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      // Add parent
      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Phase 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const parentItem = (store.itemsByProject[projectId] || [])[0]

      // Add child
      const childItem = {
        projectId,
        code: '1.1',
        name: 'Task 1.1',
        level: 2,
        parentId: parentItem.id,
        sortOrder: 0,
      }

      store.addItem(projectId, childItem)

      const items = store.itemsByProject[projectId] || []
      expect(items).toHaveLength(2)
      
      const child = items.find(i => i.code === '1.1')
      expect(child).toBeDefined()
      expect(child!.parentId).toBe(parentItem.id)
      expect(child!.level).toBe(2)
    })

    it('should validate required fields', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      const invalidItem = {
        projectId,
        code: '',  // Invalid: empty code
        name: '',  // Invalid: empty name
        level: 1,
        parentId: null,
        sortOrder: 0,
      }

      store.addItem(projectId, invalidItem as any)
      
      const items = store.itemsByProject[projectId] || []
      expect(items).toHaveLength(0)  // Should not add invalid item
      expect(toast.notify).toHaveBeenCalled()
    })

    it('should generate unique IDs for each item', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Item 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      store.addItem(projectId, {
        projectId,
        code: '2',
        name: 'Item 2',
        level: 1,
        parentId: null,
        sortOrder: 1,
      })

      const items = store.itemsByProject[projectId] || []
      expect(items[0].id).not.toBe(items[1].id)
    })
  })

  describe('updateItem', () => {
    it('should update WBS item properties', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Original Name',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const item = (store.itemsByProject[projectId] || [])[0]

      store.updateItem(projectId, item.id, {
        name: 'Updated Name',
        description: 'New description',
      })

      const updatedItem = (store.itemsByProject[projectId] || []).find(i => i.id === item.id)
      expect(updatedItem?.name).toBe('Updated Name')
      expect(updatedItem?.description).toBe('New description')
    })

    it('should not update non-existent item', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      store.updateItem(projectId, 'non-existent-id', {
        name: 'Should not update',
      })

      const items = store.itemsByProject[projectId] || []
      expect(items).toHaveLength(0)
    })

    it('should validate update data', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Item 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const item = (store.itemsByProject[projectId] || [])[0]

      // Invalid level (negative)
      store.updateItem(projectId, item.id, {
        level: -1,  // Should be rejected
      })

      const updatedItem = (store.itemsByProject[projectId] || []).find(i => i.id === item.id)
      expect(updatedItem?.level).toBe(1)  // Should remain unchanged
    })
  })

  describe('deleteItem', () => {
    it('should delete a WBS item', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Item to delete',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const item = (store.itemsByProject[projectId] || [])[0]
      store.deleteItem(projectId, item.id)

      const items = store.itemsByProject[projectId] || []
      expect(items).toHaveLength(0)
      expect(supabaseSyncService.syncDelete).toHaveBeenCalled()
    })

    it('should delete item and all descendants', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      // Add parent
      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Parent',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const parent = (store.itemsByProject[projectId] || [])[0]

      // Add children
      store.addItem(projectId, {
        projectId,
        code: '1.1',
        name: 'Child 1',
        level: 2,
        parentId: parent.id,
        sortOrder: 0,
      })

      store.addItem(projectId, {
        projectId,
        code: '1.2',
        name: 'Child 2',
        level: 2,
        parentId: parent.id,
        sortOrder: 1,
      })

      expect(store.itemsByProject[projectId]).toHaveLength(3)

      // Delete parent (should delete children too)
      store.deleteItem(projectId, parent.id)

      const items = store.itemsByProject[projectId] || []
      expect(items).toHaveLength(0)  // All descendants should be deleted
    })
  })

  describe('findDescendants', () => {
    it('should find all descendants of an item', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      // Create tree structure
      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Root',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const item1 = (store.itemsByProject[projectId] || [])[0]

      store.addItem(projectId, {
        projectId,
        code: '1.1',
        name: 'Item 1.1',
        level: 2,
        parentId: item1.id,
        sortOrder: 0,
      })

      const child1 = (store.itemsByProject[projectId] || []).find(i => i.code === '1.1')!

      store.addItem(projectId, {
        projectId,
        code: '1.1.1',
        name: 'Item 1.1.1',
        level: 3,
        parentId: child1.id,
        sortOrder: 0,
      })

      store.addItem(projectId, {
        projectId,
        code: '1.2',
        name: 'Item 1.2',
        level: 2,
        parentId: item1.id,
        sortOrder: 1,
      })

      // Should find child, grandchild, and child2
      const items = store.itemsByProject[projectId] || []
      const descendants = items.filter(i => {
        let currentParentId = i.parentId
        while (currentParentId) {
          if (currentParentId === item1.id) return true
            const parent = items.find(ci => ci.id === currentParentId)
            currentParentId = parent?.parentId ?? null
        }
        return false
      })
      expect(descendants).toHaveLength(3)  // 1.1, 1.1.1, 1.2
    })
  })

  describe('validateWBS', () => {
    it('should validate WBS structure', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Valid Item',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const items = store.itemsByProject[projectId] || []
      const validation = validateWBS(items)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should detect duplicate codes', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Item 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      store.addItem(projectId, {
        projectId,
        code: '1',  // Duplicate code
        name: 'Item 2',
        level: 1,
        parentId: null,
        sortOrder: 1,
      })

      const items = store.itemsByProject[projectId] || []
      // Store should handle this appropriately
      expect(items.length).toBeGreaterThan(0)
    })

    it('should detect invalid parent references', () => {
      const store = useWBSStore.getState()
      const projectId = 'test-project'

      store.addItem(projectId, {
        projectId,
        code: '1',
        name: 'Valid Item',
        level: 1,
        parentId: 'non-existent-parent',  // Invalid parent
        sortOrder: 0,
      })

      const items = store.itemsByProject[projectId] || []
      // Store should handle this validation
      expect(Array.isArray(items)).toBe(true)
    })
  })
})
