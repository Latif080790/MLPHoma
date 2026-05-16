/**
 * changeOrderCascade.test.ts
 * Unit tests for the VO approval cascade logic.
 * Mocks Supabase, notificationService, and auditService.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so that mock variables are available inside vi.mock factories
const { mockFrom, mockRpc, mockNotify, mockAuditLog } = vi.hoisted(() => {
  const mockFrom = vi.fn()
  const mockRpc = vi.fn()
  const mockNotify = vi.fn().mockResolvedValue(undefined)
  const mockAuditLog = vi.fn().mockResolvedValue(undefined)
  return { mockFrom, mockRpc, mockNotify, mockAuditLog }
})

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: mockFrom, rpc: mockRpc }),
  supabase: { from: mockFrom, rpc: mockRpc },
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
    const makeRpcSuccess = (overrides: Partial<{
      rabItemsUpdated: number
      timelineTasksUpdated: number
      budgetDelta: number
      scheduleDelta: number
      projectId: string
    }> = {}) => ({
      data: {
        rabItemsUpdated: 2,
        timelineTasksUpdated: 2,
        budgetDelta: 20_000_000,
        scheduleDelta: 10,
        success: true,
        projectId: PROJECT_ID,
        ...overrides,
      },
      error: null,
    })

    it('should return cascade result from RPC with RAB and budget updates', async () => {
      mockRpc.mockResolvedValue(makeRpcSuccess())

      const result: CascadeResult = await changeOrderCascade.execute(ORDER_ID)

      expect(mockRpc).toHaveBeenCalledWith('rpc_execute_cco_cascade', { v_change_order_id: ORDER_ID })
      expect(result.rabItemsUpdated).toBe(2)
      expect(result.budgetDelta).toBe(20_000_000)
      expect(result.errors.length).toBe(0)
    })

    it('should return timeline and schedule delta from RPC', async () => {
      mockRpc.mockResolvedValue(makeRpcSuccess({ timelineTasksUpdated: 2, scheduleDelta: 10 }))

      const result = await changeOrderCascade.execute(ORDER_ID)

      expect(result.timelineTasksUpdated).toBe(2)
      expect(result.scheduleDelta).toBe(10)
    })

    it('should send notification after successful RPC', async () => {
      mockRpc.mockResolvedValue(makeRpcSuccess())

      await changeOrderCascade.execute(ORDER_ID)

      expect(mockNotify).toHaveBeenCalledWith(
        '',
        'manager',
        expect.objectContaining({ type: 'CHANGE_ORDER' })
      )
    })

    it('should write audit log after successful RPC', async () => {
      mockRpc.mockResolvedValue(makeRpcSuccess())

      await changeOrderCascade.execute(ORDER_ID)

      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'APPROVE',
          entity: 'change_orders',
          entityId: ORDER_ID,
        })
      )
    })

    it('should throw when RPC returns an error', async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: 'DB error' } })

      await expect(changeOrderCascade.execute(ORDER_ID)).rejects.toThrow('Cascade failed: DB error')
    })

    it('should throw when RPC reports success=false', async () => {
      mockRpc.mockResolvedValue({
        data: { success: false, error: 'No RAB item found for wbs-A', rabItemsUpdated: 0, timelineTasksUpdated: 0, budgetDelta: 0, scheduleDelta: 0 },
        error: null,
      })

      await expect(changeOrderCascade.execute(ORDER_ID)).rejects.toThrow()
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
