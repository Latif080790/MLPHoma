/**
 * notificationService.test.ts
 * Unit tests for notification CRUD and broadcast.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }))

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFrom(t) }),
  supabase: { from: (t: string) => mockFrom(t) },
}))

vi.mock('../../lib/idGenerator', () => ({
  generateId: (prefix?: string) => `${prefix || 'gen'}-001`,
}))

import { notificationService } from '../notificationService'

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.limit = () => c
  c.single = () => Promise.resolve(result)
  c.insert = () => c
  c.update = () => c
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

describe('notificationService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getNotifications', () => {
    it('should return mapped notifications for user', async () => {
      const rows = [
        { id: 'n1', project_id: 'P1', user_id: 'u1', type: 'BUDGET_WARNING', severity: 'warning', title: 'Risk Alert', message: 'High risk detected', is_read: false, created_at: '2025-01-01' },
      ]
      mockFrom.mockImplementation(() => makeChain({ data: rows, error: null }))

      const result = await notificationService.getNotifications('u1')
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('Risk Alert')
      expect(result[0].isRead).toBe(false)
    })

    it('should return empty array when no data', async () => {
      mockFrom.mockImplementation(() => makeChain({ data: null, error: null }))
      const result = await notificationService.getNotifications('u1')
      expect(result).toEqual([])
    })
  })

  describe('getUnreadCount', () => {
    it('should return unread count', async () => {
      mockFrom.mockImplementation(() => makeChain({ count: 3, error: null }))
      const count = await notificationService.getUnreadCount('u1')
      expect(count).toBe(3)
    })

    it('should return 0 on null count', async () => {
      mockFrom.mockImplementation(() => makeChain({ count: null, error: null }))
      const count = await notificationService.getUnreadCount('u1')
      expect(count).toBe(0)
    })
  })

  describe('createNotification', () => {
    it('should insert and return mapped notification', async () => {
      const row = {
        id: 'notif-001',
        project_id: 'P1',
        user_id: 'u1',
        type: 'APPROVAL_REQUEST',
        severity: 'info',
        title: 'New Approval',
        message: 'Please review',
        is_read: false,
        created_at: '2025-01-01',
      }

      mockFrom.mockImplementation(() => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: row, error: null }),
          }),
        }),
      }))

      const result = await notificationService.createNotification({
        projectId: 'P1',
        userId: 'u1',
        type: 'APPROVAL_REQUEST',
        severity: 'info',
        title: 'New Approval',
        message: 'Please review',
      })

      expect(result.title).toBe('New Approval')
      expect(result.isRead).toBe(false)
    })

    it('should throw on insert error', async () => {
      mockFrom.mockImplementation(() => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: null, error: new Error('insert fail') }),
          }),
        }),
      }))

      await expect(
        notificationService.createNotification({
          userId: 'u1',
          type: 'BUDGET_WARNING',
          severity: 'warning',
          title: 'Test',
          message: 'Msg',
        })
      ).rejects.toThrow()
    })
  })

  describe('notifyByRole', () => {
    it('should fetch profiles by role and create notifications for each', async () => {
      const profiles = [{ id: 'u1' }, { id: 'u2' }]
      let insertedNotifications: any[] = []

      mockFrom.mockImplementation((table: string) => {
        if (table === 'profiles') {
          return makeChain({ data: profiles, error: null })
        }
        if (table === 'notifications') {
          return {
            insert: (data: any) => {
              insertedNotifications = data
              return Promise.resolve({ error: null })
            },
          }
        }
        return makeChain({ data: null, error: null })
      })

      await notificationService.notifyByRole('P1', 'manager', {
        projectId: 'P1',
        type: 'CHANGE_ORDER',
        severity: 'info',
        title: 'VO Approved',
        message: 'VO cascade complete',
      })

      expect(insertedNotifications).toHaveLength(2)
      expect(insertedNotifications[0].project_id).toBe('P1')
      expect(insertedNotifications[1].user_id).toBe('u2')
    })

    it('should throw when profiles query fails', async () => {
      mockFrom.mockImplementation(() => makeChain({ data: null, error: new Error('profiles fail') }))

      await expect(
        notificationService.notifyByRole('P1', 'admin', {
          projectId: 'P1',
          type: 'BUDGET_WARNING',
          severity: 'warning',
          title: 'Test',
          message: 'Msg',
        })
      ).rejects.toThrow()
    })
  })
})
