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
  c.in = () => c
  c.order = () => c
  c.limit = () => c
  c.single = () => Promise.resolve(result)
  c.insert = () => c
  c.update = () => c
  c.delete = () => c
  c.upsert = () => c
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

// ---------- Tests ----------

describe('financeService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFromImpl = () => makeChain({ data: [], error: null })
  })

  // ... (previous tests are abbreviated for clarity, they use makeChain or simple objects) ...

  describe('payInvoice', () => {
    it('should update invoice status AND record expense transaction', async () => {
      const calls: { method: string; table: string; data?: any }[] = []

      mockFromImpl = (table: string) => {
        if (table === 'finance_invoices') {
          return {
            select: () => ({
              eq: () => ({
                single: () => {
                  calls.push({ method: 'select-invoice', table })
                  return Promise.resolve({ data: { id: 'inv-1', invoice_number: 'INV-1' }, error: null })
                }
              })
            }),
            update: (data: any) => {
              calls.push({ method: 'update', table, data })
              return { eq: () => Promise.resolve({ error: null }) }
            }
          }
        }
        if (table === 'finance_transactions') {
          return {
            insert: (data: any) => {
              calls.push({ method: 'insert', table, data })
              return {
                select: () => ({
                  single: () => Promise.resolve({ data: { ...data }, error: null })
                })
              }
            }
          }
        }
        return makeChain({ data: [], error: null })
      }

      await financeService.payInvoice('inv-1', 'P1', 10_000_000)

      const selectCall = calls.find(c => c.method === 'select-invoice')
      const updateCall = calls.find(c => c.method === 'update' && c.table === 'finance_invoices')
      const insertCall = calls.find(c => c.method === 'insert' && c.table === 'finance_transactions')

      expect(selectCall).toBeDefined()
      expect(updateCall).toBeDefined()
      expect(updateCall!.data).toEqual({ status: 'PAID' })
      expect(insertCall).toBeDefined()
      expect(insertCall!.data.amount).toBe(-10_000_000)
    })
  })

  describe('updateClaimStatus', () => {
    it('should update claim status', async () => {
      let updatedData: any = null
      let selectCalled = false

      mockFromImpl = (table: string) => {
        if (table === 'finance_claims') {
          return {
            select: () => ({
              eq: () => ({
                single: () => {
                  selectCalled = true
                  return Promise.resolve({ data: { id: 'cl-1', claim_number: 'CL-1' }, error: null })
                }
              })
            }),
            update: (data: any) => {
              updatedData = data
              return { eq: () => Promise.resolve({ error: null }) }
            }
          }
        }
        return makeChain({ data: [], error: null })
      }

      await financeService.updateClaimStatus('cl-1', 'APPROVED')
      expect(selectCalled).toBe(true)
      expect(updatedData).toEqual({ status: 'APPROVED' })
    })
  })

  // ... (keep remaining tests) ...
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
