/**
 * invoiceStatusTransition.test.ts
 * Tests for invoice status transition validation in financeService.
 * Verifies that PAID → UNPAID is rejected (terminal state) and UNPAID → PAID succeeds.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock setup ----

let mockFromImpl: (table: string) => any

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFromImpl(t) }),
}))

vi.mock('../../lib/idGenerator', () => ({
  generateId: () => 'gen-id-fin-status',
}))

vi.mock('../auditService', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}))

// Mock heavy dependencies that are imported by financeService
vi.mock('../../lib/auditTrail', () => ({
  auditTrail: {
    logInvoiceCreated: vi.fn().mockResolvedValue(undefined),
    logPaymentApprovalRequested: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../supplyChainService', () => ({
  supplyChainService: {
    getPurchaseOrders: vi.fn().mockResolvedValue([]),
    getInventoryTransactions: vi.fn().mockResolvedValue([]),
  },
}))

vi.mock('../notificationService', () => ({
  notificationService: {
    createNotification: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../invoiceMatchingService', () => ({
  matchInvoice: vi.fn().mockReturnValue({ status: 'matched', discrepancies: [] }),
}))

import { financeService } from '../financeService'

// ---------- Helpers ----------

function makeSelectSingle(data: unknown) {
  return {
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve({ data, error: null }),
      }),
    }),
  }
}

function makeUpdateChain(error: unknown = null) {
  return {
    update: (_data: any) => ({
      eq: () => Promise.resolve({ error }),
    }),
  }
}

// ---------- Tests ----------

describe('financeService.updateInvoiceStatus — transition validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromImpl = () => ({
      ...makeSelectSingle({ status: 'UNPAID', invoice_number: 'INV-001' }),
      ...makeUpdateChain(null),
    })
  })

  it('rejects PAID → UNPAID transition (terminal state)', async () => {
    mockFromImpl = (_table: string) => ({
      ...makeSelectSingle({ status: 'PAID', invoice_number: 'INV-PAID' }),
      ...makeUpdateChain(null),
    })

    await expect(
      financeService.updateInvoiceStatus('inv-paid-id', 'UNPAID')
    ).rejects.toThrow('Invalid status transition')
  })

  it('rejects PAID → any status transition (terminal state blocks all moves)', async () => {
    mockFromImpl = (_table: string) => ({
      ...makeSelectSingle({ status: 'PAID', invoice_number: 'INV-PAID-2' }),
      ...makeUpdateChain(null),
    })

    await expect(
      financeService.updateInvoiceStatus('inv-paid-id-2', 'PARTIAL')
    ).rejects.toThrow('terminal state')
  })

  it('allows UNPAID → PAID transition', async () => {
    let updatedData: any = null

    mockFromImpl = (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: { status: 'UNPAID', invoice_number: 'INV-002' }, error: null }),
        }),
      }),
      update: (data: any) => {
        updatedData = data
        return { eq: () => Promise.resolve({ error: null }) }
      },
    })

    await expect(
      financeService.updateInvoiceStatus('inv-unpaid-id', 'PAID')
    ).resolves.toBeUndefined()

    expect(updatedData).toEqual({ status: 'PAID' })
  })

  it('allows UNPAID → PENDING_PAYMENT transition', async () => {
    let updatedStatus: string | null = null

    mockFromImpl = (_table: string) => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve({ data: { status: 'UNPAID', invoice_number: 'INV-003' }, error: null }),
        }),
      }),
      update: (data: any) => {
        updatedStatus = data.status
        return { eq: () => Promise.resolve({ error: null }) }
      },
    })

    await financeService.updateInvoiceStatus('inv-003', 'PENDING_PAYMENT')
    expect(updatedStatus).toBe('PENDING_PAYMENT')
  })

  it('rejects UNPAID → DRAFT (not a valid transition)', async () => {
    mockFromImpl = (_table: string) => ({
      ...makeSelectSingle({ status: 'UNPAID', invoice_number: 'INV-004' }),
      ...makeUpdateChain(null),
    })

    await expect(
      financeService.updateInvoiceStatus('inv-004', 'DRAFT')
    ).rejects.toThrow('Invalid status transition')
  })
})
