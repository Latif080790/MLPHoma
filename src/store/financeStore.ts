/**
 * financeStore.ts
 * Zustand store for Finance module — AP Invoices, AR Claims, Transactions.
 * Centralizes state, provides aging calculation, and overdue detection.
 */

import { create } from 'zustand'
import { financeService } from '../services/financeService'
import { Invoice, ClientClaim, FinanceTransaction, InvoiceStatus, ClaimStatus } from '../types/finance'
import { toast } from 'sonner'

export interface AgingBucket {
  current: Invoice[]
  days30: Invoice[]
  days60: Invoice[]
  days90plus: Invoice[]
  totalCurrent: number
  total30: number
  total60: number
  total90plus: number
}

interface FinanceSummary {
  totalAP: number
  totalAPOutstanding: number
  totalAR: number
  totalAROutstanding: number
  totalIncome: number
  totalExpense: number
  netCashflow: number
  overdueCount: number
  overdueAmount: number
}

interface FinanceState {
  invoices: Invoice[]
  claims: ClientClaim[]
  transactions: FinanceTransaction[]
  loading: boolean
  error: string | null

  // Derived
  summary: FinanceSummary
  aging: AgingBucket

  // Actions
  fetchAll: (projectId: string) => Promise<void>
  fetchInvoices: (projectId: string) => Promise<void>
  fetchClaims: (projectId: string) => Promise<void>
  fetchTransactions: (projectId: string) => Promise<void>

  createInvoice: (invoice: Partial<Invoice>) => Promise<void>
  payInvoice: (invoiceId: string, projectId: string, amount: number) => Promise<void>
  markOverdue: (projectId: string) => Promise<void>

  createClaim: (claim: Partial<ClientClaim>) => Promise<void>
  updateClaimStatus: (id: string, status: ClaimStatus, projectId: string) => Promise<void>

  recordTransaction: (txn: Partial<FinanceTransaction>) => Promise<void>
}

function calcSummary(invoices: Invoice[], claims: ClientClaim[], transactions: FinanceTransaction[]): FinanceSummary {
  const totalAP = invoices.reduce((s, i) => s + (i.total_amount || 0), 0)
  const totalAPOutstanding = invoices.filter(i => i.status !== 'PAID').reduce((s, i) => s + (i.total_amount || 0), 0)
  const totalAR = claims.reduce((s, c) => s + (c.amount || 0), 0)
  const totalAROutstanding = claims.filter(c => c.status !== 'PAID').reduce((s, c) => s + (c.amount || 0), 0)
  const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalExpense = Math.abs(transactions.filter(t => t.amount < 0).reduce((s, t) => s + t.amount, 0))
  const overdueInvoices = invoices.filter(i => i.status === 'OVERDUE' || (i.status === 'UNPAID' && new Date(i.due_date) < new Date()))
  return {
    totalAP,
    totalAPOutstanding,
    totalAR,
    totalAROutstanding,
    totalIncome,
    totalExpense,
    netCashflow: totalIncome - totalExpense,
    overdueCount: overdueInvoices.length,
    overdueAmount: overdueInvoices.reduce((s, i) => s + (i.total_amount || 0), 0)
  }
}

function calcAging(invoices: Invoice[]): AgingBucket {
  const now = new Date()
  const unpaid = invoices.filter(i => i.status !== 'PAID')
  const current: Invoice[] = []
  const days30: Invoice[] = []
  const days60: Invoice[] = []
  const days90plus: Invoice[] = []

  for (const inv of unpaid) {
    const due = new Date(inv.due_date)
    const diffDays = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24))
    if (diffDays <= 0) current.push(inv)
    else if (diffDays <= 30) days30.push(inv)
    else if (diffDays <= 60) days60.push(inv)
    else days90plus.push(inv)
  }

  return {
    current, days30, days60, days90plus,
    totalCurrent: current.reduce((s, i) => s + i.total_amount, 0),
    total30: days30.reduce((s, i) => s + i.total_amount, 0),
    total60: days60.reduce((s, i) => s + i.total_amount, 0),
    total90plus: days90plus.reduce((s, i) => s + i.total_amount, 0)
  }
}

const emptySummary: FinanceSummary = { totalAP: 0, totalAPOutstanding: 0, totalAR: 0, totalAROutstanding: 0, totalIncome: 0, totalExpense: 0, netCashflow: 0, overdueCount: 0, overdueAmount: 0 }
const emptyAging: AgingBucket = { current: [], days30: [], days60: [], days90plus: [], totalCurrent: 0, total30: 0, total60: 0, total90plus: 0 }

export const useFinanceStore = create<FinanceState>((set, get) => ({
  invoices: [],
  claims: [],
  transactions: [],
  loading: false,
  error: null,
  summary: emptySummary,
  aging: emptyAging,

  fetchAll: async (projectId: string) => {
    set({ loading: true, error: null })
    try {
      const [invoices, claims, transactions] = await Promise.all([
        financeService.getInvoices(projectId),
        financeService.getClaims(projectId),
        financeService.getTransactions(projectId)
      ])
      set({
        invoices, claims, transactions,
        summary: calcSummary(invoices, claims, transactions),
        aging: calcAging(invoices)
      })
    } catch (err: any) {
      set({ error: err.message })
      toast.error('Failed to load finance data')
    } finally {
      set({ loading: false })
    }
  },

  fetchInvoices: async (projectId: string) => {
    try {
      const invoices = await financeService.getInvoices(projectId)
      const { claims, transactions } = get()
      set({
        invoices,
        summary: calcSummary(invoices, claims, transactions),
        aging: calcAging(invoices)
      })
    } catch (err: any) {
      toast.error('Failed to load invoices')
    }
  },

  fetchClaims: async (projectId: string) => {
    try {
      const claims = await financeService.getClaims(projectId)
      const { invoices, transactions } = get()
      set({
        claims,
        summary: calcSummary(invoices, claims, transactions)
      })
    } catch (err: any) {
      toast.error('Failed to load claims')
    }
  },

  fetchTransactions: async (projectId: string) => {
    try {
      const transactions = await financeService.getTransactions(projectId)
      const { invoices, claims } = get()
      set({
        transactions,
        summary: calcSummary(invoices, claims, transactions)
      })
    } catch (err: any) {
      toast.error('Failed to load transactions')
    }
  },

  createInvoice: async (invoice: Partial<Invoice>) => {
    set({ loading: true })
    try {
      await financeService.createInvoice(invoice)
      toast.success('Invoice created')
      if (invoice.project_id) await get().fetchInvoices(invoice.project_id)
    } catch (err: any) {
      toast.error('Failed to create invoice: ' + err.message)
    } finally {
      set({ loading: false })
    }
  },

  payInvoice: async (invoiceId: string, projectId: string, amount: number) => {
    set({ loading: true })
    try {
      await financeService.payInvoice(invoiceId, projectId, amount)
      toast.success('Payment recorded')
      await get().fetchAll(projectId)
    } catch (err: any) {
      toast.error('Payment failed: ' + err.message)
    } finally {
      set({ loading: false })
    }
  },

  markOverdue: async (projectId: string) => {
    const { invoices } = get()
    const now = new Date()
    const overdue = invoices.filter(i => i.status === 'UNPAID' && new Date(i.due_date) < now)
    for (const inv of overdue) {
      try {
        await financeService.updateInvoiceStatus(inv.id, 'OVERDUE')
      } catch { /* continue */ }
    }
    if (overdue.length > 0) {
      toast.info(`${overdue.length} invoice(s) marked overdue`)
      await get().fetchInvoices(projectId)
    }
  },

  createClaim: async (claim: Partial<ClientClaim>) => {
    set({ loading: true })
    try {
      await financeService.createClaim(claim)
      toast.success('Claim created')
      if (claim.project_id) await get().fetchClaims(claim.project_id)
    } catch (err: any) {
      toast.error('Failed to create claim: ' + err.message)
    } finally {
      set({ loading: false })
    }
  },

  updateClaimStatus: async (id: string, status: ClaimStatus, projectId: string) => {
    set({ loading: true })
    try {
      await financeService.updateClaimStatus(id, status)
      toast.success(`Claim status updated to ${status}`)
      await get().fetchClaims(projectId)
    } catch (err: any) {
      toast.error('Failed to update claim: ' + err.message)
    } finally {
      set({ loading: false })
    }
  },

  recordTransaction: async (txn: Partial<FinanceTransaction>) => {
    set({ loading: true })
    try {
      await financeService.recordTransaction(txn)
      toast.success('Transaction recorded')
      if (txn.project_id) await get().fetchTransactions(txn.project_id)
    } catch (err: any) {
      toast.error('Failed to record transaction: ' + err.message)
    } finally {
      set({ loading: false })
    }
  }
}))
