/**
 * subcontractorService.test.ts
 *
 * Tests for draftOpname financial calculations (pure synchronous logic),
 * and the Supabase-backed service methods (mocked).
 *
 * NOTE: getSubcons, getSPKs, createSPK, activateSPK, saveOpname, submitOpname,
 * approveOpname, rejectOpname, postToFinance are all async and backed by Supabase.
 * draftOpname is synchronous and purely calculates financials.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock Supabase ─────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSingle = vi.fn() as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOrder = vi.fn() as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockEq = vi.fn() as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockSelect = vi.fn() as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockInsert = vi.fn() as any
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockUpdate = vi.fn() as any

mockOrder.mockReturnValue({ eq: mockEq, single: mockSingle })
mockEq.mockReturnValue({ eq: mockEq, single: mockSingle, order: mockOrder, select: mockSelect })
mockSelect.mockReturnValue({ single: mockSingle, eq: mockEq, order: mockOrder })
mockInsert.mockReturnValue({ select: mockSelect })
mockUpdate.mockReturnValue({ eq: mockEq })
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  eq: mockEq,
}))

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: vi.fn(() => ({ from: mockFrom })),
}))

vi.mock('../auditService', () => ({
  auditService: { log: vi.fn() },
}))

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { subcontractorService } from '../subcontractorService'
import type { SPK, Opname } from '../subcontractorService'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSPK(overrides: Partial<SPK> = {}): SPK {
  return {
    id: 'spk-001',
    projectId: 'proj-test',
    wbsId: 'wbs-1',
    subconId: 'sub-001',
    spkNumber: 'SPK-2026-001',
    description: 'Test SPK',
    contractValue: 100_000_000,
    downPaymentPercentage: 20,
    retainagePercentage: 5,
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

function makeOpname(overrides: Partial<Opname> = {}): Opname {
  return {
    id: `opn-${Math.random()}`,
    spkId: 'spk-001',
    projectId: 'proj-test',
    periodNumber: 1,
    date: new Date().toISOString(),
    progressPercentage: 30,
    previousProgressPercentage: 0,
    currentPeriodProgressPercentage: 30,
    grossAmount: 30_000_000,
    retentionDeduction: 1_500_000,
    dpRepaymentDeduction: 6_000_000,
    otherDeductions: 0,
    netPayable: 22_500_000,
    status: 'APPROVED',
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── draftOpname Financial Calculations ───────────────────────────────────────
// draftOpname is SYNCHRONOUS — tests do not need Supabase mocking

describe('draftOpname financial math', () => {
  const spk = makeSPK({
    contractValue: 100_000_000,
    downPaymentPercentage: 20,
    retainagePercentage: 5,
  })

  it('period 1: computes gross, retention, dp-repayment, net correctly', () => {
    const draft = subcontractorService.draftOpname(spk, [], 30)
    expect(draft.previousProgressPercentage).toBe(0)
    expect(draft.currentPeriodProgressPercentage).toBe(30)
    // grossAmount = 100_000_000 * 30% = 30_000_000
    expect(draft.grossAmount).toBe(30_000_000)
    // retention = 30_000_000 * 5% = 1_500_000
    expect(draft.retentionDeduction).toBe(1_500_000)
    // dp repayment = 30_000_000 * 20% = 6_000_000
    expect(draft.dpRepaymentDeduction).toBe(6_000_000)
    // net = 30_000_000 - 1_500_000 - 6_000_000 = 22_500_000
    expect(draft.netPayable).toBe(22_500_000)
    expect(draft.periodNumber).toBe(1)
    expect(draft.status).toBe('DRAFT')
  })

  it('period 2: previousProgress reflects period 1 opname', () => {
    const period1 = makeOpname({
      progressPercentage: 30,
      previousProgressPercentage: 0,
      currentPeriodProgressPercentage: 30,
      dpRepaymentDeduction: 6_000_000,
      status: 'APPROVED',
    })
    const draft = subcontractorService.draftOpname(spk, [period1], 60)
    expect(draft.previousProgressPercentage).toBe(30)
    expect(draft.currentPeriodProgressPercentage).toBe(30)
    expect(draft.grossAmount).toBe(30_000_000)
    expect(draft.periodNumber).toBe(2)
  })

  it('otherDeductions reduces netPayable', () => {
    const draft = subcontractorService.draftOpname(spk, [], 50, 500_000)
    const expected = draft.grossAmount - draft.retentionDeduction - draft.dpRepaymentDeduction - 500_000
    expect(draft.netPayable).toBe(expected)
    expect(draft.otherDeductions).toBe(500_000)
  })

  it('dp repayment is capped at remaining unrecovered DP (no over-recovery)', () => {
    // contractValue=100M, dp=20% → totalDP=20M
    // After period 1 recovered 6M, period 2 recovered 6M → alreadyRecovered=12M, remaining=8M
    const period1 = makeOpname({ dpRepaymentDeduction: 6_000_000, currentPeriodProgressPercentage: 30, status: 'APPROVED' })
    const period2 = makeOpname({ dpRepaymentDeduction: 6_000_000, currentPeriodProgressPercentage: 30, status: 'APPROVED' })

    // period 3: 30%→90%, grossAmount = 30M, dp% would be 6M, but remaining = 20M - 12M = 8M
    const draft3 = subcontractorService.draftOpname(spk, [period1, period2], 90)
    expect(draft3.grossAmount).toBe(30_000_000)
    // dp cap: min(30M * 20%, 8M) = min(6M, 8M) = 6M
    expect(draft3.dpRepaymentDeduction).toBe(6_000_000)

    // period 4: 90%→100% = 10%, grossAmount=10M, dp% would be 2M, but remaining = 20M-18M = 2M
    const period3 = makeOpname({ dpRepaymentDeduction: 6_000_000, currentPeriodProgressPercentage: 30, status: 'APPROVED' })
    const draft4 = subcontractorService.draftOpname(spk, [period1, period2, period3], 100)
    expect(draft4.grossAmount).toBe(10_000_000)
    // dp cap: min(10M * 20%, 2M) = min(2M, 2M) = 2M
    expect(draft4.dpRepaymentDeduction).toBe(2_000_000)
  })
})

// ─── draftOpname Validation ────────────────────────────────────────────────────

describe('draftOpname validation', () => {
  const activeSPK = makeSPK({ status: 'ACTIVE' })
  const draftSPK = makeSPK({ status: 'DRAFT' })

  it('throws when SPK is not ACTIVE', () => {
    expect(() => subcontractorService.draftOpname(draftSPK, [], 30)).toThrow('SPK is not active')
  })

  it('throws when progress <= previous cumulative', () => {
    const existing = [makeOpname({ currentPeriodProgressPercentage: 40, status: 'APPROVED' })]
    expect(() => subcontractorService.draftOpname(activeSPK, existing, 40)).toThrow('must be greater than previous')
    expect(() => subcontractorService.draftOpname(activeSPK, existing, 30)).toThrow('must be greater than previous')
  })

  it('throws when progress > 100', () => {
    expect(() => subcontractorService.draftOpname(activeSPK, [], 101)).toThrow('cannot exceed 100%')
  })

  it('REJECTED opnames are excluded from previous progress sum', () => {
    const rejected = makeOpname({ currentPeriodProgressPercentage: 40, status: 'REJECTED' })
    // Should not throw: REJECTED opname doesn't count toward cumulative progress
    const draft = subcontractorService.draftOpname(activeSPK, [rejected], 30)
    expect(draft.previousProgressPercentage).toBe(0) // rejected excluded
    expect(draft.currentPeriodProgressPercentage).toBe(30)
  })
})

// ─── draftOpname: return type is Omit<Opname, 'id'> ──────────────────────────

describe('draftOpname return shape', () => {
  it('returns all required Opname fields except id', () => {
    const spk = makeSPK()
    const draft = subcontractorService.draftOpname(spk, [], 25)
    expect(draft).not.toHaveProperty('id')
    expect(draft).toHaveProperty('spkId', spk.id)
    expect(draft).toHaveProperty('projectId', spk.projectId)
    expect(draft).toHaveProperty('periodNumber', 1)
    expect(draft).toHaveProperty('status', 'DRAFT')
    expect(draft).toHaveProperty('notes', '')
    expect(draft).toHaveProperty('grossAmount')
    expect(draft).toHaveProperty('retentionDeduction')
    expect(draft).toHaveProperty('dpRepaymentDeduction')
    expect(draft).toHaveProperty('netPayable')
    expect(draft).toHaveProperty('createdAt')
    expect(draft).toHaveProperty('updatedAt')
  })
})
