/**
 * invoiceMatchingService.ts
 *
 * 3-Way Invoice Matching Engine.
 * Validates invoices against Purchase Orders (PO) and Goods Receipts (GRN)
 * to ensure financial integrity before payment approval.
 *
 * 3-Way Match: PO ↔ GRN ↔ Invoice
 * Used by: Finance.tsx, InvoiceMatchDialog, CommandCenter
 */

import type { Invoice } from '../types/finance'
import type { PurchaseOrder, PoItem, InventoryTransaction } from '../types/supply-chain'

// ─── Types ───

export type MatchStatus = 'matched' | 'partial' | 'mismatch' | 'no_po'

export interface MatchDiscrepancy {
    field: string
    expected: string | number
    actual: string | number
    variance: number
    /** Is this within tolerance? */
    tolerable: boolean
}

export interface POMatchDetail {
    poNumber: string
    poId: string
    vendorName: string
    poTotal: number
    poStatus: string
    items: PoItem[]
}

export interface GRNMatchDetail {
    totalReceived: number
    totalOrdered: number
    receiptPercentage: number
    transactions: {
        materialName: string
        quantity: number
        date: string
        referenceDoc?: string
    }[]
}

export interface InvoiceMatchResult {
    invoiceId: string
    invoiceNumber: string
    status: MatchStatus
    overallScore: number // 0-100

    /** PO comparison */
    po: POMatchDetail | null

    /** GRN comparison */
    grn: GRNMatchDetail | null

    /** List of discrepancies found */
    discrepancies: MatchDiscrepancy[]

    /** Human-readable summary */
    summary: string
}

// ─── Config ───
const PRICE_TOLERANCE_PERCENT = 5 // ±5% price variance allowed
const QUANTITY_TOLERANCE_PERCENT = 2 // ±2% quantity variance allowed

// ─── Core Engine ───

/**
 * Perform 3-way match for a single invoice.
 * @param invoice - The invoice to validate
 * @param purchaseOrders - All POs for the project
 * @param inventoryTransactions - All GRN transactions for the project
 */
export function matchInvoice(
    invoice: Invoice,
    purchaseOrders: PurchaseOrder[],
    inventoryTransactions: InventoryTransaction[]
): InvoiceMatchResult {
    const discrepancies: MatchDiscrepancy[] = []

    // ── Step 1: Find linked PO ──
    if (!invoice.po_id) {
        return {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            status: 'no_po',
            overallScore: 0,
            po: null,
            grn: null,
            discrepancies: [],
            summary: 'Invoice has no linked Purchase Order. Manual verification required.',
        }
    }

    const po = purchaseOrders.find(p => p.id === invoice.po_id)
    if (!po) {
        return {
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoice_number,
            status: 'mismatch',
            overallScore: 0,
            po: null,
            grn: null,
            discrepancies: [{
                field: 'PO Reference',
                expected: invoice.po_id,
                actual: 'NOT FOUND',
                variance: 100,
                tolerable: false,
            }],
            summary: `Referenced PO (${invoice.po_id}) not found in system.`,
        }
    }

    const poDetail: POMatchDetail = {
        poNumber: po.poNumber,
        poId: po.id,
        vendorName: po.vendorName || '-',
        poTotal: po.totalAmount,
        poStatus: po.status,
        items: po.items || [],
    }

    // ── Step 2: Price/Amount Match (Invoice vs PO) ──
    const priceVariance = Math.abs(invoice.total_amount - po.totalAmount)
    const priceVariancePercent = po.totalAmount > 0
        ? (priceVariance / po.totalAmount) * 100
        : (invoice.total_amount > 0 ? 100 : 0)

    if (priceVariancePercent > PRICE_TOLERANCE_PERCENT) {
        discrepancies.push({
            field: 'Total Amount',
            expected: po.totalAmount,
            actual: invoice.total_amount,
            variance: priceVariancePercent,
            tolerable: false,
        })
    } else if (priceVariancePercent > 0) {
        discrepancies.push({
            field: 'Total Amount',
            expected: po.totalAmount,
            actual: invoice.total_amount,
            variance: priceVariancePercent,
            tolerable: true,
        })
    }

    // ── Step 3: GRN Match (Goods Receipt vs PO) ──
    // Find all "IN" transactions that could relate to this PO
    const grnTransactions = inventoryTransactions.filter(
        t => t.transactionType === 'IN' && t.projectId === invoice.project_id
    )

    // Match GRN items against PO items
    let totalOrdered = 0
    let totalReceived = 0

    if (po.items && po.items.length > 0) {
        for (const poItem of po.items) {
            totalOrdered += poItem.quantity
            const itemName = (poItem.itemName || poItem.rapItemName || '').toLowerCase().trim()

            // Find matching receipts
            const matchingReceipts = grnTransactions.filter(
                t => t.materialName.toLowerCase().trim() === itemName
            )
            const receivedQty = matchingReceipts.reduce((sum, t) => sum + t.quantity, 0)
            totalReceived += receivedQty

            // Check quantity variance
            if (poItem.quantity > 0) {
                const qtyVariance = Math.abs(poItem.quantity - receivedQty)
                const qtyVariancePercent = (qtyVariance / poItem.quantity) * 100

                if (receivedQty === 0) {
                    discrepancies.push({
                        field: `GRN: ${itemName || 'Unknown Item'}`,
                        expected: poItem.quantity,
                        actual: 0,
                        variance: 100,
                        tolerable: false,
                    })
                } else if (qtyVariancePercent > QUANTITY_TOLERANCE_PERCENT) {
                    discrepancies.push({
                        field: `GRN: ${itemName || 'Unknown Item'}`,
                        expected: poItem.quantity,
                        actual: receivedQty,
                        variance: qtyVariancePercent,
                        tolerable: qtyVariancePercent <= PRICE_TOLERANCE_PERCENT,
                    })
                }
            }
        }
    }

    const receiptPercentage = totalOrdered > 0
        ? Math.round((totalReceived / totalOrdered) * 100)
        : 0

    const grnDetail: GRNMatchDetail = {
        totalReceived,
        totalOrdered,
        receiptPercentage,
        transactions: grnTransactions.slice(0, 10).map(t => ({
            materialName: t.materialName,
            quantity: t.quantity,
            date: t.createdAt,
            referenceDoc: t.referenceDoc,
        })),
    }

    // ── Step 4: Calculate Overall Score & Status ──
    const intolerableCount = discrepancies.filter(d => !d.tolerable).length
    const tolerableCount = discrepancies.filter(d => d.tolerable).length

    let overallScore = 100
    overallScore -= intolerableCount * 25
    overallScore -= tolerableCount * 5
    overallScore = Math.max(0, Math.min(100, overallScore))

    let status: MatchStatus = 'matched'
    if (intolerableCount > 0) {
        status = 'mismatch'
    } else if (tolerableCount > 0 || receiptPercentage < 100) {
        status = 'partial'
    }

    // ── Step 5: Generate Summary ──
    let summary = ''
    if (status === 'matched') {
        summary = 'All checks passed. Invoice matches PO and GRN within tolerance.'
    } else if (status === 'partial') {
        summary = `Partial match: ${tolerableCount} minor variance(s) within tolerance. GRN receipt at ${receiptPercentage}%.`
    } else {
        summary = `Mismatch detected: ${intolerableCount} critical discrepancy(ies). Review required before payment.`
    }

    return {
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_number,
        status,
        overallScore,
        po: poDetail,
        grn: grnDetail,
        discrepancies,
        summary,
    }
}

/**
 * Batch match all invoices for a project.
 */
export function matchAllInvoices(
    invoices: Invoice[],
    purchaseOrders: PurchaseOrder[],
    inventoryTransactions: InventoryTransaction[]
): InvoiceMatchResult[] {
    return invoices.map(inv => matchInvoice(inv, purchaseOrders, inventoryTransactions))
}

/**
 * Get the CSS color class for a match status badge.
 */
export function getMatchStatusColor(status: MatchStatus): string {
    switch (status) {
        case 'matched': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        case 'partial': return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
        case 'mismatch': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
        case 'no_po': return 'bg-muted/50 text-muted-foreground'
    }
}

/**
 * Get the label for a match status.
 */
export function getMatchStatusLabel(status: MatchStatus): string {
    switch (status) {
        case 'matched': return '✅ Matched'
        case 'partial': return '⚠️ Partial'
        case 'mismatch': return '❌ Mismatch'
        case 'no_po': return '—  No PO'
    }
}
