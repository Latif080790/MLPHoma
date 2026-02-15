/**
 * changeOrderCascade.test.ts
 * Unit tests for the VO approval cascade logic.
 * Mocks Supabase, notificationService, and auditService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so that mock variables are available inside vi.mock factories
const { mockFrom, mockNotify, mockAuditLog } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockNotify = vi.fn().mockResolvedValue(undefined)
  const mockAuditLog = vi.fn().mockResolvedValue(undefined)
  return { mockFrom, mockNotify, mockAuditLog }
})

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: mockFrom }),
  supabase: { from: mockFrom },
}))

vi.mock('../notificationService', () => ({
  notificationService: { notifyByRole: mockNotify },
}))

vi.mock('../auditService', () => ({
  auditService: { log: mockAuditLog },
}))

import { changeOrderCascade, CascadeResult } from '../changeOrderCascade'

let updateCalls: { table: string; data: any; id: string }[]

// ---------- Fixtures ----------

const ORDER_ID = 'co-001'
const PROJECT_ID = 'proj-001'

const mockOrder = {
  id: ORDER_ID,
  project_id: PROJECT_ID,
  vo_number: 'VO-001',
  title: 'Add foundation',
  status: 'APPROVED',
  cost_impact: 50_000_000,
  schedule_impact_days: 10,
}

const mockItems = [
  {
    id: 'coi-01',
    change_order_id: ORDER_ID,
    item_description: 'Extra pile caps',
    volume_delta: 20,
    unit_price: 500_000,
    total_delta: 10_000_000,
    target_wbs_id: 'wbs-A',
  },
  {
    id: 'coi-02',
    change_order_id: ORDER_ID,
    item_description: 'Steel reinforcement',
    volume_delta: 5,
    unit_price: 2_000_000,
    total_delta: 10_000_000,
    target_wbs_id: 'wbs-B',
  },
]

const mockRabA = { id: 'rab-A', volume: 100, unit_price: 500_000, total_price: 50_000_000 }
const mockRabB = { id: 'rab-B', volume: 50, unit_price: 2_000_000, total_price: 100_000_000 }

const mockTasks = [
  { id: 'task-1', end_date: '2025-06-01', duration_days: 30 },
  { id: 'task-2', end_date: '2025-07-15', duration_days: 45 },
]

const mockProject = { total_budget: 1_000_000_000 }

// ---------- Tests ----------

describe('changeOrderCascade', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    updateCalls = []
  })

  describe('execute()', () => {
    it('should update RAB items for each CO item with target_wbs_id', async () => {
      // Setup mock chain: first call = order, second = items, then per-item rab lookups, timeline, project
      let fromCallIndex = 0
      mockFrom.mockImplementation((table: string) => {
        const makeChain = (result: any) => {
          const c: any = {}
          c.select = () => c
          c.eq = () => c
          c.in = () => c
          c.order = () => c
          c.limit = () => c
          c.single = () => Promise.resolve(result)
          c.maybeSingle = () => Promise.resolve(result)
          c.update = (data: any) => ({
            eq: (_col: string, id: string) => {
              updateCalls.push({ table, data, id })
              return Promise.resolve({ error: null })
            },
          })
          c.then = (res: any) => Promise.resolve(result).then(res)
          return c
        }

        if (table === 'change_orders') {
          return makeChain({ data: mockOrder, error: null })
        }
        if (table === 'change_order_items') {
          return makeChain({ data: mockItems, error: null })
        }
        if (table === 'rab_items') {
          fromCallIndex++
          if (fromCallIndex <= 1) return makeChain({ data: mockRabA, error: null })
          return makeChain({ data: mockRabB, error: null })
        }
        if (table === 'timeline_tasks') {
          return makeChain({ data: mockTasks, error: null })
        }
        if (table === 'projects') {
          return makeChain({ data: mockProject, error: null })
        }
        return makeChain({ data: null, error: null })
      })

      const result: CascadeResult = await changeOrderCascade.execute(ORDER_ID)

      expect(result.rabItemsUpdated).toBe(2)
      expect(result.budgetDelta).toBe(20_000_000)
      expect(result.errors.length).toBe(0)
    })

    it('should update timeline tasks when schedule_impact_days > 0', async () => {
      let fromCallIndex = 0
      mockFrom.mockImplementation((table: string) => {
        const makeChain = (result: any) => {
          const c: any = {}
          c.select = () => c
          c.eq = () => c
          c.in = () => c
          c.order = () => c
          c.limit = () => c
          c.single = () => Promise.resolve(result)
          c.maybeSingle = () => Promise.resolve(result)
          c.update = (data: any) => ({
            eq: (_col: string, id: string) => {
              updateCalls.push({ table, data, id })
              return Promise.resolve({ error: null })
            },
          })
          c.then = (res: any) => Promise.resolve(result).then(res)
          return c
        }

        if (table === 'change_orders') return makeChain({ data: mockOrder, error: null })
        if (table === 'change_order_items') return makeChain({ data: mockItems, error: null })
        if (table === 'rab_items') {
          fromCallIndex++
          return makeChain({ data: fromCallIndex <= 1 ? mockRabA : mockRabB, error: null })
        }
        if (table === 'timeline_tasks') return makeChain({ data: mockTasks, error: null })
        if (table === 'projects') return makeChain({ data: mockProject, error: null })
        return makeChain({ data: null, error: null })
      })

      const result = await changeOrderCascade.execute(ORDER_ID)

      expect(result.timelineTasksUpdated).toBe(2)
      expect(result.scheduleDelta).toBe(10)

      // Check timeline update calls
      const timelineUpdates = updateCalls.filter(c => c.table === 'timeline_tasks')
      expect(timelineUpdates.length).toBe(2)
      expect(timelineUpdates[0].data.duration_days).toBe(40) // 30 + 10
      expect(timelineUpdates[1].data.duration_days).toBe(55) // 45 + 10
    })

    it('should update project total_budget', async () => {
      let fromCallIndex = 0
      mockFrom.mockImplementation((table: string) => {
        const makeChain = (result: any) => {
          const c: any = {}
          c.select = () => c
          c.eq = () => c
          c.in = () => c
          c.order = () => c
          c.limit = () => c
          c.single = () => Promise.resolve(result)
          c.maybeSingle = () => Promise.resolve(result)
          c.update = (data: any) => ({
            eq: (_col: string, id: string) => {
              updateCalls.push({ table, data, id })
              return Promise.resolve({ error: null })
            },
          })
          c.then = (res: any) => Promise.resolve(result).then(res)
          return c
        }

        if (table === 'change_orders') return makeChain({ data: mockOrder, error: null })
        if (table === 'change_order_items') return makeChain({ data: mockItems, error: null })
        if (table === 'rab_items') {
          fromCallIndex++
          return makeChain({ data: fromCallIndex <= 1 ? mockRabA : mockRabB, error: null })
        }
        if (table === 'timeline_tasks') return makeChain({ data: mockTasks, error: null })
        if (table === 'projects') return makeChain({ data: mockProject, error: null })
        return makeChain({ data: null, error: null })
      })

      await changeOrderCascade.execute(ORDER_ID)

      const projUpdates = updateCalls.filter(c => c.table === 'projects')
      expect(projUpdates.length).toBe(1)
      expect(projUpdates[0].data.total_budget).toBe(1_020_000_000) // 1B + 20M
    })

    it('should send notification and audit log', async () => {
      let fromCallIndex = 0
      mockFrom.mockImplementation((table: string) => {
        const makeChain = (result: any) => {
          const c: any = {}
          c.select = () => c
          c.eq = () => c
          c.in = () => c
          c.order = () => c
          c.limit = () => c
          c.single = () => Promise.resolve(result)
          c.maybeSingle = () => Promise.resolve(result)
          c.update = (data: any) => ({
            eq: (_col: string, id: string) => {
              updateCalls.push({ table, data, id })
              return Promise.resolve({ error: null })
            },
          })
          c.then = (res: any) => Promise.resolve(result).then(res)
          return c
        }

        if (table === 'change_orders') return makeChain({ data: mockOrder, error: null })
        if (table === 'change_order_items') return makeChain({ data: mockItems, error: null })
        if (table === 'rab_items') {
          fromCallIndex++
          return makeChain({ data: fromCallIndex <= 1 ? mockRabA : mockRabB, error: null })
        }
        if (table === 'timeline_tasks') return makeChain({ data: mockTasks, error: null })
        if (table === 'projects') return makeChain({ data: mockProject, error: null })
        return makeChain({ data: null, error: null })
      })

      await changeOrderCascade.execute(ORDER_ID)

      expect(mockNotify).toHaveBeenCalledWith(
        PROJECT_ID,
        'manager',
        expect.objectContaining({ type: 'CHANGE_ORDER' })
      )
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPROVE',
          entity: 'change_orders',
          entityId: ORDER_ID,
        })
      )
    })

    it('should collect errors when RAB item is not found', async () => {
      mockFrom.mockImplementation((table: string) => {
        const makeChain = (result: any) => {
          const c: any = {}
          c.select = () => c
          c.eq = () => c
          c.in = () => c
          c.order = () => c
          c.limit = () => c
          c.single = () => Promise.resolve(result)
          c.maybeSingle = () => Promise.resolve(result)
          c.update = (data: any) => ({
            eq: (_col: string, id: string) => {
              updateCalls.push({ table, data, id })
              return Promise.resolve({ error: null })
            },
          })
          c.then = (res: any) => Promise.resolve(result).then(res)
          return c
        }

        if (table === 'change_orders') return makeChain({ data: mockOrder, error: null })
        if (table === 'change_order_items') return makeChain({ data: mockItems, error: null })
        if (table === 'rab_items') return makeChain({ data: null, error: null }) // no RAB found
        if (table === 'timeline_tasks') return makeChain({ data: [], error: null })
        if (table === 'projects') return makeChain({ data: mockProject, error: null })
        return makeChain({ data: null, error: null })
      })

      const result = await changeOrderCascade.execute(ORDER_ID)

      expect(result.rabItemsUpdated).toBe(0)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('No RAB item found')
    })

    it('should throw when change order is not found', async () => {
      mockFrom.mockImplementation(() => {
        const c: any = {}
        c.select = () => c
        c.eq = () => c
        c.single = () => Promise.resolve({ data: null, error: { message: 'not found' } })
        return c
      })

      await expect(changeOrderCascade.execute('nonexistent')).rejects.toThrow()
    })
  })

  describe('preview()', () => {
    it('should return affected counts and estimated deltas', async () => {
      mockFrom.mockImplementation((table: string) => {
        const makeChain = (result: any) => {
          const c: any = {}
          c.select = () => c
          c.eq = () => c
          c.in = () => c
          c.order = () => c
          c.limit = () => c
          c.single = () => Promise.resolve(result)
          c.maybeSingle = () => Promise.resolve(result)
          c.then = (res: any) => Promise.resolve(result).then(res)
          return c
        }

        if (table === 'change_orders') return makeChain({ data: mockOrder, error: null })
        if (table === 'change_order_items') return makeChain({ data: mockItems, error: null })
        if (table === 'timeline_tasks') return makeChain({ data: null, error: null, count: 3 })
        return makeChain({ data: null, error: null })
      })

      const preview = await changeOrderCascade.preview(ORDER_ID)

      expect(preview.affectedRabItems).toBe(2) // 2 items with target_wbs_id
      expect(preview.estimatedBudgetDelta).toBe(20_000_000) // 10M + 10M
      expect(preview.estimatedScheduleDelta).toBe(10)
      expect(preview.affectedTasks).toBe(3)
    })

    it('should throw when order not found', async () => {
      mockFrom.mockImplementation(() => {
        const c: any = {}
        c.select = () => c
        c.eq = () => c
        c.single = () => Promise.resolve({ data: null, error: null })
        return c
      })

      await expect(changeOrderCascade.preview('nope')).rejects.toThrow('Change Order not found')
    })
  })
})
