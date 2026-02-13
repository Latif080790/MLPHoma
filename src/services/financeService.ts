
import { v4 as uuidv4 } from 'uuid'
import { assertSupabase } from '../lib/supabaseClient'
import { Invoice, ClientClaim, FinanceTransaction } from '../types/finance'

export const financeService = {
    // --- Invoices (AP) ---
    async getInvoices(projectId: string): Promise<Invoice[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('invoices')
            .select('*')
            .eq('project_id', projectId)
            .order('due_date', { ascending: true })

        if (error) throw error
        return data || []
    },

    async createInvoice(invoice: Partial<Invoice>) {
        const client = assertSupabase()
        const id = uuidv4()

        const { data, error } = await client
            .from('invoices')
            .insert({
                id,
                ...invoice
            })
            .select()
            .single()

        if (error) throw error
        return data
    },

    async updateInvoiceStatus(id: string, status: string) {
        const client = assertSupabase()
        const { error } = await client
            .from('invoices')
            .update({ status })
            .eq('id', id)

        if (error) throw error
    },

    // --- Claims (AR) ---
    async getClaims(projectId: string): Promise<ClientClaim[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('client_claims')
            .select('*')
            .eq('project_id', projectId)
            .order('period_end', { ascending: false })

        if (error) throw error
        return data || []
    },

    async createClaim(claim: Partial<ClientClaim>) {
        const client = assertSupabase()
        const id = uuidv4()

        const { data, error } = await client
            .from('client_claims')
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

        if (error) throw error
        return data || []
    },

    async recordTransaction(txn: Partial<FinanceTransaction>) {
        const client = assertSupabase()
        const id = uuidv4()

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
    async payInvoice(invoiceId: string, projectId: string, amount: number) {
        // 1. Update Invoice Status
        await this.updateInvoiceStatus(invoiceId, 'PAID')

        // 2. Record Transaction (Expense)
        await this.recordTransaction({
            project_id: projectId,
            description: `Payment for Invoice ${invoiceId}`, // In real app use invoice number
            category: 'Payment Out',
            amount: -Math.abs(amount), // Negative for outflow
            reference_type: 'INVOICE',
            reference_id: invoiceId
        })
    }
}
