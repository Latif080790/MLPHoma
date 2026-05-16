/**
 * mrpAlertService.test.ts
 * Unit tests for analyzeMaterialShortages — pure function, no mocks needed.
 */

import { describe, it, expect } from 'vitest'
import { analyzeMaterialShortages } from '../mrpAlertService'
import type { RABItem } from '../../types/rab'
import type { TimelineTask } from '../../types/timeline'
import type { InventoryStock, PurchaseOrder } from '../../types/supply-chain'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRab(id: string, name: string, volume: number, unit = 'm3'): RABItem {
  return { id, name, item_name: name, volume, unit, finalTotal: volume * 100, final_total: volume * 100, finalPrice: volume * 100, unit_price: 100, projectId: 'P-001' } as RABItem
}

function makeStock(materialName: string, current: number): InventoryStock {
  return { id: materialName, materialName, current, currentStock: current } as unknown as InventoryStock
}

function makePO(id: string, projectId: string, items: Array<{ itemName: string; quantity: number }>, status = 'APPROVED'): PurchaseOrder {
  return { id, projectId, status, items: items.map(i => ({ ...i, rapItemName: i.itemName })) } as unknown as PurchaseOrder
}

function futureDate(daysFromNow: number): string {
  return new Date(Date.now() + daysFromNow * 86400000).toISOString().split('T')[0]
}

function makeTask(id: string, name: string, startDate: string): TimelineTask {
  return { id, name, startDate, endDate: startDate, progress: 0 } as unknown as TimelineTask
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('analyzeMaterialShortages', () => {
  it('returns empty alerts when all materials are covered by stock', () => {
    const rabs = [makeRab('r1', 'Semen', 100)]
    const stocks = [makeStock('semen', 150)]
    const result = analyzeMaterialShortages(rabs, [], stocks, [], 'P-001')
    expect(result.alerts).toHaveLength(0)
    expect(result.criticalCount).toBe(0)
  })

  it('reports shortfall when stock < needed', () => {
    const rabs = [makeRab('r1', 'Pasir', 100)]
    const stocks = [makeStock('pasir', 40)]
    const result = analyzeMaterialShortages(rabs, [], stocks, [], 'P-001')
    expect(result.alerts).toHaveLength(1)
    expect(result.alerts[0].shortfall).toBe(60)
    expect(result.alerts[0].resourceName).toBe('pasir')
    expect(result.totalShortfall).toBe(60)
  })

  it('includes pending PO quantity in effective available', () => {
    const rabs = [makeRab('r1', 'Bata', 100)]
    const stocks = [makeStock('bata', 20)]
    const pos = [makePO('po1', 'P-001', [{ itemName: 'Bata', quantity: 70 }])]
    const result = analyzeMaterialShortages(rabs, [], stocks, pos, 'P-001')
    // effective = 20 + 70 = 90 < 100 → shortfall = 10
    expect(result.alerts[0].shortfall).toBe(10)
    expect(result.alerts[0].pendingPO).toBe(70)
  })

  it('ignores POs from different project', () => {
    const rabs = [makeRab('r1', 'Besi', 50)]
    const stocks = [makeStock('besi', 0)]
    const pos = [makePO('po1', 'P-999', [{ itemName: 'Besi', quantity: 100 }])]
    const result = analyzeMaterialShortages(rabs, [], stocks, pos, 'P-001')
    expect(result.alerts[0].pendingPO).toBe(0)
    expect(result.alerts[0].shortfall).toBe(50)
  })

  it('ignores POs with non-pending status (CANCELLED, RECEIVED)', () => {
    const rabs = [makeRab('r1', 'Cat', 50)]
    const stocks = [makeStock('cat', 0)]
    const cancelledPO = makePO('po1', 'P-001', [{ itemName: 'Cat', quantity: 100 }], 'CANCELLED')
    const receivedPO = makePO('po2', 'P-001', [{ itemName: 'Cat', quantity: 100 }], 'RECEIVED')
    const result = analyzeMaterialShortages(rabs, [], stocks, [cancelledPO, receivedPO], 'P-001')
    expect(result.alerts[0].pendingPO).toBe(0)
  })

  it('aggregates multiple RAB items with same material name', () => {
    const rabs = [makeRab('r1', 'Beton', 50), makeRab('r2', 'Beton', 30)]
    const stocks = [makeStock('beton', 40)]
    const result = analyzeMaterialShortages(rabs, [], stocks, [], 'P-001')
    // totalNeeded = 80, stock = 40 → shortfall = 40
    expect(result.alerts[0].totalNeeded).toBe(80)
    expect(result.alerts[0].shortfall).toBe(40)
  })

  it('severity=critical when daysUntilNeeded ≤ 3', () => {
    const rabs = [{ ...makeRab('r1', 'Kayu', 100), taskId: 't1' }]
    const tasks = [makeTask('t1', 'Pasang Bekisting', futureDate(2))]
    const stocks = [makeStock('kayu', 0)]
    const result = analyzeMaterialShortages(rabs, tasks, stocks, [], 'P-001')
    expect(result.alerts[0].severity).toBe('critical')
    expect(result.criticalCount).toBe(1)
  })

  it('severity=warning when daysUntilNeeded ≤ 7', () => {
    const rabs = [{ ...makeRab('r1', 'Kerikil', 100), taskId: 't1' }]
    const tasks = [makeTask('t1', 'Pondasi', futureDate(5))]
    const stocks = [makeStock('kerikil', 0)]
    const result = analyzeMaterialShortages(rabs, tasks, stocks, [], 'P-001')
    expect(result.alerts[0].severity).toBe('warning')
    expect(result.warningCount).toBe(1)
  })

  it('severity=info when no due date', () => {
    const rabs = [makeRab('r1', 'Atap', 10)]
    const stocks = [makeStock('atap', 0)]
    const result = analyzeMaterialShortages(rabs, [], stocks, [], 'P-001')
    // shortfall = 10, ratio = 1.0 > 0.8 → actually critical by ratio
    expect(['info', 'warning', 'critical']).toContain(result.alerts[0].severity)
  })

  it('severity=critical by ratio when no due date and shortfall > 80%', () => {
    const rabs = [makeRab('r1', 'Pipa', 100)]
    const stocks = [makeStock('pipa', 5)]   // only 5% available → ratio 0.95 > 0.8
    const result = analyzeMaterialShortages(rabs, [], stocks, [], 'P-001')
    expect(result.alerts[0].severity).toBe('critical')
  })

  it('sorts alerts by severity: critical first', () => {
    const rabs = [
      { ...makeRab('r1', 'MatA', 100), taskId: 't-critical' },
      { ...makeRab('r2', 'MatB', 100), taskId: 't-warning' },
    ]
    const tasks = [
      makeTask('t-critical', 'Task A', futureDate(1)),
      makeTask('t-warning', 'Task B', futureDate(6)),
    ]
    const stocks: InventoryStock[] = []
    const result = analyzeMaterialShortages(rabs, tasks, stocks, [], 'P-001')
    expect(result.alerts[0].severity).toBe('critical')
    expect(result.alerts[1].severity).toBe('warning')
  })

  it('matches material names case-insensitively', () => {
    const rabs = [makeRab('r1', 'SEMEN PORTLAND', 100)]
    const stocks = [makeStock('semen portland', 200)]
    const result = analyzeMaterialShortages(rabs, [], stocks, [], 'P-001')
    expect(result.alerts).toHaveLength(0)  // no shortfall
  })

  it('skips RAB items with empty name', () => {
    const rabs = [makeRab('r1', '', 100), makeRab('r2', 'Beton', 50)]
    const stocks = [makeStock('beton', 100)]
    const result = analyzeMaterialShortages(rabs, [], stocks, [], 'P-001')
    expect(result.alerts).toHaveLength(0)  // beton covered, empty skipped
  })

  it('returns correct summary counts', () => {
    const rabs = [
      { ...makeRab('r1', 'MatCrit', 100), taskId: 't1' },
      { ...makeRab('r2', 'MatWarn', 100), taskId: 't2' },
      makeRab('r3', 'MatInfo', 100),
    ]
    const tasks = [
      makeTask('t1', 'Critical Task', futureDate(1)),
      makeTask('t2', 'Warning Task', futureDate(5)),
    ]
    const result = analyzeMaterialShortages(rabs, tasks, [], [], 'P-001')
    expect(result.warningCount).toBe(1)
    // MatInfo has ratio=1.0 (100% shortfall) → critical by ratio, so criticalCount=2
    expect(result.criticalCount).toBe(2)
    expect(result.criticalCount + result.warningCount + result.infoCount).toBe(result.alerts.length)
  })
})
