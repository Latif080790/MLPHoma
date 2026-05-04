/**
 * dashboardService.test.ts
 * Unit tests for dashboardService — EVM calculations, aggregation, waste detection.
 * Mocks supabase directly (dashboardService imports `supabase` not `assertSupabase`).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock supabase ----

let tableResults: Record<string, any>

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.gte = () => c
  c.lt = () => c
  c.in = () => c
  c.order = () => c
  c.limit = () => c
  c.single = () => Promise.resolve(result)
  c.maybeSingle = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

const mockFrom = vi.fn((table: string) => {
  const result = tableResults[table] ?? { data: null, error: null, count: 0 }
  return makeChain(result)
})

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: (table: string) => mockFrom(table) },
  assertSupabase: () => ({ from: (table: string) => mockFrom(table) }),
}))

vi.mock('../evmService', () => ({
  computeEVM: vi.fn(() => ({ cpi: 1.0, spi: 1.0, ev: 0, pv: 0, ac: 0 })),
  computeForecasts: vi.fn(() => ({ forecastDate: '2025-12-31', estimateAtCompletion: 0 })),
  calcPlannedProgressPercent: vi.fn(() => ({ percent: 50, daysElapsed: 15 })),
}))

vi.mock('../phiService', () => ({
  phiService: {
    calculatePHI: vi.fn(() => Promise.resolve({ score: 85, breakdown: {} })),
  },
}))

vi.mock('../anomalyService', () => ({
  anomalyService: {
    detectAnomalies: vi.fn(() => Promise.resolve([])),
  },
}))

vi.mock('../scheduleAlertService', () => ({
  scheduleAlertService: {
    getAlertCounts: vi.fn(() => Promise.resolve({ CRITICAL: 0, MODERATE: 0, MINOR: 0 })),
    getProjectAlerts: vi.fn(() => Promise.resolve([])),
  },
}))

import { dashboardService, DashboardStats } from '../dashboardService'

// ---------- Test Data ----------

const PROJECT_ID = 'proj-test'

const rapItems = [
  { qty_budget: 100, unit_price_budget: 50000, committed_cost: 6_000_000, actual_cost: 4_800_000, ahsp_items: { name: 'Semen' } },
  { qty_budget: 50, unit_price_budget: 100000, committed_cost: 4_000_000, actual_cost: 3_500_000, ahsp_items: { name: 'Besi' } },
  // Over-budget item (waste > 5%)
  { qty_budget: 10, unit_price_budget: 200000, committed_cost: 2_500_000, actual_cost: 2_400_000, ahsp_items: { name: 'Kayu' } },
]

const timelineTasks = [
  { progress: 50 },
  { progress: 80 },
  { progress: 30 },
]

const upcomingTasks = [
  { id: 't1', name: 'Pengecoran', end_date: '2025-08-01', progress: 30 },
  { id: 't2', name: 'Pemasangan', end_date: '2025-08-15', progress: 10 },
]

// ---------- Tests ----------

describe('dashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    tableResults = {}
  })

  describe('getEmptyStats', () => {
    it('should return zeroed stats object', () => {
      const stats = dashboardService.getEmptyStats()
      expect(stats.totalBudget).toBe(0)
      expect(stats.utilizedBudget).toBe(0)
      expect(stats.criticalRisks).toBe(0)
      expect(stats.overdueTasks).toBe(0)
      expect(stats.cpi).toBeNull()
      expect(stats.spi).toBeNull()
      expect(stats.overallProgress).toBe(0)
      expect(stats.forecastedEndDate).toBeNull()
      expect(stats.cashflow).toEqual([])
      expect(stats.wasteAlerts).toEqual([])
      expect(stats.activityFeed).toEqual([])
      expect(stats.upcomingTasks).toEqual([])
    })
  })

  describe('getProjectStats', () => {
    it('should return empty stats when projectId is empty', async () => {
      const stats = await dashboardService.getProjectStats('')
      expect(stats.totalBudget).toBe(0)
      expect(stats.overallProgress).toBe(0)
    })

    it('should aggregate budget from RAP items', async () => {
      tableResults = {
        rap_items: { data: rapItems, error: null },
        risks: { data: [], error: null, count: 0 },
        timeline_tasks: { data: timelineTasks, error: null, count: 0 },
        purchase_orders: { data: [], error: null },
        projects: { data: { start_date: '2025-01-01', end_date: '2025-12-31' }, error: null },
      }

      const stats = await dashboardService.getProjectStats(PROJECT_ID)

      // totalBudget = (100*50000) + (50*100000) + (10*200000) = 5M + 5M + 2M = 12M
      expect(stats.totalBudget).toBe(12_000_000)
      // utilizedBudget = 6M + 4M + 2.5M = 12.5M
      expect(stats.utilizedBudget).toBe(12_500_000)
    })

    it('should detect waste alerts for over-budget items (>5% variance)', async () => {
      tableResults = {
        rap_items: { data: rapItems, error: null },
        risks: { data: [], error: null, count: 0 },
        timeline_tasks: { data: timelineTasks, error: null, count: 0 },
        purchase_orders: { data: [], error: null },
        projects: { data: { start_date: '2025-01-01', end_date: '2025-12-31' }, error: null },
      }

      const stats = await dashboardService.getProjectStats(PROJECT_ID)

      // Semen: committed 6M vs budget 5M = 20% over → waste alert
      // Kayu: committed 2.5M vs budget 2M = 25% over → waste alert
      // Besi: committed 4M vs budget 5M = under budget → no alert
      expect(stats.wasteAlerts.length).toBeGreaterThanOrEqual(2)
      const semenAlert = stats.wasteAlerts.find(w => w.material === 'Semen')
      expect(semenAlert).toBeDefined()
      expect(semenAlert!.waste).toBe(20)
    })

    it('should compute overallProgress as average of task progresses', async () => {
      tableResults = {
        rap_items: { data: [], error: null },
        risks: { data: [], error: null, count: 0 },
        timeline_tasks: { data: timelineTasks, error: null, count: 0 },
        purchase_orders: { data: [], error: null },
        projects: { data: { start_date: '2025-01-01', end_date: '2025-12-31' }, error: null },
      }

      const stats = await dashboardService.getProjectStats(PROJECT_ID)

      // Average = (50 + 80 + 30) / 3 = 53.33 → rounded 53
      expect(stats.overallProgress).toBe(53)
    })

    it('should compute CPI and SPI when budget and costs exist', async () => {
      // Use items that give meaningful EVM
      const evmItems = [
        { qty_budget: 100, unit_price_budget: 100000, committed_cost: 8_000_000, actual_cost: 6_000_000, ahsp_items: { name: 'Item A' } },
      ]
      // Overall progress = 60%
      const evmTasks = [{ progress: 60 }]

      tableResults = {
        rap_items: { data: evmItems, error: null },
        risks: { data: [], error: null, count: 0 },
        timeline_tasks: { data: evmTasks, error: null, count: 0 },
        purchase_orders: { data: [], error: null },
        projects: { data: { start_date: '2025-01-01', end_date: '2025-12-31' }, error: null },
      }

      const stats = await dashboardService.getProjectStats(PROJECT_ID)

      // BAC = 100 * 100000 = 10M
      // EV = 60% * 10M = 6M
      // AC = 6M (actual_cost)
      // CPI = EV/AC = 6M/6M = 1.0
      expect(stats.cpi).toBe(1.0)
      // SPI depends on time elapsed ratio — since we use real dates, just check it's not null
      expect(stats.spi).not.toBeNull()
    })

    it('should include critical risks count', async () => {
      tableResults = {
        rap_items: { data: [], error: null },
        risks: { data: [{ id: 'r1' }, { id: 'r2' }], error: null, count: 2 },
        timeline_tasks: { data: [], error: null, count: 1 },
        purchase_orders: { data: [], error: null },
        projects: { data: { start_date: '2025-01-01', end_date: '2025-12-31' }, error: null },
      }

      const stats = await dashboardService.getProjectStats(PROJECT_ID)
      expect(stats.criticalRisks).toBe(2)
    })

    it('should map upcoming tasks correctly', async () => {
      tableResults = {
        rap_items: { data: [], error: null },
        risks: { data: [], error: null, count: 0 },
        timeline_tasks: { data: upcomingTasks, error: null, count: 0 },
        purchase_orders: { data: [], error: null },
        projects: { data: { start_date: '2025-01-01', end_date: '2025-12-31' }, error: null },
      }

      const stats = await dashboardService.getProjectStats(PROJECT_ID)
      expect(stats.upcomingTasks).toHaveLength(2)
      expect(stats.upcomingTasks[0].name).toBe('Pengecoran')
      expect(stats.upcomingTasks[1].progress).toBe(10)
    })

    it('should add PO activity to the activity feed', async () => {
      const pos = [
        { id: 'po-1', po_number: 'PO-001', total_amount: 5_000_000, created_at: '2025-06-01', status: 'ACTIVE' },
      ]

      tableResults = {
        rap_items: { data: [], error: null },
        risks: { data: [], error: null, count: 0 },
        timeline_tasks: { data: [], error: null, count: 0 },
        purchase_orders: { data: pos, error: null },
        projects: { data: { start_date: '2025-01-01', end_date: '2025-12-31' }, error: null },
      }

      const stats = await dashboardService.getProjectStats(PROJECT_ID)
      expect(stats.activityFeed.length).toBeGreaterThanOrEqual(1)
      expect(stats.activityFeed.some(f => f.type === 'PO')).toBe(true)
    })
  })
})
