import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockFromFn = vi.fn()
const mockRpcFn = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
  supabase: null,
  assertSupabase: () => ({ from: mockFromFn, rpc: mockRpcFn }),
}))

import { costDashboardService } from '../../services/costDashboardService'

function makeChain(result: unknown) {
  const c: Record<string, unknown> = {}
  const methods = ['select', 'eq', 'order', 'limit', 'single', 'maybeSingle']
  methods.forEach(m => { c[m] = vi.fn().mockReturnValue(c) })
  ;(c as { then: unknown }).then = (res: (v: unknown) => unknown) =>
    Promise.resolve(result).then(res)
  return c
}

describe('costDashboardService', () => {
  beforeEach(() => vi.clearAllMocks())

  describe('getDashboardSnapshot', () => {
    it('returns all zero values when project has no data', async () => {
      mockFromFn.mockReturnValue(makeChain({ data: [], error: null }))
      const result = await costDashboardService.getDashboardSnapshot('proj-empty')
      expect(result.rabTotal).toBe(0)
      expect(result.rapPlanned).toBe(0)
      expect(result.actualCost).toBe(0)
      expect(result.costTypeBreakdown.material).toBe(0)
    })

    it('aggregates RAB cost types correctly', async () => {
      mockFromFn
        .mockReturnValueOnce(makeChain({
          data: [
            { final_total: 1000, cost_material: 400, cost_labor: 300,
              cost_equipment: 200, cost_subcon: 100, is_overhead: false },
            { final_total: 500, cost_material: 200, cost_labor: 150,
              cost_equipment: 100, cost_subcon: 50, is_overhead: false },
          ], error: null,
        }))
        .mockReturnValueOnce(makeChain({
          data: [{ total_budget: 1200, actual_cost: 300, committed_cost: 500 }], error: null
        }))
        .mockReturnValueOnce(makeChain({
          data: { meta: null }, error: null
        }))
        .mockReturnValueOnce(makeChain({
          data: { pv: 1000, ev: 900, ac: 300, cpi: 3.0, spi: 0.9 }, error: null
        }))

      const snap = await costDashboardService.getDashboardSnapshot('proj-1')
      expect(snap.rabTotal).toBe(1500)
      expect(snap.costTypeBreakdown.material).toBe(600)
      expect(snap.costTypeBreakdown.labor).toBe(450)
      expect(snap.rapPlanned).toBe(1200)
      expect(snap.actualCost).toBe(300)
      expect(snap.latestCpi).toBeCloseTo(3.0, 1)
      expect(snap.latestSpi).toBeCloseTo(0.9, 1)
    })

    it('correctly isolates overhead items from non-overhead items', async () => {
      mockFromFn
        .mockReturnValueOnce(makeChain({
          data: [
            { final_total: 800, cost_material: 800, cost_labor: 0, cost_equipment: 0, cost_subcon: 0, is_overhead: false },
            { final_total: 200, cost_material: 0, cost_labor: 0, cost_equipment: 0, cost_subcon: 0, is_overhead: true },
          ], error: null,
        }))
        .mockReturnValueOnce(makeChain({ data: [], error: null }))
        .mockReturnValueOnce(makeChain({ data: { meta: null }, error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: null }))

      const snap = await costDashboardService.getDashboardSnapshot('proj-overhead')
      expect(snap.rabTotal).toBe(1000)
      expect(snap.costTypeBreakdown.overhead).toBe(200)
      expect(snap.costTypeBreakdown.material).toBe(800)
    })

    it('computes burn rate as actualCost/rabTotal * 100', async () => {
      mockFromFn
        .mockReturnValueOnce(makeChain({
          data: [{ final_total: 1000, cost_material: 0, cost_labor: 0, cost_equipment: 0, cost_subcon: 0 }],
          error: null
        }))
        .mockReturnValueOnce(makeChain({
          data: [{ total_budget: 1000, actual_cost: 250, committed_cost: 100 }], error: null
        }))
        .mockReturnValueOnce(makeChain({ data: { meta: null }, error: null }))
        .mockReturnValueOnce(makeChain({ data: null, error: null }))

      const snap = await costDashboardService.getDashboardSnapshot('proj-2')
      expect(snap.burnRatePercent).toBeCloseTo(25, 1)
    })
  })
})
