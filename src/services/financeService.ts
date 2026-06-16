

import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'
import { Invoice, ClientClaim, FinanceTransaction, InvoiceStatus } from '../types/finance'
import { auditTrail } from '../lib/auditTrail'
import { auditService } from './auditService'
import { supplyChainService } from './supplyChainService'
import { notificationService } from './notificationService'
import { matchInvoice } from './invoiceMatchingService'

/**
 * Valid invoice status transitions.
 * Maps each status to the set of statuses it can transition to.
 * Terminal states (PAID) map to an empty array — no further transitions allowed.
 */
const INVOICE_STATUS_TRANSITIONS: Record<InvoiceStatus, InvoiceStatus[]> = {
    UNPAID:          ['PARTIAL', 'PAID', 'OVERDUE', 'PENDING_PAYMENT'],
    PARTIAL:         ['PAID', 'OVERDUE', 'PENDING_PAYMENT'],
    OVERDUE:         ['PAID', 'PENDING_PAYMENT'],
    PENDING_PAYMENT: ['PAID', 'UNPAID'],
    PAID:            [],   // terminal — no further transitions
}

export const financeService = {
    // --- Invoices (AP) ---
    async getInvoices(projectId: string): Promise<Invoice[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('finance_invoices')
            .select('*')
            .eq('project_id', projectId)
            .order('due_date', { ascending: true })

        if (error) {
            console.warn('[financeService] getInvoices error:', error.message)
            return []
        }
        return data || []
    },

    async createInvoice(invoice: Partial<Invoice>, userId?: string, userName?: string) {
        const client = assertSupabase()
        const id = generateId()

        const { data, error } = await client
            .from('finance_invoices')
            .insert({
                id,
                ...invoice
            })
            .select()
            .single()

        if (error) throw error
        
        // Audit log
        if (userId && userName) {
            await auditTrail.logInvoiceCreated(
                data.id,
                data.invoice_number,
                data.vendor_name,
                data.total_amount,
                userId,
                userName
            )
        }
        
        // Auto 3-way match after invoice creation
        if (data.po_id && data.project_id) {
            void financeService.performThreeWayMatch(
                (invoice.po_id as string) ?? '',
                data.project_id as string,
                data as Invoice,
            )
        }

        return data
    },

    async updateInvoiceStatus(id: string, newStatus: string, userId?: string, userName?: string): Promise<void> {
        const client = assertSupabase()

        // 1. Fetch current invoice to get its existing status and invoice_number
        const { data: current, error: fetchError } = await client
            .from('finance_invoices')
            .select('status, invoice_number')
            .eq('id', id)
            .single()

        if (fetchError) throw fetchError

        const currentStatus = current.status as InvoiceStatus
        const invoiceNumber = current.invoice_number as string

        // 2. Validate that the transition is permitted
        const allowedNext = INVOICE_STATUS_TRANSITIONS[currentStatus]
        if (allowedNext === undefined) {
            throw new Error(
                `[financeService] Unknown current invoice status "${currentStatus}" for invoice ${invoiceNumber}`
            )
        }
        if (!allowedNext.includes(newStatus as InvoiceStatus)) {
            throw new Error(
                `[financeService] Invalid status transition for invoice ${invoiceNumber}: ` +
                `"${currentStatus}" → "${newStatus}". ` +
                `Allowed next statuses: ${allowedNext.length ? allowedNext.join(', ') : '(none — terminal state)'}`
            )
        }

        // 3. Persist the status change
        const { error } = await client
            .from('finance_invoices')
            .update({ status: newStatus })
            .eq('id', id)

        if (error) throw error

        // 4. Audit trail — must never block the main operation
        try {
            await auditService.log({
                userId,
                userName: userName ?? 'System',
                action: 'STATUS_CHANGE',
                entity: 'finance_invoices',
                entityType: 'INVOICE',
                entityId: id,
                details: {
                    from: currentStatus,
                    to: newStatus,
                    invoice_number: invoiceNumber,
                },
            })
        } catch (auditErr) {
            console.warn('[financeService] updateInvoiceStatus audit log failed:', auditErr)
        }
    },

    // --- Claims (AR) ---
    async getClaims(projectId: string): Promise<ClientClaim[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('finance_claims')
            .select('*')
            .eq('project_id', projectId)
            .order('period_end', { ascending: false })

        if (error) {
            console.warn('[financeService] getClaims error:', error.message)
            return []
        }
        return data || []
    },

    async createClaim(claim: Partial<ClientClaim>) {
        const client = assertSupabase()
        const id = generateId()

        const { data, error } = await client
            .from('finance_claims')
            .insert({
                id,
                ...claim
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    // --- Transactions (Cash Flow) ---
    async getTransactions(projectId: string): Promise<FinanceTransaction[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('finance_transactions')
            .select('*')
            .eq('project_id', projectId)
            .order('transaction_date', { ascending: false })

        if (error) {
            console.warn('[financeService] getTransactions error:', error.message)
            return []
        }
        return data || []
    },

    async recordTransaction(txn: Partial<FinanceTransaction>) {
        const client = assertSupabase()
        const id = generateId()

        const { data, error } = await client
            .from('finance_transactions')
            .insert({
                id,
                ...txn
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    // Helper: Auto-record payment transaction when Invoice is PAID
    async payInvoice(
        invoiceId: string, 
        projectId: string, 
        amount: number,
        userId?: string,
        userName?: string
    ) {
        // Get invoice details for audit log
        const client = assertSupabase()
        const { data: invoice } = await client
            .from('finance_invoices')
            .select('*')
            .eq('id', invoiceId)
            .single()
        
        // 1. Update Invoice Status
        await this.updateInvoiceStatus(invoiceId, 'PAID')

        // 2. Record Transaction (Expense)
        await this.recordTransaction({
            project_id: projectId,
            description: `Payment for Invoice ${invoiceId}`,
            category: 'Payment Out',
            amount: -Math.abs(amount),
            reference_type: 'INVOICE',
            reference_id: invoiceId
        })
        
        // 3. Audit log
        if (userId && userName && invoice) {
            await auditTrail.logInvoicePayment(
                invoiceId,
                invoice.invoice_number,
                amount,
                userId,
                userName
            )
        }
    },

    // --- Claims status transition ---
    async updateClaimStatus(
        id: string, 
        status: string,
        userId?: string,
        userName?: string
    ) {
        const client = assertSupabase()
        
        // Get claim details for audit log
        const { data: claim } = await client
            .from('finance_claims')
            .select('*')
            .eq('id', id)
            .single()
        
        const { error } = await client
            .from('finance_claims')
            .update({ status })
            .eq('id', id)

        if (error) throw error
        
        // Audit log based on status transition
        if (userId && userName && claim) {
            if (status === 'SUBMITTED') {
                await auditTrail.logClaimSubmitted(
                    id,
                    claim.claim_number,
                    claim.amount,
                    userId,
                    userName
                )
            } else if (status === 'APPROVED') {
                await auditTrail.logClaimApproved(
                    id,
                    claim.claim_number,
                    claim.amount,
                    userId,
                    userName
                )
            } else if (status === 'PAID') {
                await auditTrail.logClaimPaid(
                    id,
                    claim.claim_number,
                    claim.amount,
                    userId,
                    userName
                )
            }
        }
    },

    // --- Invoice update ---
    async updateInvoice(id: string, data: Partial<Invoice>) {
        const client = assertSupabase()
        const { error } = await client
            .from('finance_invoices')
            .update(data)
            .eq('id', id)

        if (error) throw error
    },

    async performThreeWayMatch(
        poId: string,
        projectId: string,
        invoice: Invoice,
    ): Promise<void> {
        try {
            const [pos, invTxns] = await Promise.all([
                supplyChainService.getPurchaseOrders(projectId),
                supplyChainService.getInventoryTransactions(projectId),
            ])
            const matchResult = matchInvoice(invoice, pos, invTxns)
            if (matchResult.status === 'mismatch' || matchResult.status === 'partial') {
                const highVariance = matchResult.discrepancies.find(
                    (d) => !d.tolerable && d.variance > 5,
                )
                if (highVariance) {
                    await notificationService.notifyByRole(projectId, 'manager', {
                        projectId,
                        type: 'BUDGET_CRITICAL',
                        severity: 'critical',
                        title: `3-Way Match Alert: ${invoice.invoice_number}`,
                        message: `Invoice ${invoice.invoice_number} exceeds PO by ${highVariance.variance.toFixed(1)}%. Review required.`,
                        entityType: 'INVOICE',
                        entityId: invoice.id,
                    })
                }
            }
        } catch (err) {
            console.warn('[Finance] 3-way match failed for PO', poId, err)
        }
    },

    // --- Analytics / Matching ---
    async getThreeWayMatchData(projectId: string) {
        const client = assertSupabase()

        // Get POs for the project
        const { data: pos, error: poErr } = await client
            .from('purchase_orders')
            .select('id, po_number, vendor_name, total_amount, status')
            .eq('project_id', projectId)

        if (poErr) throw poErr
        if (!pos || pos.length === 0) {
            return { pos: [], grns: [] }
        }

        const poIds = pos.map(po => po.id)

        // Get GRNs linked to these POs
        const { data: grns } = await client
            .from('grn')
            .select('id, po_id, total_amount, status')
            .in('po_id', poIds)

        return { pos, grns: grns || [] }
    }
}
