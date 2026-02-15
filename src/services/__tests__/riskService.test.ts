/**
 * riskService.test.ts
 * Unit tests for Risk CRUD operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockFromImpl: (table: string) => any

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFromImpl(t) }),
}))

vi.mock('../../lib/idGenerator', () => ({
  generateId: () => 'risk-gen-001',
}))

import { riskService } from '../riskService'

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.limit = () => c
  c.single = () => Promise.resolve(result)
  c.insert = () => c
  c.update = () => c
  c.delete = () => c
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

describe('riskService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getRisks', () => {
    it('should return risks with wbs_name mapped', async () => {
      const rows = [
        { id: 'r1', project_id: 'P1', description: 'Soil instability', category: 'Technical', probability: 4, impact: 5, risk_score: 20, status: 'OPEN', wbs_items: { name: 'Foundation' }, created_at: '2025-01-01', updated_at: '2025-01-01' },
      ]
      mockFromImpl = () => makeChain({ data: rows, error: null })

      const result = await riskService.getRisks('P1')
      expect(result).toHaveLength(1)
      expect(result[0].wbs_name).toBe('Foundation')
      expect(result[0].risk_score).toBe(20)
      expect(result[0].category).toBe('Technical')
    })

    it('should return empty array when no data', async () => {
      mockFromImpl = () => makeChain({ data: null, error: null })
      const result = await riskService.getRisks('P1')
      expect(result).toEqual([])
    })

    it('should return empty array on error', async () => {
      mockFromImpl = () => makeChain({ data: null, error: new Error('DB error') })
      const result = await riskService.getRisks('P1')
      expect(result).toEqual([])
    })
  })

  describe('createRisk', () => {
    it('should auto-calculate risk_score and insert', async () => {
      let insertedData: any = null

      mockFromImpl = () => ({
        insert: (data: any) => {
          insertedData = data
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...data }, error: null }),
            }),
          }
        },
      })

      const result = await riskService.createRisk({
        project_id: 'P1',
        description: 'Weather delay',
        category: 'External',
        probability: 3,
        impact: 4,
        status: 'OPEN',
      } as any)

      expect(insertedData.id).toBe('risk-gen-001')
      expect(insertedData.risk_score).toBe(12) // 3 * 4
      expect(result.description).toBe('Weather delay')
    })

    it('should default score to 1 when probability/impact missing', async () => {
      let insertedData: any = null

      mockFromImpl = () => ({
        insert: (data: any) => {
          insertedData = data
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...data }, error: null }),
            }),
          }
        },
      })

      await riskService.createRisk({ project_id: 'P1', description: 'Unknown' } as any)
      expect(insertedData.risk_score).toBe(1) // 1 * 1
    })
  })

  describe('updateRisk', () => {
    it('should update and add updated_at', async () => {
      let updatedData: any = null

      mockFromImpl = () => ({
        update: (data: any) => {
          updatedData = data
          return {
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: { id: 'r1', ...data }, error: null }),
              }),
            }),
          }
        },
      })

      const result = await riskService.updateRisk('r1', { status: 'MITIGATED' })
      expect(updatedData.status).toBe('MITIGATED')
      expect(updatedData.updated_at).toBeDefined()
      expect(result.id).toBe('r1')
    })
  })

  describe('deleteRisk', () => {
    it('should delete by id', async () => {
      let deleteCalled = false
      mockFromImpl = () => ({
        delete: () => {
          deleteCalled = true
          return { eq: () => Promise.resolve({ error: null }) }
        },
      })

      await riskService.deleteRisk('r1')
      expect(deleteCalled).toBe(true)
    })

    it('should throw on delete error', async () => {
      mockFromImpl = () => ({
        delete: () => ({ eq: () => Promise.resolve({ error: new Error('FK constraint') }) }),
      })
      await expect(riskService.deleteRisk('x')).rejects.toThrow()
    })
  })
})
