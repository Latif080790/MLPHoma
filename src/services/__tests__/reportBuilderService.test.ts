/**
 * reportBuilderService.test.ts
 * Tests for report template CRUD, normalizeTemplate, inDateRange filtering,
 * and runTemplate dataset routing (DASHBOARD_KPI, RISK_REGISTER, PURCHASE_ORDERS).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mocks ────────────────────────────────────────────────────────────────────

type ChainState = { data: unknown; error: unknown }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeChain(state: ChainState): any {
  const chain: Record<string, unknown> = {}
  const noop = () => chain
  chain['select'] = noop
  chain['insert'] = noop
  chain['update'] = noop
  chain['delete'] = noop
  chain['eq'] = noop
  chain['is'] = noop
  chain['or'] = noop
  chain['order'] = noop
  chain['limit'] = noop
  chain['single'] = () => Promise.resolve(state)
  chain['then'] = (resolve: (v: ChainState) => unknown, reject?: (v: unknown) => unknown) =>
    Promise.resolve(state).then(resolve, reject)
  return chain
}

let _fromFn: (table: string) => unknown = () => makeChain({ data: [], error: null })

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (table: string) => _fromFn(table) }),
}))

vi.mock('../dashboardService', () => ({
  dashboardService: {
    getProjectStats: vi.fn().mockResolvedValue({
      totalBudget: 1_000_000,
      utilizedBudget: 450_000,
      cpi: 0.9,
      spi: 0.85,
      overallProgress: 45,
      criticalRisks: 2,
      overdueTasks: 3,
    }),
  },
}))

// ─── Import after mocks ───────────────────────────────────────────────────────

import { reportBuilderService } from '../reportBuilderService'
import type { ReportTemplate } from '../../types/report'

const BASE_TEMPLATE: ReportTemplate = {
  id: 'tmpl-1',
  project_id: 'proj-1',
  name: 'Test Template',
  description: null,
  scope: 'PROJECT',
  dataset: 'PURCHASE_ORDERS',
  chart_type: 'TABLE',
  config: {},
  is_shared: false,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
}

// ─── listTemplates ─────────────────────────────────────────────────────────────

describe('listTemplates', () => {
  beforeEach(() => {
    _fromFn = () => makeChain({ data: [], error: null })
  })

  it('returns empty array when no templates exist', async () => {
    const result = await reportBuilderService.listTemplates('proj-1')
    expect(result).toEqual([])
  })

  it('normalizes snake_case row to camelCase template', async () => {
    const row = {
      id: 'tmpl-x',
      project_id: 'proj-1',
      name: 'My Report',
      description: 'A desc',
      scope: 'GLOBAL',
      dataset: 'RISK_REGISTER',
      chart_type: 'BAR',
      config: { limit: 20 },
      is_shared: true,
      created_by: 'user-1',
      created_at: '2026-03-01T00:00:00Z',
      updated_at: '2026-03-02T00:00:00Z',
    }
    _fromFn = () => makeChain({ data: [row], error: null })
    const result = await reportBuilderService.listTemplates('proj-1')
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('tmpl-x')
    expect(result[0].dataset).toBe('RISK_REGISTER')
    expect(result[0].is_shared).toBe(true)
    expect(result[0].config).toEqual({ limit: 20 })
  })

  it('throws when Supabase returns an error', async () => {
    _fromFn = () => makeChain({ data: null, error: new Error('DB error') })
    await expect(reportBuilderService.listTemplates()).rejects.toThrow('DB error')
  })
})

// ─── createTemplate ───────────────────────────────────────────────────────────

describe('createTemplate', () => {
  it('inserts and returns normalized template', async () => {
    const row = {
      id: 'new-tmpl',
      project_id: 'proj-1',
      name: 'KPI Report',
      description: null,
      scope: 'PROJECT',
      dataset: 'DASHBOARD_KPI',
      chart_type: 'TABLE',
      config: {},
      is_shared: false,
      created_by: null,
      created_at: '2026-04-01T00:00:00Z',
      updated_at: '2026-04-01T00:00:00Z',
    }
    _fromFn = () => makeChain({ data: row, error: null })
    const result = await reportBuilderService.createTemplate({
      project_id: 'proj-1',
      name: 'KPI Report',
      dataset: 'DASHBOARD_KPI',
    })
    expect(result.id).toBe('new-tmpl')
    expect(result.name).toBe('KPI Report')
    expect(result.scope).toBe('PROJECT')
  })
})

// ─── runTemplate — DASHBOARD_KPI ──────────────────────────────────────────────

describe('runTemplate — DASHBOARD_KPI', () => {
  it('returns 7-row KPI summary from dashboardService', async () => {
    const tmpl: ReportTemplate = { ...BASE_TEMPLATE, dataset: 'DASHBOARD_KPI' }
    const result = await reportBuilderService.runTemplate('proj-1', tmpl)

    expect(result.columns).toEqual(['Metric', 'Value'])
    expect(result.rows).toHaveLength(7)

    const cpiRow = result.rows.find((r) => r['Metric'] === 'CPI')
    expect(cpiRow?.['Value']).toBe(0.9)

    const budgetRow = result.rows.find((r) => r['Metric'] === 'Total Budget')
    expect(budgetRow?.['Value']).toBe(1_000_000)
  })

  it('sets generatedAt to current ISO timestamp', async () => {
    const before = Date.now()
    const tmpl: ReportTemplate = { ...BASE_TEMPLATE, dataset: 'DASHBOARD_KPI' }
    const result = await reportBuilderService.runTemplate('proj-1', tmpl)
    expect(new Date(result.generatedAt).getTime()).toBeGreaterThanOrEqual(before)
  })
})

// ─── runTemplate — RISK_REGISTER ──────────────────────────────────────────────

describe('runTemplate — RISK_REGISTER', () => {
  const risks = [
    { id: 'r1', description: 'Flood risk', category: 'Natural', risk_score: 8, status: 'OPEN', owner: 'John', created_at: '2026-02-01T00:00:00Z' },
    { id: 'r2', description: 'Cost overrun', category: 'Financial', risk_score: 6, status: 'MITIGATED', owner: 'Jane', created_at: '2026-01-15T00:00:00Z' },
  ]

  beforeEach(() => {
    _fromFn = () => makeChain({ data: risks, error: null })
  })

  it('returns all risks when no statusIn filter', async () => {
    const tmpl: ReportTemplate = { ...BASE_TEMPLATE, dataset: 'RISK_REGISTER', config: {} }
    const result = await reportBuilderService.runTemplate('proj-1', tmpl)
    expect(result.rows).toHaveLength(2)
    expect(result.columns).toContain('Score')
  })

  it('filters by statusIn', async () => {
    const tmpl: ReportTemplate = { ...BASE_TEMPLATE, dataset: 'RISK_REGISTER', config: { statusIn: ['OPEN'] } }
    const result = await reportBuilderService.runTemplate('proj-1', tmpl)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]['Status']).toBe('OPEN')
  })

  it('filters by dateFrom/dateTo range', async () => {
    const tmpl: ReportTemplate = {
      ...BASE_TEMPLATE,
      dataset: 'RISK_REGISTER',
      config: { dateFrom: '2026-02-01', dateTo: '2026-03-01' },
    }
    const result = await reportBuilderService.runTemplate('proj-1', tmpl)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]['ID']).toBe('r1')
  })
})

// ─── runTemplate — PURCHASE_ORDERS (fallback) ─────────────────────────────────

describe('runTemplate — PURCHASE_ORDERS', () => {
  const pos = [
    { id: 'po1', po_number: 'PO-001', vendor_name: 'CV Maju', total_amount: 500_000, status: 'APPROVED', created_at: '2026-03-10T00:00:00Z' },
    { id: 'po2', po_number: 'PO-002', vendor_name: 'PT Abadi', total_amount: 250_000, status: 'CANCELLED', created_at: '2026-03-05T00:00:00Z' },
  ]

  beforeEach(() => {
    _fromFn = () => makeChain({ data: pos, error: null })
  })

  it('returns all POs when no statusIn filter', async () => {
    const result = await reportBuilderService.runTemplate('proj-1', BASE_TEMPLATE)
    expect(result.rows).toHaveLength(2)
    expect(result.columns).toContain('TotalAmount')
  })

  it('filters by statusIn', async () => {
    const tmpl: ReportTemplate = { ...BASE_TEMPLATE, config: { statusIn: ['APPROVED'] } }
    const result = await reportBuilderService.runTemplate('proj-1', tmpl)
    expect(result.rows).toHaveLength(1)
    expect(result.rows[0]['Status']).toBe('APPROVED')
  })

  it('maps vendor_name to Vendor column', async () => {
    const result = await reportBuilderService.runTemplate('proj-1', BASE_TEMPLATE)
    expect(result.rows[0]['Vendor']).toBe('CV Maju')
  })
})
