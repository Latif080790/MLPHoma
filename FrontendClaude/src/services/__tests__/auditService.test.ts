/**
 * auditService.test.ts
 * Unit tests for audit log service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFrom(t) }),
}))

vi.mock('../../lib/idGenerator', () => ({
  generateId: (prefix?: string) => `${prefix || 'gen'}-001`,
}))

import { auditService } from '../auditService'

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.limit = () => c
  c.range = () => c
  c.single = () => Promise.resolve(result)
  c.insert = () => c
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

describe('auditService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('log', () => {
    it('should insert audit log entry', async () => {
      let insertedData: any = null

      mockFrom.mockImplementation(() => ({
        insert: (data: any) => {
          insertedData = data
          return Promise.resolve({ error: null })
        },
      }))

      await auditService.log({
        action: 'APPROVE',
        entity: 'change_orders',
        entityType: 'CHANGE_ORDER',
        entityId: 'co-1',
        details: { note: 'test' },
      })

      expect(insertedData.id).toBe('audit-001')
      expect(insertedData.action).toBe('APPROVE')
      expect(insertedData.entity).toBe('change_orders')
    })

    it('should NOT throw on insert failure (swallows errors)', async () => {
      mockFrom.mockImplementation(() => ({
        insert: () => Promise.reject(new Error('DB down')),
      }))

      // Should not reject — audit should never block main flow
      await expect(
        auditService.log({ action: 'CREATE', entity: 'test' })
      ).resolves.toBeUndefined()
    })
  })

  describe('getLogs', () => {
    it('should return mapped audit entries', async () => {
      const rows = [
        { id: 'a1', user_id: 'u1', user_name: 'Admin', action: 'CREATE', entity: 'projects', entity_type: 'PROJECT', entity_id: 'p1', details: {}, created_at: '2025-01-01' },
      ]
      mockFrom.mockImplementation(() => makeChain({ data: rows, error: null }))

      const result = await auditService.getLogs()
      expect(result).toHaveLength(1)
      expect(result[0].userId).toBe('u1')
      expect(result[0].action).toBe('CREATE')
    })

    it('should apply filters when provided', async () => {
      mockFrom.mockImplementation(() => makeChain({ data: [], error: null }))

      const result = await auditService.getLogs({
        entityType: 'CHANGE_ORDER',
        entityId: 'co-1',
        userId: 'u1',
        limit: 10,
        offset: 5,
      })

      expect(result).toEqual([])
    })

    it('should return empty array on query error', async () => {
      mockFrom.mockImplementation(() => makeChain({ data: null, error: new Error('fail') }))
      const result = await auditService.getLogs()
      expect(result).toEqual([])
    })
  })

  describe('getEntityLogCount', () => {
    it('should return count for specific entity', async () => {
      mockFrom.mockImplementation(() => makeChain({ count: 7, error: null }))
      const count = await auditService.getEntityLogCount('CHANGE_ORDER', 'co-1')
      expect(count).toBe(7)
    })

    it('should return 0 when null count', async () => {
      mockFrom.mockImplementation(() => makeChain({ count: null, error: null }))
      const count = await auditService.getEntityLogCount('RISK', 'r-1')
      expect(count).toBe(0)
    })
  })
})
