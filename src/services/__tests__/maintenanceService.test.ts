/**
 * maintenanceService.test.ts
 * Unit tests for maintenanceService: Assets, PPM, WorkOrders, SpareParts, Summary.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

let mockFromImpl: (table: string) => any

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFromImpl(t) }),
}))

import { maintenanceService } from '../maintenanceService'

// ─── Mock chain builder ───────────────────────────────────────────────────────
function makeChain(result: any) {
  const c: any = {}
  const terminal = () => Promise.resolve(result)
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.insert = () => c
  c.update = () => c
  c.delete = () => c
  c.single = terminal
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

function makeSingleChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.insert = () => c
  c.update = () => c
  c.delete = () => c
  c.single = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

// ─── Assets ──────────────────────────────────────────────────────────────────

describe('maintenanceService — getAssets', () => {
  beforeEach(() => {
    mockFromImpl = () => makeChain({ data: [], error: null })
  })

  it('returns assets for project', async () => {
    const mockAssets = [
      { id: 'a1', project_id: 'P-001', asset_code: 'EQ-001', name: 'Excavator', condition: 'GOOD' },
    ]
    mockFromImpl = (table) => {
      expect(table).toBe('assets')
      return makeChain({ data: mockAssets, error: null })
    }
    const result = await maintenanceService.getAssets('P-001')
    expect(result).toHaveLength(1)
    expect(result[0].asset_code).toBe('EQ-001')
  })

  it('throws on supabase error', async () => {
    mockFromImpl = () => makeChain({ data: null, error: new Error('DB error') })
    await expect(maintenanceService.getAssets('P-001')).rejects.toThrow('DB error')
  })
})

describe('maintenanceService — createAsset', () => {
  it('inserts and returns new asset', async () => {
    const newAsset = { id: 'a2', project_id: 'P-001', asset_code: 'EQ-002', name: 'Bulldozer', condition: 'GOOD' }
    mockFromImpl = () => makeSingleChain({ data: newAsset, error: null })
    const result = await maintenanceService.createAsset({ project_id: 'P-001', asset_code: 'EQ-002', name: 'Bulldozer', condition: 'GOOD' } as any)
    expect(result.asset_code).toBe('EQ-002')
  })
})

describe('maintenanceService — deleteAsset', () => {
  it('resolves without error on success', async () => {
    mockFromImpl = () => makeChain({ error: null })
    await expect(maintenanceService.deleteAsset('a1')).resolves.toBeUndefined()
  })

  it('throws on supabase error', async () => {
    mockFromImpl = () => makeChain({ error: new Error('Delete failed') })
    await expect(maintenanceService.deleteAsset('a1')).rejects.toThrow('Delete failed')
  })
})

// ─── PPM Schedules ────────────────────────────────────────────────────────────

describe('maintenanceService — getPPMSchedules', () => {
  it('returns schedules with checklist defaulting to []', async () => {
    mockFromImpl = () => makeChain({
      data: [
        { id: 's1', project_id: 'P-001', checklist: null },
        { id: 's2', project_id: 'P-001', checklist: ['Check oil'] },
      ],
      error: null,
    })
    const result = await maintenanceService.getPPMSchedules('P-001')
    expect(result[0].checklist).toEqual([])
    expect(result[1].checklist).toEqual(['Check oil'])
  })
})

// ─── Work Orders ──────────────────────────────────────────────────────────────

describe('maintenanceService — getWorkOrders', () => {
  it('returns work orders', async () => {
    const mockWOs = [{ id: 'w1', project_id: 'P-001', status: 'OPEN', priority: 'HIGH' }]
    mockFromImpl = () => makeChain({ data: mockWOs, error: null })
    const result = await maintenanceService.getWorkOrders('P-001')
    expect(result).toHaveLength(1)
    expect(result[0].status).toBe('OPEN')
  })
})

// ─── Spare Parts ─────────────────────────────────────────────────────────────

describe('maintenanceService — getSpareParts', () => {
  it('returns spare parts', async () => {
    mockFromImpl = () => makeChain({ data: [{ id: 'p1', part_code: 'SP-001', stock_qty: 5, min_stock: 10 }], error: null })
    const result = await maintenanceService.getSpareParts('P-001')
    expect(result[0].part_code).toBe('SP-001')
  })
})

// ─── Summary ─────────────────────────────────────────────────────────────────

describe('maintenanceService — getSummary', () => {
  it('aggregates counts correctly', async () => {
    let callCount = 0
    mockFromImpl = () => {
      callCount++
      // getSummary order: [assets, workOrders, ppmSchedules, spareParts]
    const datasets: any[] = [
        // assets (callCount=1)
        { data: [
          { condition: 'GOOD' },
          { condition: 'FAIR' },
          { condition: 'NEW' },
        ], error: null },
        // work_orders (callCount=2, getSummary calls getWorkOrders second)
        { data: [
          { status: 'OPEN', priority: 'HIGH', downtime_hours: 0 },
          { status: 'COMPLETED', priority: 'NORMAL', downtime_hours: 8 },
        ], error: null },
        // ppm_schedules (callCount=3)
        { data: [{ status: 'OVERDUE' }, { status: 'UPCOMING' }], error: null },
        // spare_parts (callCount=4)
        { data: [
          { stock_qty: 2, min_stock: 5 },   // low stock
          { stock_qty: 10, min_stock: 5 },  // OK
        ], error: null },
      ]
      return makeChain(datasets[callCount - 1] ?? { data: [], error: null })
    }

    const summary = await maintenanceService.getSummary('P-001')

    expect(summary.totalAssets).toBe(3)
    expect(summary.assetsGoodCondition).toBe(2)  // GOOD + NEW
    expect(summary.overdueMaintenances).toBe(1)
    expect(summary.openWorkOrders).toBe(1)
    expect(summary.totalDowntimeHours).toBe(8)
    expect(summary.lowStockParts).toBe(1)
  })
})

// ─── generateWONumber ─────────────────────────────────────────────────────────

describe('maintenanceService — generateWONumber', () => {
  it('produces a WO-prefixed string', () => {
    const num = maintenanceService.generateWONumber('PROJ-1')
    expect(num).toMatch(/^WO-PROJ-\d+$/)
  })

  it('uses first 4 chars of projectId uppercased', () => {
    const num = maintenanceService.generateWONumber('abc123')
    expect(num.startsWith('WO-ABC1')).toBe(true)
  })
})
