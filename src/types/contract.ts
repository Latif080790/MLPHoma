/**
 * contract.ts
 * Type definitions for Contract Management module.
 */

// ------------------------------------------------------------------
// Enums
// ------------------------------------------------------------------

export type ContractType =
    | 'LUMP_SUM'
    | 'UNIT_PRICE'
    | 'COST_PLUS'
    | 'GUARANTEED_MAXIMUM'

export type ContractStatus =
    | 'DRAFT'
    | 'ACTIVE'
    | 'AMENDED'
    | 'SUSPENDED'
    | 'COMPLETED'
    | 'TERMINATED'

export type ContractPartyRole = 'OWNER' | 'CONTRACTOR' | 'SUBCONTRACTOR' | 'CONSULTANT'

// ------------------------------------------------------------------
// Core entity
// ------------------------------------------------------------------

export interface Contract {
    id: string
    projectId: string

    contractNumber: string
    title: string
    type: ContractType
    status: ContractStatus

    partyName: string
    partyRole: ContractPartyRole
    partyContact?: string

    originalValue: number
    currentValue: number      // originalValue + sum of approved VOs
    retentionPct: number      // e.g. 5 (percent)
    advancePaymentPct: number // e.g. 10 (percent), 0 if none

    startDate: string
    endDate: string
    actualEndDate?: string

    description?: string
    scopeOfWork?: string

    attachmentUrls?: string[]
    createdBy?: string
    createdAt: string
    updatedAt: string
}

export interface CreateContractInput {
    projectId: string
    contractNumber?: string   // auto-generated if omitted
    title: string
    type: ContractType
    partyName: string
    partyRole: ContractPartyRole
    partyContact?: string
    originalValue: number
    retentionPct?: number
    advancePaymentPct?: number
    startDate: string
    endDate: string
    description?: string
    scopeOfWork?: string
    createdBy?: string
}

// ------------------------------------------------------------------
// Variation Order
// ------------------------------------------------------------------

export type VariationOrderStatus =
    | 'DRAFT'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'

export interface VariationOrder {
    id: string
    contractId: string
    projectId: string

    voNumber: string
    title: string
    description?: string

    valueChange: number       // positive = addition, negative = deduction
    scheduleChangeDays: number

    status: VariationOrderStatus
    submittedAt?: string
    approvedAt?: string
    approvedBy?: string
    rejectionReason?: string

    createdBy?: string
    createdAt: string
    updatedAt: string
}

export interface CreateVariationOrderInput {
    contractId: string
    projectId: string
    title: string
    description?: string
    valueChange: number
    scheduleChangeDays?: number
    createdBy?: string
}

// ------------------------------------------------------------------
// Display helpers
// ------------------------------------------------------------------

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
    LUMP_SUM: 'Lump Sum',
    UNIT_PRICE: 'Unit Price / Harga Satuan',
    COST_PLUS: 'Cost Plus',
    GUARANTEED_MAXIMUM: 'Guaranteed Maximum Price',
}

export const CONTRACT_STATUS_LABELS: Record<ContractStatus, string> = {
    DRAFT: 'Draft',
    ACTIVE: 'Aktif',
    AMENDED: 'Diamendemen',
    SUSPENDED: 'Ditangguhkan',
    COMPLETED: 'Selesai',
    TERMINATED: 'Dihentikan',
}
