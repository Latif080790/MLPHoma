

import { generateId } from '../lib/idGenerator'
import { assertSupabase } from '../lib/supabaseClient'
import { Invoice, ClientClaim, FinanceTransaction } from '../types/finance'
import { auditTrail } from '../lib/auditTrail'

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
        
        return data
    },

    async updateInvoiceStatus(id: string, status: string) {
        const client = assertSupabase()
        const { error } = await client
            .from('finance_invoices')
            .update({ status })
            .eq('id', id)

        if (error) throw error
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
    }
}
