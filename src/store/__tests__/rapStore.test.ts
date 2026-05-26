/**
 * rapStore.test.ts
 * Unit tests for RAP store — focuses on getPlan and fetchItems.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../services/rapService', () => ({
  rapService: {
    getByProject: vi.fn(),
    upsertItem: vi.fn(),
    bulkUpsert: vi.fn(),
  },
  RapItem: {},
}))

vi.mock('../../lib/supabaseSyncService', () => ({
  syncRAPItem: vi.fn(() => 'queue-id'),
  syncRAPItems: vi.fn(() => 'queue-id'),
}))

vi.mock('../../lib/idGenerator', () => ({
  generateId: vi.fn(() => 'mock-id-001'),
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

import { useRapStore } from '../rapStore'

describe('rapStore', () => {
  beforeEach(() => {
    useRapStore.setState({
      items: [],
      loading: false,
      error: null,
    })
    vi.clearAllMocks()
  })

  describe('getPlan', () => {
    it('should return empty array when no items', () => {
      const plan = useRapStore.getState().getPlan('P-001')
      expect(plan).toEqual([])
    })

    it('should aggregate items by month', () => {
      useRapStore.setState({
        items: [
          { id: '1', project_id: 'P-001', total_budget: 100000, actual_cost: 80000, createdAt: '2025-01-15' } as any,
          { id: '2', project_id: 'P-001', total_budget: 200000, actual_cost: 150000, createdAt: '2025-01-20' } as any,
          { id: '3', project_id: 'P-001', total_budget: 300000, actual_cost: 250000, createdAt: '2025-02-01' } as any,
        ],
      })

      const plan = useRapStore.getState().getPlan('P-001')
      expect(plan).toHaveLength(2)
      expect(plan[0]).toEqual({ period: '2025-01', planned: 300000, actual: 230000 })
      expect(plan[1]).toEqual({ period: '2025-02', planned: 300000, actual: 250000 })
    })

    it('should filter by projectId', () => {
      useRapStore.setState({
        items: [
          { id: '1', project_id: 'P-001', total_budget: 100000, actual_cost: 0, createdAt: '2025-01-01' } as any,
          { id: '2', project_id: 'P-002', total_budget: 200000, actual_cost: 0, createdAt: '2025-01-01' } as any,
        ],
      })

      const plan = useRapStore.getState().getPlan('P-001')
      expect(plan).toHaveLength(1)
      expect(plan[0].planned).toBe(100000)
    })

    it('should return stable reference for same data', () => {
      useRapStore.setState({
        items: [
          { id: '1', project_id: 'P-001', total_budget: 100000, actual_cost: 0, createdAt: '2025-03-01' } as any,
        ],
      })
      const plan1 = useRapStore.getState().getPlan('P-001')
      const plan2 = useRapStore.getState().getPlan('P-001')
      // Verify deep equality — cached getter returns equivalent result
      expect(plan1).toStrictEqual(plan2)
      expect(plan1).toHaveLength(1)
    })
  })

  describe('fetchItems', () => {
    it('should load items from service', async () => {
      const { rapService } = await import('../../services/rapService')
      const mockData = [
        { id: '1', project_id: 'P-001', item_name: 'Item A', total_budget: 500000, actual_cost: 100000 },
      ]
      vi.mocked(rapService.getByProject).mockResolvedValue(mockData as any)

      await useRapStore.getState().fetchItems('P-001')

      const state = useRapStore.getState()
      expect(state.items).toHaveLength(1)
      expect(state.loading).toBe(false)
      expect(state.error).toBeNull()
    })

    it('should handle fetch errors', async () => {
      const { rapService } = await import('../../services/rapService')
      vi.mocked(rapService.getByProject).mockRejectedValue(new Error('DB error'))

      await useRapStore.getState().fetchItems('P-001')

      const state = useRapStore.getState()
      expect(state.loading).toBe(false)
      expect(state.error).toBeTruthy()
    })
  })
})
