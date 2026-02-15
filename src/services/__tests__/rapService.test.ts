/**
 * rapService.test.ts
 * Unit tests for RAP CRUD + initFromRab.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockFromImpl: (table: string) => any

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFromImpl(t) }),
}))

import { rapService } from '../rapService'

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.limit = () => c
  c.single = () => Promise.resolve(result)
  c.upsert = () => c
  c.insert = () => c
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

describe('rapService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getByProject', () => {
    it('should return RAP items with joins', async () => {
      const rows = [
        { id: 'r1', qty_budget: 100, unit_price_budget: 5000, wbs_items: { name: 'Foundation', code: 'WBS-01' } },
        { id: 'r2', qty_budget: 50, unit_price_budget: 10000, ahsp_items: { name: 'Semen', unit: 'kg' } },
      ]
      mockFromImpl = () => makeChain({ data: rows, error: null })

      const result = await rapService.getByProject('P1')
      expect(result).toHaveLength(2)
      expect(result[0].wbs_items.name).toBe('Foundation')
    })

    it('should throw on error', async () => {
      mockFromImpl = () => makeChain({ data: null, error: new Error('DB fail') })
      await expect(rapService.getByProject('P1')).rejects.toThrow()
    })
  })

  describe('upsert', () => {
    it('should upsert and return single item', async () => {
      const item = { id: 'r1', project_id: 'P1', qty_budget: 200, unit_price_budget: 5000 }
      mockFromImpl = () => makeChain({ data: item, error: null })

      const result = await rapService.upsert(item)
      expect(result.id).toBe('r1')
      expect(result.qty_budget).toBe(200)
    })

    it('should throw on upsert error', async () => {
      mockFromImpl = () => makeChain({ data: null, error: new Error('conflict') })
      await expect(rapService.upsert({ id: 'x' })).rejects.toThrow()
    })
  })

  describe('initFromRab', () => {
    it('should map RAB items to RAP structure and insert', async () => {
      let insertedData: any = null
      mockFromImpl = () => ({
        insert: (data: any) => {
          insertedData = data
          return {
            select: () => Promise.resolve({ data, error: null }),
            then: (res: any) => Promise.resolve({ data, error: null }).then(res),
          }
        },
      })

      const rabItems = [
        { id: 'rab-1', wbs_id: 'w1', volume: 100, unit_price: 5000, cost_material: 3000, cost_labor: 1000, cost_equipment: 500, cost_subcon: 500 },
        { id: 'rab-2', wbs_id: 'w2', volume: 50, unit_price: 10000 },
      ]

      const result = await rapService.initFromRab('P1', rabItems)
      expect(insertedData).toHaveLength(2)
      expect(insertedData[0].project_id).toBe('P1')
      expect(insertedData[0].rab_item_id).toBe('rab-1')
      expect(insertedData[0].qty_budget).toBe(100)
      expect(insertedData[0].cost_material).toBe(3000)
      // Second item defaults to 0 for split costs
      expect(insertedData[1].cost_equipment).toBe(0)
      expect(insertedData[1].committed_cost).toBe(0)
    })
  })
})
