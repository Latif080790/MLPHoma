/**
 * financeReconciliationService.ts
 *
 * Cost reconciliation between Finance (AP invoices) and Supply Chain (PO).
 * Links PO → Invoice to ensure every purchase order has matching payment records,
 * and flags discrepancies (overpayment, underpayment, unmatched invoices).
 *
 * This service bridges the gap identified in the NZT-48 audit where
 * Finance and Supply Chain modules operated in complete isolation.
 */

import { assertSupabase } from '../lib/supabaseClient'

export interface ReconciliationItem {
  poId: string
  poNumber: string
  vendorName: string
  poAmount: number
  invoicedAmount: number
  paidAmount: number
  variance: number          // poAmount - invoicedAmount
  variancePct: number
  status: 'matched' | 'under-invoiced' | 'over-invoiced' | 'no-invoice' | 'over-paid'
  matchedInvoiceIds: string[]
}

export interface ReconciliationReport {
  projectId: string
  timestamp: string
  totalPOs: number
  matchedCount: number
  discrepancyCount: number
  totalPoValue: number
  totalInvoicedValue: number
  totalPaidValue: number
  items: ReconciliationItem[]
}

export const financeReconciliationService = {
  /**
   * Reconcile PO spend against Finance invoices for a project.
   * Links POs to invoices via vendor_name matching and po_id FK.
   */
  async reconcile(projectId: string): Promise<ReconciliationReport> {
    const client = assertSupabase()

    // Fetch POs and invoices in parallel
    const [poResult, invoiceResult] = await Promise.all([
      client
        .from('purchase_orders')
        .select('id, po_number, vendor_name, total_amount, status')
        .eq('project_id', projectId),
      client
        .from('finance_invoices')
        .select('id, po_id, vendor_name, total_amount, status')
        .eq('project_id', projectId),
    ])

    const pos = poResult.data || []
    const invoices = invoiceResult.data || []

    // Index invoices by po_id for O(1) lookup
    const invoicesByPoId = new Map<string, typeof invoices>()
    for (const inv of invoices) {
      if (inv.po_id) {
        if (!invoicesByPoId.has(inv.po_id)) invoicesByPoId.set(inv.po_id, [])
        invoicesByPoId.get(inv.po_id)!.push(inv)
      }
    }

    // Also build vendor-name index for fuzzy matching fallback
    const invoicesByVendor = new Map<string, typeof invoices>()
    for (const inv of invoices) {
      const key = (inv.vendor_name || '').toLowerCase().trim()
      if (key) {
        if (!invoicesByVendor.has(key)) invoicesByVendor.set(key, [])
        invoicesByVendor.get(key)!.push(inv)
      }
    }

    const items: ReconciliationItem[] = []

    for (const po of pos) {
      // Try direct po_id link first, then vendor name fallback
      let matchedInvoices = invoicesByPoId.get(po.id) || []
      if (matchedInvoices.length === 0) {
        const vendorKey = (po.vendor_name || '').toLowerCase().trim()
        matchedInvoices = invoicesByVendor.get(vendorKey) || []
      }

      const invoicedAmount = matchedInvoices.reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)
      const paidAmount = matchedInvoices
        .filter(inv => inv.status === 'PAID')
        .reduce((sum, inv) => sum + Number(inv.total_amount || 0), 0)

      const poAmount = Number(po.total_amount || 0)
      const variance = poAmount - invoicedAmount
      const variancePct = poAmount > 0 ? Math.round((variance / poAmount) * 10000) / 100 : 0

      let status: ReconciliationItem['status']
      if (matchedInvoices.length === 0) {
        status = 'no-invoice'
      } else if (Math.abs(variance) < 1) {
        status = paidAmount > invoicedAmount ? 'over-paid' : 'matched'
      } else if (variance > 0) {
        status = 'under-invoiced'
      } else {
        status = 'over-invoiced'
      }

      items.push({
        poId: po.id,
        poNumber: po.po_number || po.id,
        vendorName: po.vendor_name || 'Unknown',
        poAmount,
        invoicedAmount,
        paidAmount,
        variance,
        variancePct,
        status,
        matchedInvoiceIds: matchedInvoices.map(inv => inv.id),
      })
    }

    const matchedCount = items.filter(i => i.status === 'matched').length
    const discrepancyCount = items.length - matchedCount

    return {
      projectId,
      timestamp: new Date().toISOString(),
      totalPOs: pos.length,
      matchedCount,
      discrepancyCount,
      totalPoValue: items.reduce((s, i) => s + i.poAmount, 0),
      totalInvoicedValue: items.reduce((s, i) => s + i.invoicedAmount, 0),
      totalPaidValue: items.reduce((s, i) => s + i.paidAmount, 0),
      items: items.sort((a, b) => Math.abs(b.variance) - Math.abs(a.variance)),
    }
  },
}
