import { beforeEach, describe, expect, it, vi } from 'vitest'

let tableResults: Record<string, any> = {}

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.not = () => c
  c.gt = () => c
  c.order = () => c
  c.single = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (table: string) => makeChain(tableResults[table] ?? { data: null, error: null, count: 0 }) }),
}))

vi.mock('../auditService', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}))

vi.mock('../notificationService', () => ({
  notificationService: { notifyByRole: vi.fn().mockResolvedValue(undefined) },
}))

import { ahspSnapshotService } from '../ahspSnapshotService'

describe('ahspSnapshotService', () => {
  beforeEach(() => {
    tableResults = {}
  })

  it('detects snapshot presence from count', async () => {
    tableResults.rab_items = { count: 2, data: null, error: null }
    const hasSnapshot = await ahspSnapshotService.hasSnapshot('p1')
    expect(hasSnapshot).toBe(true)
  })

  it('calculates and sorts price drift by impact', async () => {
    tableResults.rab_items = {
      data: [
        { id: '1', name: 'Item A', volume: 10, snapshot_price: { total: 100 }, ahsp_items: { base_price: 150 } },
        { id: '2', name: 'Item B', volume: 1, snapshot_price: { total: 200 }, ahsp_items: { base_price: 210 } },
      ],
      error: null,
    }

    const drifts = await ahspSnapshotService.getPriceDrift('p1')
    expect(drifts).toHaveLength(2)
    expect(drifts[0].rabItemId).toBe('1')
    expect(drifts[0].impactOnBudget).toBeGreaterThan(drifts[1].impactOnBudget)
  })
})
