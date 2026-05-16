export interface Subcontractor {
    id: string
    project_id: string
    company_name: string
    contact_person?: string
    phone?: string
    email?: string
    npwp?: string
    qualification_grade?: 'K1' | 'K2' | 'K3' | 'M1' | 'M2' | 'B1' | 'B2'
    specialization?: string[]
    performance_rating?: number
    is_active: boolean
    notes?: string
    created_at: string
    updated_at: string
}

export interface Subcontract {
    id: string
    project_id: string
    subcontractor_id: string
    contract_number: string
    scope_description: string
    contract_value: number
    start_date?: string
    end_date?: string
    status: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | 'COMPLETED' | 'TERMINATED'
    retention_percentage: number
    retention_released: number
    paid_amount: number
    wbs_item_id?: string
    created_at: string
    updated_at: string
    /** Joined — populated when queried with subcontractor data */
    subcontractor?: Subcontractor
}

export interface SubcontractProgress {
    id: string
    subcontract_id: string
    claim_date: string
    claim_number: string
    progress_percentage: number
    claimed_amount: number
    approved_amount?: number
    retention_deducted: number
    net_payment: number
    status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'PAID'
    notes?: string
    created_at: string
    updated_at: string
}

export interface SubcontractorSummary {
    totalSubcontractors: number
    activeContracts: number
    totalContractValue: number
    totalPaid: number
    totalRetentionHeld: number
    pendingClaims: number
}
