/**
 * anomalyDetectors.test.ts
 * Unit tests for the 4 new anomaly detectors:
 * PRICE_SPIKE, SUPPLIER_DELAY, SCOPE_CREEP, CASH_BURN_RATE
 *
 * Strategy: mock Supabase by table name. Each test overrides only the
 * tables relevant to the detector under test; all others return empty.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

let tableResponses: Record<string, any> = {}

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({
    from: (table: string) => makeChain(tableResponses[table] ?? { data: [], error: null }),
  }),
}))

import { anomalyService } from '../anomalyService'

// ─── Chain builder (handles select, eq, gte, lte, gt, in, single, order) ────
function makeChain(result: any) {
  const c: any = {}
  const self = () => c
  c.select = self
  c.eq = self
  c.gte = self
  c.lte = self
  c.gt = self
  c.in = self
  c.order = self
  c.limit = self
  c.single = () => Promise.resolve(result)
  c.then = (res: any, rej?: any) => Promise.resolve(result).then(res, rej)
  return c
}

// ─── Baseline: no anomalies ───────────────────────────────────────────────────
function noAnomalyBase(): Record<string, any> {
  return {
    rap_items: { data: [], error: null },
    progress_logs: { data: [{ date: '2026-01-01' }], error: null },  // has recent logs
    projects: { data: { budget: 1_000_000, start_date: null, end_date: null }, error: null },
    timeline_tasks: { data: [], error: null },
    purchase_order_items: { data: [], error: null },
    rab_items: { data: [], error: null },
    purchase_orders: { data: [], error: null },
    goods_receipts: { data: [], error: null },
    change_orders: { data: [], error: null },
    invoices: { data: [], error: null },
  }
}

beforeEach(() => {
  tableResponses = noAnomalyBase()
  vi.clearAllMocks()
})

// ─── PRICE_SPIKE ──────────────────────────────────────────────────────────────

describe('anomaly detector — PRICE_SPIKE', () => {
  it('fires when PO unit_price > RAB price × 1.2', async () => {
    tableResponses['purchase_order_items'] = {
      data: [{ item_name: 'Semen Portland', unit_price: 150_000 }],
      error: null,
    }
    tableResponses['rab_items'] = {
      data: [{ item_name: 'Semen Portland', price: 100_000 }],
      error: null,
    }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    const spike = anomalies.find(a => a.type === 'PRICE_SPIKE')

    expect(spike).toBeDefined()
    expect(spike!.severity).toBe('WARNING')
    expect(spike!.description).toContain('Semen Portland')
    expect(spike!.metadata?.poPrice).toBe(150_000)
    expect(spike!.metadata?.budgetPrice).toBe(100_000)
  })

  it('does NOT fire when PO price is within 20% of RAB', async () => {
    tableResponses['purchase_order_items'] = {
      data: [{ item_name: 'Pasir', unit_price: 110_000 }],
      error: null,
    }
    tableResponses['rab_items'] = {
      data: [{ item_name: 'Pasir', price: 100_000 }],
      error: null,
    }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'PRICE_SPIKE')).toBeUndefined()
  })

  it('does NOT fire when item not found in RAB', async () => {
    tableResponses['purchase_order_items'] = {
      data: [{ item_name: 'Bahan Unknown', unit_price: 999_999 }],
      error: null,
    }
    tableResponses['rab_items'] = { data: [], error: null }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'PRICE_SPIKE')).toBeUndefined()
  })

  it('is case-insensitive for item name matching', async () => {
    tableResponses['purchase_order_items'] = {
      data: [{ item_name: 'BAJA TULANGAN', unit_price: 200_000 }],
      error: null,
    }
    tableResponses['rab_items'] = {
      data: [{ item_name: 'baja tulangan', price: 100_000 }],
      error: null,
    }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'PRICE_SPIKE')).toBeDefined()
  })
})

// ─── SUPPLIER_DELAY ───────────────────────────────────────────────────────────

describe('anomaly detector — SUPPLIER_DELAY', () => {
  const oldDate = new Date(Date.now() - 20 * 86400000).toISOString()  // 20 days ago

  it('fires when stale PO has no goods receipt', async () => {
    tableResponses['purchase_orders'] = {
      data: [{ id: 'PO-001', po_number: 'PO-2026-001', vendor_name: 'CV Maju', created_at: oldDate }],
      error: null,
    }
    tableResponses['goods_receipts'] = { data: [], error: null }  // no GRN

    const anomalies = await anomalyService.detectAnomalies('P-001')
    const delay = anomalies.find(a => a.type === 'SUPPLIER_DELAY')

    expect(delay).toBeDefined()
    expect(delay!.description).toContain('PO-2026-001')
    expect(delay!.description).toContain('CV Maju')
    expect(delay!.metadata?.poId).toBe('PO-001')
  })

  it('marks as CRITICAL when delay > 7 days past threshold', async () => {
    // 20 days old = 6 days past 14-day threshold → daysLate=6 → WARNING
    // 25 days old = 11 days past → CRITICAL
    const veryOldDate = new Date(Date.now() - 25 * 86400000).toISOString()
    tableResponses['purchase_orders'] = {
      data: [{ id: 'PO-002', po_number: 'PO-999', vendor_name: 'PT Lambat', created_at: veryOldDate }],
      error: null,
    }
    tableResponses['goods_receipts'] = { data: [], error: null }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    const delay = anomalies.find(a => a.type === 'SUPPLIER_DELAY')

    expect(delay).toBeDefined()
    expect(delay!.severity).toBe('CRITICAL')
  })

  it('does NOT fire when GRN exists for stale PO', async () => {
    tableResponses['purchase_orders'] = {
      data: [{ id: 'PO-003', po_number: 'PO-001', vendor_name: 'PT Cepat', created_at: oldDate }],
      error: null,
    }
    tableResponses['goods_receipts'] = {
      data: [{ purchase_order_id: 'PO-003' }],
      error: null,
    }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'SUPPLIER_DELAY')).toBeUndefined()
  })

  it('does NOT fire when no stale POs', async () => {
    tableResponses['purchase_orders'] = { data: [], error: null }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'SUPPLIER_DELAY')).toBeUndefined()
  })
})

// ─── SCOPE_CREEP ──────────────────────────────────────────────────────────────

describe('anomaly detector — SCOPE_CREEP', () => {
  beforeEach(() => {
    // Enable scope creep detection by providing a project with start_date
    tableResponses['projects'] = {
      data: { budget: 5_000_000, start_date: '2025-01-01', end_date: '2026-12-31' },
      error: null,
    }
  })

  it('fires when >10% of RAB items added after start with no approved CO', async () => {
    tableResponses['rab_items'] = {
      data: [
        // Used for both lateRabItems (gt start_date) and allRabItems
        // The service queries rab_items twice; both get the same mock
        { id: 'r1', item_name: 'Late Item 1', created_at: '2025-06-01' },
        { id: 'r2', item_name: 'Late Item 2', created_at: '2025-07-01' },
      ],
      error: null,
    }
    tableResponses['change_orders'] = { data: [], error: null }  // no approved COs

    const anomalies = await anomalyService.detectAnomalies('P-001')
    const creep = anomalies.find(a => a.type === 'SCOPE_CREEP')

    // 2 late items out of 2 total = 100% > 10%, no approved CO → fires
    expect(creep).toBeDefined()
    expect(creep!.severity).toBe('WARNING')
    expect(creep!.metadata?.lateCount).toBe(2)
    expect(creep!.metadata?.totalItems).toBe(2)
  })

  it('does NOT fire when approved change order exists', async () => {
    tableResponses['rab_items'] = {
      data: [{ id: 'r1', item_name: 'Late Item', created_at: '2025-06-01' }],
      error: null,
    }
    tableResponses['change_orders'] = {
      data: [{ id: 'co-1' }],  // approved CO exists
      error: null,
    }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'SCOPE_CREEP')).toBeUndefined()
  })

  it('does NOT fire when no start_date on project', async () => {
    tableResponses['projects'] = {
      data: { budget: 1_000_000, start_date: null, end_date: null },
      error: null,
    }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'SCOPE_CREEP')).toBeUndefined()
  })
})

// ─── CASH_BURN_RATE ───────────────────────────────────────────────────────────

describe('anomaly detector — CASH_BURN_RATE', () => {
  beforeEach(() => {
    // 52-week project at 5M budget → plannedWeeklyBurn = ~96,154
    tableResponses['projects'] = {
      data: {
        budget: 5_000_000,
        start_date: '2025-01-01',
        end_date: '2025-12-31',
      },
      error: null,
    }
  })

  it('fires when actual weekly burn > planned × 1.3', async () => {
    // 52-week project: planned = 5M/52 ≈ 96,154/week
    // If 4-week spend = 2,000,000 → weekly = 500,000 → well over 1.3× threshold
    tableResponses['invoices'] = {
      data: [
        { total_amount: 1_000_000 },
        { total_amount: 1_000_000 },
      ],
      error: null,
    }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    const burn = anomalies.find(a => a.type === 'CASH_BURN_RATE')

    expect(burn).toBeDefined()
    expect(burn!.severity).toBe('CRITICAL')
    expect(burn!.metadata?.actualWeeklyBurn).toBeGreaterThan(0)
  })

  it('does NOT fire when burn is within normal range', async () => {
    // Planned ≈ 96,154/week; 4-week spend 100,000 → weekly 25,000 → under threshold
    tableResponses['invoices'] = {
      data: [{ total_amount: 100_000 }],
      error: null,
    }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'CASH_BURN_RATE')).toBeUndefined()
  })

  it('does NOT fire when no invoice spend (recentSpend = 0)', async () => {
    tableResponses['invoices'] = { data: [], error: null }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'CASH_BURN_RATE')).toBeUndefined()
  })

  it('does NOT fire when project has no dates', async () => {
    tableResponses['projects'] = {
      data: { budget: 5_000_000, start_date: null, end_date: null },
      error: null,
    }
    tableResponses['invoices'] = {
      data: [{ total_amount: 999_999 }],
      error: null,
    }

    const anomalies = await anomalyService.detectAnomalies('P-001')
    expect(anomalies.find(a => a.type === 'CASH_BURN_RATE')).toBeUndefined()
  })
})
