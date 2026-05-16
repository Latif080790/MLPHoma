/**
 * subcontractorService.test.ts
 * Tests for SPK lifecycle, opname financial calculations, and status transitions.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest'

let _idSeq = 0
vi.mock('../../lib/idGenerator', () => ({
  generateId: vi.fn().mockImplementation((prefix: string) => `${prefix}-${++_idSeq}`),
}))
vi.mock('../auditService', () => ({
  auditService: { log: vi.fn() },
}))
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}))

import { subcontractorService } from '../subcontractorService'

// ─── Subcontractor Registry ────────────────────────────────────────────────────

describe('getSubcons', () => {
  it('returns seeded subcontractors', () => {
    const subs = subcontractorService.getSubcons()
    expect(subs.length).toBeGreaterThanOrEqual(2)
    expect(subs.some((s) => s.type === 'MANDOR')).toBe(true)
    expect(subs.some((s) => s.type === 'SUBCON')).toBe(true)
  })

  it('createSubcon appends and returns new entry', () => {
    const before = subcontractorService.getSubcons().length
    const created = subcontractorService.createSubcon({
      name: 'CV Test Baja',
      type: 'SUBCON',
      specialty: 'Besi',
      phone: '08111',
      bankAccount: 'BRI 0001',
      rating: 4,
      status: 'ACTIVE',
    })
    expect(subcontractorService.getSubcons().length).toBe(before + 1)
    expect(created.name).toBe('CV Test Baja')
    expect(created.id).toBeTruthy()
  })
})

// ─── SPK Lifecycle ─────────────────────────────────────────────────────────────

describe('SPK lifecycle', () => {
  const PROJECT_ID = 'proj-spk-lifecycle'

  it('getSPKs returns empty array for new project', () => {
    expect(subcontractorService.getSPKs(PROJECT_ID)).toHaveLength(0)
  })

  it('createSPK sets DRAFT status and generates spkNumber', () => {
    const spk = subcontractorService.createSPK(
      {
        projectId: PROJECT_ID,
        wbsId: 'wbs-1',
        subconId: 'sub-001',
        description: 'Pekerjaan Bekisting',
        contractValue: 50_000_000,
        downPaymentPercentage: 10,
        retainagePercentage: 5,
        startDate: '2026-01-01',
        endDate: '2026-06-30',
      },
      'admin'
    )
    expect(spk.status).toBe('DRAFT')
    expect(spk.spkNumber).toMatch(/^SPK-\d{4}-\d{3}$/)
    expect(subcontractorService.getSPKs(PROJECT_ID)).toHaveLength(1)
  })

  it('activateSPK changes status to ACTIVE', () => {
    const [spk] = subcontractorService.getSPKs(PROJECT_ID)
    subcontractorService.activateSPK(spk.id, 'admin')
    const [updated] = subcontractorService.getSPKs(PROJECT_ID)
    expect(updated.status).toBe('ACTIVE')
  })

  it('activateSPK throws for unknown id', () => {
    expect(() => subcontractorService.activateSPK('nonexistent', 'admin')).toThrow('SPK not found')
  })
})

// ─── draftOpname Financial Calculations ───────────────────────────────────────

describe('draftOpname financial math', () => {
  const PROJECT_ID = 'proj-opname-fin'
  let spkId: string

  beforeAll(() => {
    const spk = subcontractorService.createSPK(
      {
        projectId: PROJECT_ID,
        wbsId: 'wbs-fin',
        subconId: 'sub-001',
        description: 'Pekerjaan MEP',
        contractValue: 100_000_000,
        downPaymentPercentage: 20,
        retainagePercentage: 5,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      'admin'
    )
    spkId = spk.id
    subcontractorService.activateSPK(spkId, 'admin')
  })

  it('period 1: computes gross, retention, dp-repayment, net correctly', () => {
    const opname = subcontractorService.draftOpname(spkId, 30)
    // contractValue=100M, progress 0→30% → currentPeriod=30%
    expect(opname.previousProgressPercentage).toBe(0)
    expect(opname.currentPeriodProgressPercentage).toBe(30)
    // grossAmount = 100_000_000 * 30% = 30_000_000
    expect(opname.grossAmount).toBe(30_000_000)
    // retention = 30_000_000 * 5% = 1_500_000
    expect(opname.retentionDeduction).toBe(1_500_000)
    // dp repayment = 30_000_000 * 20% = 6_000_000
    expect(opname.dpRepaymentDeduction).toBe(6_000_000)
    // net = 30_000_000 - 1_500_000 - 6_000_000 = 22_500_000
    expect(opname.netPayable).toBe(22_500_000)
    expect(opname.periodNumber).toBe(1)
    expect(opname.status).toBe('DRAFT')

    // persist for subsequent period tests
    subcontractorService.saveOpname(opname, 'admin')
    subcontractorService.submitOpname(opname.id)
    subcontractorService.approveOpname(opname.id, 'admin')
  })

  it('period 2: previousProgress reflects saved period 1', () => {
    const opname = subcontractorService.draftOpname(spkId, 60)
    expect(opname.previousProgressPercentage).toBe(30)
    expect(opname.currentPeriodProgressPercentage).toBe(30)
    expect(opname.grossAmount).toBe(30_000_000)
    expect(opname.periodNumber).toBe(2)
  })

  it('otherDeductions reduces netPayable', () => {
    const opname = subcontractorService.draftOpname(spkId, 50, 500_000)
    const expected = opname.grossAmount - opname.retentionDeduction - opname.dpRepaymentDeduction - 500_000
    expect(opname.netPayable).toBe(expected)
    expect(opname.otherDeductions).toBe(500_000)
  })
})

// ─── draftOpname Validation ────────────────────────────────────────────────────

describe('draftOpname validation', () => {
  const PROJECT_ID = 'proj-opname-val'
  let spkId: string
  let draftSpkId: string

  beforeAll(() => {
    const active = subcontractorService.createSPK(
      {
        projectId: PROJECT_ID,
        wbsId: 'wbs-val',
        subconId: 'sub-001',
        description: 'Validation SPK',
        contractValue: 10_000_000,
        downPaymentPercentage: 0,
        retainagePercentage: 0,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      'admin'
    )
    spkId = active.id
    subcontractorService.activateSPK(spkId, 'admin')

    const draft = subcontractorService.createSPK(
      {
        projectId: PROJECT_ID,
        wbsId: 'wbs-val2',
        subconId: 'sub-001',
        description: 'Draft SPK',
        contractValue: 10_000_000,
        downPaymentPercentage: 0,
        retainagePercentage: 0,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      'admin'
    )
    draftSpkId = draft.id
  })

  it('throws when SPK not found', () => {
    expect(() => subcontractorService.draftOpname('bad-id', 30)).toThrow('SPK not found')
  })

  it('throws when SPK is not ACTIVE', () => {
    expect(() => subcontractorService.draftOpname(draftSpkId, 30)).toThrow('SPK is not active')
  })

  it('throws when progress <= previous cumulative', () => {
    const op1 = subcontractorService.draftOpname(spkId, 40)
    subcontractorService.saveOpname(op1, 'admin')
    expect(() => subcontractorService.draftOpname(spkId, 40)).toThrow('must be greater than previous')
    expect(() => subcontractorService.draftOpname(spkId, 30)).toThrow('must be greater than previous')
  })

  it('throws when progress > 100', () => {
    expect(() => subcontractorService.draftOpname(spkId, 101)).toThrow('cannot exceed 100%')
  })
})

// ─── Status Transitions ────────────────────────────────────────────────────────

describe('opname status transitions', () => {
  const PROJECT_ID = 'proj-status'
  let spkId: string

  beforeAll(() => {
    const spk = subcontractorService.createSPK(
      {
        projectId: PROJECT_ID,
        wbsId: 'wbs-st',
        subconId: 'sub-001',
        description: 'Status Test SPK',
        contractValue: 20_000_000,
        downPaymentPercentage: 0,
        retainagePercentage: 0,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      'admin'
    )
    spkId = spk.id
    subcontractorService.activateSPK(spkId, 'admin')
  })

  it('submit → approve transitions opname status', () => {
    const draft = subcontractorService.draftOpname(spkId, 50)
    subcontractorService.saveOpname(draft, 'admin')
    expect(draft.status).toBe('DRAFT')

    subcontractorService.submitOpname(draft.id)
    const all = subcontractorService.getOpnamesBySPK(spkId)
    const found = all.find((o) => o.id === draft.id)!
    expect(found.status).toBe('SUBMITTED')

    subcontractorService.approveOpname(draft.id, 'pm-user')
    const approved = subcontractorService.getOpnamesBySPK(spkId).find((o) => o.id === draft.id)!
    expect(approved.status).toBe('APPROVED')
    expect(approved.approvedBy).toBe('pm-user')
  })

  it('approving 100% opname auto-completes the SPK', () => {
    const op100 = subcontractorService.draftOpname(spkId, 100)
    subcontractorService.saveOpname(op100, 'admin')
    subcontractorService.submitOpname(op100.id)
    subcontractorService.approveOpname(op100.id, 'pm-user')

    const [spk] = subcontractorService.getSPKs(PROJECT_ID)
    expect(spk.status).toBe('COMPLETED')
  })

  it('reject sets status and records reason', () => {
    // New SPK for clean state
    const spk2 = subcontractorService.createSPK(
      {
        projectId: PROJECT_ID,
        wbsId: 'wbs-rej',
        subconId: 'sub-001',
        description: 'Reject Test',
        contractValue: 5_000_000,
        downPaymentPercentage: 0,
        retainagePercentage: 0,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      'admin'
    )
    subcontractorService.activateSPK(spk2.id, 'admin')
    const op = subcontractorService.draftOpname(spk2.id, 20)
    subcontractorService.saveOpname(op, 'admin')
    subcontractorService.submitOpname(op.id)
    subcontractorService.rejectOpname(op.id, 'Data tidak sesuai', 'admin')

    const rejected = subcontractorService.getOpnamesBySPK(spk2.id).find((o) => o.id === op.id)!
    expect(rejected.status).toBe('REJECTED')
    expect(rejected.notes).toBe('Data tidak sesuai')
  })

  it('postToFinance requires APPROVED status', () => {
    const spk3 = subcontractorService.createSPK(
      {
        projectId: PROJECT_ID,
        wbsId: 'wbs-fin2',
        subconId: 'sub-001',
        description: 'Post to Finance Test',
        contractValue: 5_000_000,
        downPaymentPercentage: 0,
        retainagePercentage: 0,
        startDate: '2026-01-01',
        endDate: '2026-12-31',
      },
      'admin'
    )
    subcontractorService.activateSPK(spk3.id, 'admin')
    const op = subcontractorService.draftOpname(spk3.id, 25)
    subcontractorService.saveOpname(op, 'admin')
    subcontractorService.submitOpname(op.id)

    expect(() => subcontractorService.postToFinance(op.id, 'admin')).toThrow('must be approved first')

    subcontractorService.approveOpname(op.id, 'pm-user')
    subcontractorService.postToFinance(op.id, 'admin')

    const posted = subcontractorService.getOpnamesBySPK(spk3.id).find((o) => o.id === op.id)!
    expect(posted.status).toBe('POSTED_TO_FINANCE')
  })
})

// ─── getOpnames by project ─────────────────────────────────────────────────────

describe('getOpnames', () => {
  it('returns opnames filtered by projectId', () => {
    const opAll = subcontractorService.getOpnames('proj-status')
    expect(opAll.length).toBeGreaterThan(0)
    expect(opAll.every((o) => o.projectId === 'proj-status')).toBe(true)
  })

  it('returns empty for unknown project', () => {
    expect(subcontractorService.getOpnames('proj-unknown-xyz')).toHaveLength(0)
  })
})
