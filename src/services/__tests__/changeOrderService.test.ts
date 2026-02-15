/**
 * changeOrderService.test.ts
 * Unit tests for changeOrderService CRUD operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock helpers ----

let mockFromImpl: (table: string) => any

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFromImpl(t) }),
}))

vi.mock('../../lib/idGenerator', () => ({
  generateId: () => 'gen-id-001',
}))

import { changeOrderService } from '../changeOrderService'

// ---------- Builder ----------

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.in = () => c
  c.order = () => c
  c.limit = () => c
  c.single = () => Promise.resolve(result)
  c.maybeSingle = () => Promise.resolve(result)
  c.insert = () => c
  c.update = () => c
  c.delete = () => c
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

// ---------- Tests ----------

describe('changeOrderService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getChangeOrders', () => {
    it('should fetch orders and their items', async () => {
      const orders = [
        { id: 'co-1', project_id: 'P1', vo_number: 'VO-001', title: 'Test' },
      ]
      const items = [
        { id: 'i-1', change_order_id: 'co-1', item_description: 'Item A', wbs_items: { name: 'WBS-A' } },
      ]

      mockFromImpl = (table: string) => {
        if (table === 'change_orders') {
          return makeChain({ data: orders, error: null })
        }
        if (table === 'change_order_items') {
          return makeChain({ data: items, error: null })
        }
        return makeChain({ data: null, error: null })
      }

      const result = await changeOrderService.getChangeOrders('P1')

      expect(result).toHaveLength(1)
      expect(result[0].items).toHaveLength(1)
      expect(result[0].items![0].wbs_name).toBe('WBS-A')
    })

    it('should return empty array on query error', async () => {
      mockFromImpl = () => makeChain({ data: null, error: new Error('DB error') })

      const result = await changeOrderService.getChangeOrders('P1')
      expect(result).toEqual([])
    })
  })

  describe('createChangeOrder', () => {
    it('should insert header and items', async () => {
      const insertedItems: any[] = []
      const insertedHeader: any[] = []

      mockFromImpl = (table: string) => {
        if (table === 'change_orders') {
          return {
            insert: (data: any) => {
              insertedHeader.push(data)
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: { id: 'gen-id-001', ...data }, error: null }),
                }),
              }
            },
          }
        }
        if (table === 'change_order_items') {
          return {
            insert: (data: any) => {
              insertedItems.push(...data)
              return Promise.resolve({ error: null })
            },
          }
        }
        return makeChain({ data: null, error: null })
      }

      const result = await changeOrderService.createChangeOrder(
        { project_id: 'P1', vo_number: 'VO-002', title: 'New VO' },
        [{ item_description: 'Concrete', volume_delta: 10, unit_price: 100000, total_delta: 1000000 }]
      )

      expect(result).toBeDefined()
      expect(result.id).toBe('gen-id-001')
      expect(insertedHeader).toHaveLength(1)
      expect(insertedItems).toHaveLength(1)
      expect(insertedItems[0].change_order_id).toBe('gen-id-001')
    })

    it('should skip items insert when items array is empty', async () => {
      let itemInsertCalled = false

      mockFromImpl = (table: string) => {
        if (table === 'change_orders') {
          return {
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'gen-id-001' }, error: null }),
              }),
            }),
          }
        }
        if (table === 'change_order_items') {
          itemInsertCalled = true
          return { insert: () => Promise.resolve({ error: null }) }
        }
        return makeChain({ data: null, error: null })
      }

      await changeOrderService.createChangeOrder({ project_id: 'P1', title: 'Header Only' }, [])

      expect(itemInsertCalled).toBe(false)
    })
  })

  describe('updateChangeOrderStatus', () => {
    it('should update status by id', async () => {
      let updatedData: any = null

      mockFromImpl = () => ({
        update: (data: any) => {
          updatedData = data
          return { eq: () => Promise.resolve({ error: null }) }
        },
      })

      await changeOrderService.updateChangeOrderStatus('co-1', 'APPROVED')
      expect(updatedData).toEqual({ status: 'APPROVED' })
    })

    it('should throw on update error', async () => {
      mockFromImpl = () => ({
        update: () => ({
          eq: () => Promise.resolve({ error: new Error('update failed') }),
        }),
      })

      await expect(changeOrderService.updateChangeOrderStatus('x', 'REJECTED')).rejects.toThrow()
    })
  })

  describe('deleteChangeOrder', () => {
    it('should delete order by id', async () => {
      let deleteCalled = false

      mockFromImpl = () => ({
        delete: () => {
          deleteCalled = true
          return { eq: () => Promise.resolve({ error: null }) }
        },
      })

      await changeOrderService.deleteChangeOrder('co-1')
      expect(deleteCalled).toBe(true)
    })
  })
})
