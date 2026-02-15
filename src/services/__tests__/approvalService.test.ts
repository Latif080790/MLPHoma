/**
 * approvalService.test.ts
 * Unit tests for Approval Workflow: create, approve, reject.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFrom, mockNotifyByRole, mockNotifyCreate, mockAuditLog, mockCascadeExecute } = vi.hoisted(() => ({
  mockFrom: vi.fn(),
  mockNotifyByRole: vi.fn().mockResolvedValue(undefined),
  mockNotifyCreate: vi.fn().mockResolvedValue({ id: 'notif-1' }),
  mockAuditLog: vi.fn().mockResolvedValue(undefined),
  mockCascadeExecute: vi.fn().mockResolvedValue({ rabItemsUpdated: 1, budgetDelta: 1000 }),
}))

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFrom(t) }),
}))

vi.mock('../../lib/idGenerator', () => ({
  generateId: (prefix?: string) => `${prefix || 'gen'}-001`,
}))

vi.mock('../notificationService', () => ({
  notificationService: {
    notifyByRole: mockNotifyByRole,
    createNotification: mockNotifyCreate,
  },
}))

vi.mock('../auditService', () => ({
  auditService: { log: mockAuditLog },
}))

vi.mock('../changeOrderCascade', () => ({
  changeOrderCascade: { execute: mockCascadeExecute },
}))

import { approvalService } from '../approvalService'

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

describe('approvalService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getApprovals', () => {
    it('should return mapped approvals', async () => {
      const rows = [
        { id: 'a1', project_id: 'P1', title: 'PO Approval', status: 'PENDING', entity_type: 'PO', entity_id: 'po-1', created_at: '2025-01-01' },
      ]
      mockFrom.mockImplementation(() => makeChain({ data: rows, error: null }))

      const result = await approvalService.getApprovals('P1')
      expect(result).toHaveLength(1)
      expect(result[0].title).toBe('PO Approval')
      expect(result[0].projectId).toBe('P1')
    })

    it('should throw on error', async () => {
      mockFrom.mockImplementation(() => makeChain({ data: null, error: new Error('DB fail') }))
      await expect(approvalService.getApprovals('P1')).rejects.toThrow()
    })
  })

  describe('getPendingCount', () => {
    it('should return count for project', async () => {
      mockFrom.mockImplementation(() => makeChain({ count: 5, error: null }))
      const count = await approvalService.getPendingCount('P1')
      expect(count).toBe(5)
    })

    it('should return 0 when null count', async () => {
      mockFrom.mockImplementation(() => makeChain({ count: null, error: null }))
      const count = await approvalService.getPendingCount()
      expect(count).toBe(0)
    })
  })

  describe('createApproval', () => {
    it('should insert and notify managers', async () => {
      const inputRow = {
        id: 'appr-001',
        project_id: 'P1',
        title: 'VO Approval',
        entity_type: 'CHANGE_ORDER',
        entity_id: 'co-1',
        status: 'PENDING',
        created_at: '2025-01-01',
      }

      mockFrom.mockImplementation(() => ({
        insert: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: inputRow, error: null }),
          }),
        }),
      }))

      const result = await approvalService.createApproval({
        projectId: 'P1',
        title: 'VO Approval',
        entityType: 'CHANGE_ORDER',
        entityId: 'co-1',
      })

      expect(result.title).toBe('VO Approval')
      expect(mockNotifyByRole).toHaveBeenCalled()
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'CREATE', entity: 'approval_requests' })
      )
    })
  })

  describe('approve', () => {
    it('should update status, notify requester, and trigger cascade for CHANGE_ORDER', async () => {
      const approvedRow = {
        id: 'a1',
        project_id: 'P1',
        requester_id: 'user-1',
        title: 'VO #1',
        status: 'APPROVED',
        entity_type: 'CHANGE_ORDER',
        entity_id: 'co-1',
        approved_by: 'mgr-1',
        approver_name: 'Manager A',
        created_at: '2025-01-01',
      }

      mockFrom.mockImplementation(() => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: approvedRow, error: null }),
              }),
            }),
          }),
        }),
      }))

      const result = await approvalService.approve('a1', 'mgr-1', 'Manager A', 'Looks good')

      expect(result.status).toBe('APPROVED')
      // Should notify requester
      expect(mockNotifyCreate).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'APPROVAL_RESULT', userId: 'user-1' })
      )
      // Should trigger cascade for CHANGE_ORDER
      expect(mockCascadeExecute).toHaveBeenCalledWith('co-1')
      // Should audit
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'APPROVE' })
      )
    })

    it('should NOT trigger cascade for non-CHANGE_ORDER entity', async () => {
      const approvedRow = {
        id: 'a2',
        project_id: 'P1',
        title: 'PO Approval',
        status: 'APPROVED',
        entity_type: 'PO',
        entity_id: 'po-1',
        created_at: '2025-01-01',
      }

      mockFrom.mockImplementation(() => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: approvedRow, error: null }),
              }),
            }),
          }),
        }),
      }))

      await approvalService.approve('a2', 'mgr-1', 'Manager A')
      expect(mockCascadeExecute).not.toHaveBeenCalled()
    })
  })

  describe('reject', () => {
    it('should update status with rejection reason and notify requester', async () => {
      const rejectedRow = {
        id: 'a3',
        project_id: 'P1',
        requester_id: 'user-2',
        title: 'Budget Increase',
        status: 'REJECTED',
        entity_type: 'BUDGET',
        entity_id: 'b-1',
        rejection_reason: 'Over limit',
        approved_by: 'mgr-1',
        approver_name: 'Manager A',
        created_at: '2025-01-01',
      }

      mockFrom.mockImplementation(() => ({
        update: () => ({
          eq: () => ({
            eq: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: rejectedRow, error: null }),
              }),
            }),
          }),
        }),
      }))

      const result = await approvalService.reject('a3', 'mgr-1', 'Manager A', 'Over limit')

      expect(result.status).toBe('REJECTED')
      expect(mockNotifyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'APPROVAL_RESULT',
          userId: 'user-2',
          title: expect.stringContaining('Rejected'),
        })
      )
      expect(mockAuditLog).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'REJECT' })
      )
    })
  })
})
