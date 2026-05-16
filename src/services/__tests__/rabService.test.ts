/**
 * rabService.test.ts
 * Unit tests for rabService pure functions: calculatePareto and mapDbRowToRabItem.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { RABItem } from '../../types/rab'

// ── Supabase mock (needed for module import even if not called in pure-fn tests) ──
vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: vi.fn(),
}))

import { calculatePareto, mapDbRowToRabItem } from '../rabService'

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeItem(id: string, finalTotal: number, extra: Partial<RABItem> = {}): RABItem {
  return {
    id,
    projectId: 'proj-1',
    finalTotal,
    final_total: finalTotal,
    finalPrice: finalTotal,
    volume: 1,
    unit_price: finalTotal,
    ...extra,
  } as RABItem
}

// ── calculatePareto ────────────────────────────────────────────────────────────

describe('calculatePareto', () => {
  it('returns empty array for empty input', () => {
    expect(calculatePareto([])).toEqual([])
  })

  it('classifies single item as A (100% of value = ≤80%? no — wait, 100% cumulative > 80%)', () => {
    // With one item, cumPercent will be 100 which is > 95, so it should be C
    // Actually: running = cost, totalCost = cost, cumPercent = 100 → > 95 → C
    const result = calculatePareto([makeItem('a', 1000)])
    expect(result[0].paretoClass).toBe('C')
  })

  it('assigns A to the highest-value items cumulatively up to 80%', () => {
    // Items: 800, 100, 50, 50 → total = 1000
    // sorted: 800, 100, 50, 50
    // cumPercents: 80%, 90%, 95%, 100%
    // A: first (cum 80%), B: second+third (cum ≤95%), C: fourth
    const items = [
      makeItem('d', 50),
      makeItem('b', 100),
      makeItem('a', 800),
      makeItem('c', 50),
    ]
    const result = calculatePareto(items)
    const byId = Object.fromEntries(result.map(r => [r.id, r.paretoClass]))
    // 'a' is always first (highest value → cumPercent 80% → A)
    expect(byId['a']).toBe('A')
    // 'b' is always second (cumPercent 90% → B)
    expect(byId['b']).toBe('B')
    // 'c' and 'd' are tied at 50 — one gets B (cumPercent 95%) the other C (100%)
    const tiePair = [byId['c'], byId['d']].sort()
    expect(tiePair).toEqual(['B', 'C'])
  })

  it('handles all equal items (distributes correctly)', () => {
    const items = [makeItem('x', 100), makeItem('y', 100), makeItem('z', 100)]
    const result = calculatePareto(items)
    // cumPercents: ~33%, ~67%, 100%
    // all ≤80? first two yes → A, last → B or C
    expect(result[0].paretoClass).toBe('A')
    expect(result[1].paretoClass).toBe('A')
    expect(result[2].paretoClass).toBe('C')
  })

  it('handles zero-total gracefully (no division by zero)', () => {
    const items = [makeItem('a', 0), makeItem('b', 0)]
    // totalCost = 0, cumPercent = 0 for all → all ≤80 → A
    const result = calculatePareto(items)
    result.forEach(r => expect(r.paretoClass).toBe('A'))
  })

  it('preserves all item fields', () => {
    const item = makeItem('a', 500, { unit: 'm2', name: 'Foundation' })
    const result = calculatePareto([item])
    expect(result[0].unit).toBe('m2')
    expect(result[0].name).toBe('Foundation')
    expect(result[0]).toHaveProperty('paretoClass')
  })

  it('sorts items from highest to lowest finalTotal', () => {
    const items = [makeItem('low', 10), makeItem('high', 900), makeItem('mid', 90)]
    const result = calculatePareto(items)
    expect(result[0].id).toBe('high')
    expect(result[1].id).toBe('mid')
    expect(result[2].id).toBe('low')
  })
})

// ── mapDbRowToRabItem ──────────────────────────────────────────────────────────

describe('mapDbRowToRabItem', () => {
  const row: Record<string, unknown> = {
    id: 'rab-1',
    project_id: 'proj-1',
    ahsp_code: 'AHS-001',
    name: 'Pekerjaan Pondasi',
    unit: 'm3',
    volume: '5',
    unit_price: '2000000',
    cost_material: '1000000',
    cost_labor: '500000',
    cost_equipment: '300000',
    cost_subcon: '0',
    markup_percentage: '10',
    weight_percentage: '15',
    final_total: '10000000',
    snapshot_price: null,
    is_overhead: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-15T00:00:00Z',
  }

  it('maps id and projectId correctly', () => {
    const item = mapDbRowToRabItem(row)
    expect(item.id).toBe('rab-1')
    expect(item.projectId).toBe('proj-1')
  })

  it('maps ahsp_code to item_code and code', () => {
    const item = mapDbRowToRabItem(row)
    expect(item.item_code).toBe('AHS-001')
    expect(item.code).toBe('AHS-001')
  })

  it('maps name to both name and item_name', () => {
    const item = mapDbRowToRabItem(row)
    expect(item.name).toBe('Pekerjaan Pondasi')
    expect(item.item_name).toBe('Pekerjaan Pondasi')
  })

  it('coerces numeric string fields to Number', () => {
    const item = mapDbRowToRabItem(row)
    expect(item.volume).toBe(5)
    expect(item.unit_price).toBe(2000000)
    expect(item.cost_material).toBe(1000000)
    expect(item.cost_labor).toBe(500000)
    expect(item.final_total).toBe(10000000)
  })

  it('maps final_total to finalTotal and finalPrice aliases', () => {
    const item = mapDbRowToRabItem(row)
    expect(item.finalTotal).toBe(10000000)
    expect(item.finalPrice).toBe(10000000)
  })

  it('handles missing optional fields gracefully (defaults to 0)', () => {
    const sparseRow: Record<string, unknown> = { id: 'x', project_id: 'p' }
    const item = mapDbRowToRabItem(sparseRow)
    expect(item.volume).toBe(0)
    expect(item.unit_price).toBe(0)
    expect(item.finalTotal).toBe(0)
  })

  it('maps date fields', () => {
    const item = mapDbRowToRabItem(row)
    expect(item.createdAt).toBe('2026-01-01T00:00:00Z')
    expect(item.updatedAt).toBe('2026-01-15T00:00:00Z')
  })

  it('merges existing item fields when provided', () => {
    const existing = makeItem('rab-1', 0, { isDraft: true })
    const item = mapDbRowToRabItem(row, existing)
    // existing fields spread first, then row overwrites id/projectId etc.
    expect(item.isDraft).toBe(true)
    expect(item.id).toBe('rab-1')
  })
})
