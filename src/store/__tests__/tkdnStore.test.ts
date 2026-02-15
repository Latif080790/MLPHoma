/**
 * tkdnStore.test.ts
 * Unit tests for TKDN Zustand store.
 * Mocks tkdnService to test store logic in isolation.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useTKDNStore } from '../tkdnStore'
import type { TKDNItem } from '../../types/tkdn'

// Mock tkdnService
vi.mock('../../services/tkdnService', () => ({
  tkdnService: {
    getItems: vi.fn(),
    createItem: vi.fn(),
    updateItem: vi.fn(),
    deleteItem: vi.fn(),
    calculateSummary: vi.fn(() => ({
      project_id: 'P-001',
      total_domestic: 100,
      total_imported: 50,
      tkdn_percentage: 66.67,
      by_category: [],
      target_percentage: 40,
      meets_target: true,
      calculated_at: '2025-01-01',
    })),
  },
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

const mockItem: TKDNItem = {
  id: 'tkdn-001',
  project_id: 'P-001',
  name: 'Semen Portland',
  category: 'material',
  origin: 'domestic',
  unit: 'kg',
  quantity: 100,
  unit_price: 50000,
  total_value: 5_000_000,
  created_at: '2025-01-01',
  updated_at: '2025-01-01',
}

describe('tkdnStore', () => {
  beforeEach(() => {
    // Reset store to default state
    useTKDNStore.setState({
      items: [],
      summary: null,
      loading: false,
      targetPercentage: 40,
      _loadedProjectId: null,
    })
    vi.clearAllMocks()
  })

  it('should start with empty state', () => {
    const state = useTKDNStore.getState()
    expect(state.items).toEqual([])
    expect(state.summary).toBeNull()
    expect(state.loading).toBe(false)
    expect(state.targetPercentage).toBe(40)
  })

  it('should set target percentage and recalculate', () => {
    // Pre-populate items
    useTKDNStore.setState({ items: [mockItem] })

    useTKDNStore.getState().setTargetPercentage(60)
    const state = useTKDNStore.getState()
    expect(state.targetPercentage).toBe(60)
    expect(state.summary).not.toBeNull()
  })

  it('fetchItems should set loading and populate items', async () => {
    const { tkdnService } = await import('../../services/tkdnService')
    vi.mocked(tkdnService.getItems).mockResolvedValue([mockItem])

    await useTKDNStore.getState().fetchItems('P-001')

    const state = useTKDNStore.getState()
    expect(state.items).toHaveLength(1)
    expect(state.items[0].name).toBe('Semen Portland')
    expect(state.loading).toBe(false)
    expect(state._loadedProjectId).toBe('P-001')
  })

  it('fetchItems should handle errors gracefully', async () => {
    const { tkdnService } = await import('../../services/tkdnService')
    vi.mocked(tkdnService.getItems).mockRejectedValue(new Error('Network error'))

    await useTKDNStore.getState().fetchItems('P-001')

    const state = useTKDNStore.getState()
    expect(state.items).toEqual([])
    expect(state.loading).toBe(false)
  })

  it('addItem should append to items list', async () => {
    const { tkdnService } = await import('../../services/tkdnService')
    vi.mocked(tkdnService.createItem).mockResolvedValue(mockItem)

    const result = await useTKDNStore.getState().addItem({
      project_id: 'P-001',
      name: 'Semen Portland',
      category: 'material',
      origin: 'domestic',
      unit: 'kg',
      quantity: 100,
      unit_price: 50000,
    })

    expect(result).not.toBeNull()
    expect(useTKDNStore.getState().items).toHaveLength(1)
  })

  it('removeItem should optimistically remove and revert on error', async () => {
    // Pre-populate
    useTKDNStore.setState({ items: [mockItem] })

    const { tkdnService } = await import('../../services/tkdnService')
    vi.mocked(tkdnService.deleteItem).mockRejectedValue(new Error('Delete failed'))

    await useTKDNStore.getState().removeItem('tkdn-001')

    // Should revert back (1 item)
    const state = useTKDNStore.getState()
    expect(state.items).toHaveLength(1)
  })

  it('fetchItems should not run for empty projectId', async () => {
    const { tkdnService } = await import('../../services/tkdnService')
    await useTKDNStore.getState().fetchItems('')
    expect(tkdnService.getItems).not.toHaveBeenCalled()
  })
})
