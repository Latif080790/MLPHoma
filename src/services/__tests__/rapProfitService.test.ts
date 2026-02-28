import { beforeEach, describe, expect, it, vi } from 'vitest'

let tableResults: Record<string, any> = {}

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.single = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (table: string) => makeChain(tableResults[table] ?? { data: null, error: null }) }),
}))

vi.mock('../notificationService', () => ({
  notificationService: { notifyByRole: vi.fn().mockResolvedValue(undefined) },
}))

import { rapProfitService } from '../rapProfitService'

describe('rapProfitService', () => {
  beforeEach(() => {
    tableResults = {}
  })

  it('falls back to 10% when target profit is not configured', async () => {
    tableResults.projects = { data: { target_profit_pct: null }, error: null }
    const pct = await rapProfitService.getTargetProfitPct('p1')
    expect(pct).toBe(10)
  })

  it('aggregates equipment rent costs correctly', async () => {
    tableResults.tools_usage_logs = {
      data: [
        { resource_id: 'r1', log_date: '2026-02-01', status: 'USED', hours_used: 5, rent_cost: 200000 },
        { resource_id: 'r2', log_date: '2026-02-02', status: 'USED', hours_used: 8, rent_cost: 350000 },
      ],
      error: null,
    }

    const costs = await rapProfitService.getEquipmentCosts('p1')
    expect(costs.total).toBe(550000)
    expect(costs.breakdown).toHaveLength(2)
  })
})
