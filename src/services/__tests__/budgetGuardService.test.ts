/**
 * budgetGuardService.test.ts
 * Unit tests for atomicCheckAndCommitBudget — verifies the RPC call pattern
 * that prevents budget race conditions (BUDGET-01).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock setup ----

let mockRpcImpl: (fn: string, args: unknown) => Promise<any>

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({
    rpc: (fn: string, args: unknown) => mockRpcImpl(fn, args),
  }),
}))

// Mock auditService so it doesn't blow up
vi.mock('../auditService', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}))

import { atomicCheckAndCommitBudget } from '../budgetGuardService'

// ---------- Tests ----------

describe('atomicCheckAndCommitBudget', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls rpc_check_and_commit_budget with correct parameters', async () => {
    const calledWith: { fn: string; args: unknown }[] = []

    mockRpcImpl = async (fn, args) => {
      calledWith.push({ fn, args })
      return { data: { success: true, remaining: 5000 }, error: null }
    }

    await atomicCheckAndCommitBudget('rap-item-1', 10000, 'po-abc')

    expect(calledWith).toHaveLength(1)
    expect(calledWith[0].fn).toBe('rpc_check_and_commit_budget')
    expect(calledWith[0].args).toEqual({
      p_rap_item_id: 'rap-item-1',
      p_amount: 10000,
      p_po_id: 'po-abc',
    })
  })

  it('uses null for p_po_id when poId is omitted', async () => {
    const calledWith: { fn: string; args: unknown }[] = []

    mockRpcImpl = async (fn, args) => {
      calledWith.push({ fn, args })
      return { data: { success: true, remaining: 2000 }, error: null }
    }

    await atomicCheckAndCommitBudget('rap-item-2', 500)

    expect((calledWith[0].args as any).p_po_id).toBeNull()
  })

  it('returns success=true and remaining budget on success path', async () => {
    mockRpcImpl = async () => ({
      data: { success: true, remaining: 15000 },
      error: null,
    })

    const result = await atomicCheckAndCommitBudget('rap-item-3', 5000)

    expect(result.success).toBe(true)
    expect(result.remaining).toBe(15000)
  })

  it('returns success=false and error message on failure path', async () => {
    mockRpcImpl = async () => ({
      data: { success: false, error: 'Insufficient budget' },
      error: null,
    })

    const result = await atomicCheckAndCommitBudget('rap-item-4', 99999)

    expect(result.success).toBe(false)
    expect(result.error).toBe('Insufficient budget')
  })

  it('throws when RPC returns an error object', async () => {
    mockRpcImpl = async () => ({
      data: null,
      error: { message: 'DB connection failed' },
    })

    await expect(atomicCheckAndCommitBudget('rap-item-5', 1000)).rejects.toThrow(
      'atomicCheckAndCommitBudget RPC failed: DB connection failed'
    )
  })
})
