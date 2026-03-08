import { beforeEach, describe, expect, it, vi } from 'vitest'

let rpcResults: Record<string, any> = {}

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({
    rpc: (fnName: string, _params: any) => {
      const result = rpcResults[fnName] ?? { data: null, error: null }
      return Promise.resolve(result)
    },
  }),
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
    rpcResults = {}
  })

  it('detects snapshot presence via RPC', async () => {
    rpcResults.rpc_has_rab_snapshot = { data: true, error: null }
    const hasSnapshot = await ahspSnapshotService.hasSnapshot('p1')
    expect(hasSnapshot).toBe(true)
  })

  it('returns false when no snapshot exists', async () => {
    rpcResults.rpc_has_rab_snapshot = { data: false, error: null }
    const hasSnapshot = await ahspSnapshotService.hasSnapshot('p1')
    expect(hasSnapshot).toBe(false)
  })

  it('takes snapshot via RPC and returns result', async () => {
    rpcResults.rpc_take_rab_snapshot = {
      data: { itemsSnapshotted: 5, totalBaselineValue: 1000000, timestamp: '2026-03-08T00:00:00Z' },
      error: null,
    }
    const result = await ahspSnapshotService.takeSnapshot('p1')
    expect(result.itemsSnapshotted).toBe(5)
    expect(result.totalBaselineValue).toBe(1000000)
  })

  it('throws on snapshot RPC error', async () => {
    rpcResults.rpc_take_rab_snapshot = { data: null, error: { message: 'DB error' } }
    await expect(ahspSnapshotService.takeSnapshot('p1')).rejects.toThrow('Snapshot gagal')
  })

  it('gets price drift from RPC and sorts by impact', async () => {
    rpcResults.rpc_get_price_drift = {
      data: [
        { rabItemId: '1', itemName: 'A', snapshotPrice: 100, currentPrice: 150, drift: 50, driftPercentage: 50, volume: 10, impactOnBudget: 500 },
        { rabItemId: '2', itemName: 'B', snapshotPrice: 200, currentPrice: 210, drift: 10, driftPercentage: 5, volume: 1, impactOnBudget: 10 },
      ],
      error: null,
    }

    const drifts = await ahspSnapshotService.getPriceDrift('p1')
    expect(drifts).toHaveLength(2)
    expect(drifts[0].rabItemId).toBe('1')
    expect(drifts[0].impactOnBudget).toBeGreaterThan(drifts[1].impactOnBudget)
  })
})
