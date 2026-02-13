
export type InvoiceStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE'
export type ClaimStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'PAID'

export interface Invoice {
    id: string
    project_id: string
    po_id?: string

    vendor_name: string
    invoice_number: string
    description?: string

    amount: number
    tax_amount: number
    total_amount: number

    due_date: string
    status: InvoiceStatus
    file_url?: string

    created_at: string
}

export interface ClientClaim {
    id: string
    project_id: string

    claim_number: string
    period_start?: string
    period_end?: string

    progress_percentage: number
    amount: number
    status: ClaimStatus

    notes?: string
    created_at: string
}

export interface FinanceTransaction {
    id: string
    project_id: string

    transaction_date: string
    description: string
    category: string

    amount: number

    reference_type?: 'INVOICE' | 'CLAIM' | 'OTHER'
    reference_id?: string
}
