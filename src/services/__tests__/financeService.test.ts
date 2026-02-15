/**
 * financeService.test.ts
 * Unit tests for financeService: Invoices, Claims, Transactions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---- Mock setup ----

let mockFromImpl: (table: string) => any

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (t: string) => mockFromImpl(t) }),
}))

vi.mock('../../lib/idGenerator', () => ({
  generateId: () => 'gen-id-fin',
}))

import { financeService } from '../financeService'

// ---------- Builder ----------

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.limit = () => c
  c.single = () => Promise.resolve(result)
  c.insert = () => c
  c.update = () => c
  c.delete = () => c
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

// ---------- Tests ----------

describe('financeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ----- Invoices (AP) -----

  describe('getInvoices', () => {
    it('should return invoices ordered by due_date', async () => {
      const invoices = [
        { id: 'inv-1', vendor_name: 'PT ABC', amount: 10_000_000, status: 'UNPAID' },
        { id: 'inv-2', vendor_name: 'PT DEF', amount: 5_000_000, status: 'PAID' },
      ]
      mockFromImpl = () => makeChain({ data: invoices, error: null })

      const result = await financeService.getInvoices('P1')
      expect(result).toHaveLength(2)
      expect(result[0].vendor_name).toBe('PT ABC')
    })

    it('should return empty array when no invoices', async () => {
      mockFromImpl = () => makeChain({ data: null, error: null })
      const result = await financeService.getInvoices('P1')
      expect(result).toEqual([])
    })

    it('should return empty array on query error (graceful fallback)', async () => {
      mockFromImpl = () => makeChain({ data: null, error: new Error('DB error') })
      const result = await financeService.getInvoices('P1')
      expect(result).toEqual([])
    })
  })

  describe('createInvoice', () => {
    it('should insert invoice with generated id', async () => {
      let insertedData: any = null

      mockFromImpl = () => ({
        insert: (data: any) => {
          insertedData = data
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...data }, error: null }),
            }),
          }
        },
      })

      const result = await financeService.createInvoice({
        project_id: 'P1',
        vendor_name: 'PT XYZ',
        invoice_number: 'INV-001',
        amount: 20_000_000,
        tax_amount: 2_200_000,
        total_amount: 22_200_000,
        due_date: '2025-03-01',
        status: 'UNPAID',
      })

      expect(insertedData.id).toBe('gen-id-fin')
      expect(result.vendor_name).toBe('PT XYZ')
    })
  })

  describe('updateInvoiceStatus', () => {
    it('should update status by id', async () => {
      let updatedData: any = null
      mockFromImpl = () => ({
        update: (data: any) => {
          updatedData = data
          return { eq: () => Promise.resolve({ error: null }) }
        },
      })

      await financeService.updateInvoiceStatus('inv-1', 'PAID')
      expect(updatedData).toEqual({ status: 'PAID' })
    })
  })

  // ----- Claims (AR) -----

  describe('getClaims', () => {
    it('should return claims ordered by period_end desc', async () => {
      const claims = [
        { id: 'cl-1', claim_number: 'CL-001', amount: 50_000_000, status: 'SUBMITTED' },
      ]
      mockFromImpl = () => makeChain({ data: claims, error: null })

      const result = await financeService.getClaims('P1')
      expect(result).toHaveLength(1)
      expect(result[0].claim_number).toBe('CL-001')
    })

    it('should return empty array when no claims', async () => {
      mockFromImpl = () => makeChain({ data: null, error: null })
      expect(await financeService.getClaims('P1')).toEqual([])
    })
  })

  describe('createClaim', () => {
    it('should insert claim with generated id', async () => {
      let insertedData: any = null

      mockFromImpl = () => ({
        insert: (data: any) => {
          insertedData = data
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...data }, error: null }),
            }),
          }
        },
      })

      const result = await financeService.createClaim({
        project_id: 'P1',
        claim_number: 'CL-002',
        progress_percentage: 25,
        amount: 30_000_000,
        status: 'DRAFT',
      })

      expect(insertedData.id).toBe('gen-id-fin')
      expect(result.amount).toBe(30_000_000)
    })
  })

  // ----- Transactions -----

  describe('getTransactions', () => {
    it('should return transactions ordered by date desc', async () => {
      const txns = [
        { id: 'tx-1', description: 'Payment', amount: -10_000_000, category: 'Payment Out' },
      ]
      mockFromImpl = () => makeChain({ data: txns, error: null })

      const result = await financeService.getTransactions('P1')
      expect(result).toHaveLength(1)
      expect(result[0].amount).toBe(-10_000_000)
    })
  })

  describe('recordTransaction', () => {
    it('should insert transaction with generated id', async () => {
      let insertedData: any = null

      mockFromImpl = () => ({
        insert: (data: any) => {
          insertedData = data
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...data }, error: null }),
            }),
          }
        },
      })

      await financeService.recordTransaction({
        project_id: 'P1',
        description: 'Payment to supplier',
        category: 'Payment Out',
        amount: -5_000_000,
      })

      expect(insertedData.id).toBe('gen-id-fin')
      expect(insertedData.amount).toBe(-5_000_000)
    })
  })

  // ----- Composite -----

  describe('payInvoice', () => {
    it('should update invoice status AND record expense transaction', async () => {
      const calls: { method: string; table: string; data?: any }[] = []

      mockFromImpl = (table: string) => ({
        update: (data: any) => {
          calls.push({ method: 'update', table, data })
          return { eq: () => Promise.resolve({ error: null }) }
        },
        insert: (data: any) => {
          calls.push({ method: 'insert', table, data })
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { ...data }, error: null }),
            }),
          }
        },
      })

      await financeService.payInvoice('inv-1', 'P1', 10_000_000)

      // Should have 2 calls: update invoice status + insert transaction
      const updateCall = calls.find(c => c.method === 'update' && c.table === 'invoices')
      const insertCall = calls.find(c => c.method === 'insert' && c.table === 'finance_transactions')

      expect(updateCall).toBeDefined()
      expect(updateCall!.data).toEqual({ status: 'PAID' })
      expect(insertCall).toBeDefined()
      expect(insertCall!.data.amount).toBe(-10_000_000)
      expect(insertCall!.data.reference_type).toBe('INVOICE')
      expect(insertCall!.data.reference_id).toBe('inv-1')
    })
  })

  describe('updateClaimStatus', () => {
    it('should update claim status', async () => {
      let updatedData: any = null
      mockFromImpl = () => ({
        update: (data: any) => {
          updatedData = data
          return { eq: () => Promise.resolve({ error: null }) }
        },
      })

      await financeService.updateClaimStatus('cl-1', 'APPROVED')
      expect(updatedData).toEqual({ status: 'APPROVED' })
    })
  })

  describe('updateInvoice', () => {
    it('should update invoice fields', async () => {
      let updatedData: any = null
      mockFromImpl = () => ({
        update: (data: any) => {
          updatedData = data
          return { eq: () => Promise.resolve({ error: null }) }
        },
      })

      await financeService.updateInvoice('inv-1', { vendor_name: 'Updated Vendor' })
      expect(updatedData).toEqual({ vendor_name: 'Updated Vendor' })
    })
  })
})
