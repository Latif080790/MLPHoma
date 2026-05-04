/**
 * wbsStore.test.ts
 * Comprehensive tests for WBS Store
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useWBSStore, validateWBS } from '../wbsStore'
import type { WBSItem } from '@/types/wbs'
import * as supabaseSyncService from '@/lib/supabaseSyncService'
import * as toast from '@/lib/toast'

// Mock dependencies
vi.mock('@/lib/supabaseSyncService', () => ({
  syncWBSItem: vi.fn().mockResolvedValue({ success: true }),
  syncDelete: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/toast', () => {
  const mockNotify = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }
  return {
    notify: mockNotify,
    default: mockNotify,
  }
})

describe('wbsStore', () => {
  beforeEach(() => {
    // Reset store completely before each test
    useWBSStore.setState({
      itemsByProject: {},
      selectedId: null,
      expandedIds: new Set(),
      loading: false,
      error: null,
    })
    vi.clearAllMocks()
  })

  describe('addItem', () => {
    it('should add a root-level WBS item', () => {
      const projectId = 'test-project'
      
      const newItem = {
        projectId,
        code: '1',
        name: 'Phase 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      }

      // Call addItem
      useWBSStore.getState().addItem(projectId, newItem)
      
      // Get fresh state after action
      const items = useWBSStore.getState().itemsByProject[projectId] || []

      expect(items).toHaveLength(1)
      expect(items[0].name).toBe('Phase 1')
      expect(items[0].level).toBe(1)
      expect(items[0].parentId).toBeNull()
      expect(items[0].id).toBeDefined()
      expect(supabaseSyncService.syncWBSItem).toHaveBeenCalled()
    })

    it('should add a child WBS item', () => {
      const projectId = 'test-project'

      // Add parent
      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1',
        name: 'Phase 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const parentItem = useWBSStore.getState().itemsByProject[projectId][0]

      // Add child
      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1.1',
        name: 'Task 1.1',
        level: 2,
        parentId: parentItem.id,
        sortOrder: 0,
      })

      const items = useWBSStore.getState().itemsByProject[projectId]
      expect(items).toHaveLength(2)
      
      const child = items.find(i => i.code === '1.1')
      expect(child).toBeDefined()
      expect(child!.parentId).toBe(parentItem.id)
      expect(child!.level).toBe(2)
    })

    it('should validate required fields', () => {
      const projectId = 'test-project'

      const invalidItem = {
        projectId,
        code: '',  // Invalid: empty code
        name: '',  // Invalid: empty name
        level: 1,
        parentId: null,
        sortOrder: 0,
      }

      useWBSStore.getState().addItem(projectId, invalidItem as any)
      
      const items = useWBSStore.getState().itemsByProject[projectId] || []
      expect(items).toHaveLength(0)  // Should not add invalid item
      expect(toast.notify.error).toHaveBeenCalled()
    })

    it('should generate unique IDs for each item', () => {
      const projectId = 'test-project'

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1',
        name: 'Item 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '2',
        name: 'Item 2',
        level: 1,
        parentId: null,
        sortOrder: 1,
      })

      const items = useWBSStore.getState().itemsByProject[projectId]
      expect(items[0].id).not.toBe(items[1].id)
    })
  })

  describe('updateItem', () => {
    it('should update WBS item properties', () => {
      const projectId = 'test-project'

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1',
        name: 'Original Name',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const item = useWBSStore.getState().itemsByProject[projectId][0]

      useWBSStore.getState().updateItem(projectId, item.id, {
        name: 'Updated Name',
        description: 'New description',
      })

      const updatedItem = useWBSStore.getState().itemsByProject[projectId].find(i => i.id === item.id)
      expect(updatedItem?.name).toBe('Updated Name')
      expect(updatedItem?.description).toBe('New description')
    })

    it('should not update non-existent item', () => {
      const projectId = 'test-project'

      useWBSStore.getState().updateItem(projectId, 'non-existent-id', {
        name: 'Should not update',
      })

      const items = useWBSStore.getState().itemsByProject[projectId] || []
      expect(items).toHaveLength(0)
    })

    it('should validate update data', () => {
      const projectId = 'test-project'

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1',
        name: 'Item 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const item = useWBSStore.getState().itemsByProject[projectId][0]

      // Invalid level (negative)
      useWBSStore.getState().updateItem(projectId, item.id, {
        level: -1,  // Should be rejected
      })

      const updatedItem = useWBSStore.getState().itemsByProject[projectId].find(i => i.id === item.id)
      expect(updatedItem?.level).toBe(1)  // Should remain unchanged
    })
  })

  describe('deleteItem', () => {
    it('should delete a WBS item', () => {
      const projectId = 'test-project'

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1',
        name: 'Item to delete',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const item = useWBSStore.getState().itemsByProject[projectId][0]
      useWBSStore.getState().deleteItem(projectId, item.id)

      const items = useWBSStore.getState().itemsByProject[projectId] || []
      expect(items).toHaveLength(0)
      expect(supabaseSyncService.syncDelete).toHaveBeenCalled()
    })

    it('should delete item and all descendants', () => {
      const projectId = 'test-project'

      // Add parent
      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1',
        name: 'Parent',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const parent = useWBSStore.getState().itemsByProject[projectId][0]

      // Add children
      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1.1',
        name: 'Child 1',
        level: 2,
        parentId: parent.id,
        sortOrder: 0,
      })

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1.2',
        name: 'Child 2',
        level: 2,
        parentId: parent.id,
        sortOrder: 1,
      })

      expect(useWBSStore.getState().itemsByProject[projectId]).toHaveLength(3)

      // Delete parent (should delete children too)
      useWBSStore.getState().deleteItem(projectId, parent.id)

      const items = useWBSStore.getState().itemsByProject[projectId] || []
      expect(items).toHaveLength(0)  // All descendants should be deleted
    })
  })

  describe('findDescendants', () => {
    it('should find all descendants of an item', () => {
      const projectId = 'test-project'

      // Create tree structure
      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1',
        name: 'Root',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const item1 = useWBSStore.getState().itemsByProject[projectId][0]

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1.1',
        name: 'Item 1.1',
        level: 2,
        parentId: item1.id,
        sortOrder: 0,
      })

      const child1 = useWBSStore.getState().itemsByProject[projectId].find(i => i.code === '1.1')!

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1.1.1',
        name: 'Item 1.1.1',
        level: 3,
        parentId: child1.id,
        sortOrder: 0,
      })

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1.2',
        name: 'Item 1.2',
        level: 2,
        parentId: item1.id,
        sortOrder: 1,
      })

      // Use findDescendants method from store
      const descendants = useWBSStore.getState().findDescendants(projectId, item1.id)
      expect(descendants).toHaveLength(3)  // 1.1, 1.1.1, 1.2
    })
  })

  describe('validateWBS', () => {
    it('should validate WBS structure', () => {
      const projectId = 'test-project'

      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: '1',
        name: 'Valid Item',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      const items = useWBSStore.getState().itemsByProject[projectId] || []
      const validation = validateWBS(items)

      expect(validation.isValid).toBe(true)
      expect(validation.errors).toHaveLength(0)
    })

    it('should auto-generate codes for items', () => {
      const projectId = 'test-project'

      // Add first root item
      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: 'will-be-overwritten',
        name: 'Item 1',
        level: 1,
        parentId: null,
        sortOrder: 0,
      })

      // Add second root item
      useWBSStore.getState().addItem(projectId, {
        projectId,
        code: 'will-be-overwritten',
        name: 'Item 2',
        level: 1,
        parentId: null,
        sortOrder: 1,
      })

      // Codes should be auto-generated as '1' and '2'
      const items = useWBSStore.getState().itemsByProject[projectId] || []
      expect(items.length).toBe(2)
      
      const codes = items.map(i => i.code).sort()
      expect(codes).toEqual(['1', '2'])
    })

    it('should detect invalid parent references', () => {
      const projectId = 'test-project'

      // Manually create item with invalid parent (bypass store validation)
      const invalidItem: WBSItem = {
        id: 'invalid-id',
        projectId,
        code: '1',
        name: 'Invalid Item',
        level: 1,
        parentId: 'non-existent-parent',  // Invalid parent
        sortOrder: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      useWBSStore.setState({
        itemsByProject: {
          [projectId]: [invalidItem],
        },
      })

      const items = useWBSStore.getState().itemsByProject[projectId] || []
      const validation = validateWBS(items)
      
      expect(validation.isValid).toBe(false)
      expect(validation.errors.some(e => e.includes('Invalid parent'))).toBe(true)
    })
  })
})
