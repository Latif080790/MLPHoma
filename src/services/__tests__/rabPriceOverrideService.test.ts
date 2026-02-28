import { beforeEach, describe, expect, it, vi } from 'vitest'

let tableResults: Record<string, any> = {}

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.single = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (table: string) => makeChain(tableResults[table] ?? { data: null, error: null }) }),
}))

vi.mock('../auditService', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}))

import { rabPriceOverrideService } from '../rabPriceOverrideService'

describe('rabPriceOverrideService', () => {
  beforeEach(() => {
    tableResults = {}
  })

  it('derives price source as override/snapshot/ahsp', async () => {
    tableResults.rab_items = {
      data: [
        { id: '1', name: 'Override Item', unit_price: 100, base_price: 100, snapshot_price: 110, final_price: 120 },
        { id: '2', name: 'Snapshot Item', unit_price: 200, base_price: 200, snapshot_price: 210, final_price: null },
        { id: '3', name: 'AHSP Item', unit_price: 300, base_price: 300, snapshot_price: null, final_price: null },
      ],
      error: null,
    }

    const rows = await rabPriceOverrideService.getPriceStatus('proj-1')
    expect(rows.find((r) => r.rabItemId === '1')?.source).toBe('override')
    expect(rows.find((r) => r.rabItemId === '2')?.source).toBe('snapshot')
    expect(rows.find((r) => r.rabItemId === '3')?.source).toBe('ahsp')
  })
})
