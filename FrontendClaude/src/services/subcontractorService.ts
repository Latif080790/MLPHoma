/**
 * subcontractorService.ts
 *
 * Manages Subcontractors, Mandors, SPK (Surat Perintah Kerja),
 * and Opname (Progress Claims).
 */

import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'
import { toast } from 'sonner'

// ─── Types ───

export interface SubcontractorInfo {
    id: string
    name: string
    type: 'MANDOR' | 'SUBCON'
    specialty: string // e.g., 'Bekisting', 'Besi', 'MEP'
    phone: string
    bankAccount: string
    rating: number // 1-5
    status: 'ACTIVE' | 'INACTIVE' | 'BLACKLISTED'
}

export type SPKStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'TERMINATED'

export interface SPK {
    id: string
    projectId: string
    wbsId: string // The WBS item this SPK is executing
    subconId: string
    spkNumber: string
    description: string

    // Financial Terms
    contractValue: number // Nilai Kontrak
    downPaymentPercentage: number // % DP
    retainagePercentage: number // % Retensi (e.g. 5%)

    startDate: string
    endDate: string
    status: SPKStatus

    createdAt: string
    updatedAt: string
}

export type OpnameStatus = 'DRAFT' | 'SUBMITTED' | 'REJECTED' | 'APPROVED' | 'POSTED_TO_FINANCE'

export interface Opname {
    id: string
    spkId: string
    projectId: string
    periodNumber: number // Periode ke-X
    date: string

    // Progress Calculation
    progressPercentage: number // Kumulatif progress % (0-100)
    previousProgressPercentage: number // Progress s/d periode lalu
    currentPeriodProgressPercentage: number // Progress periode ini

    // Financials
    grossAmount: number // Nilai progress kasar periode ini
    retentionDeduction: number // Potongan retensi
    dpRepaymentDeduction: number // Potongan pengembalian DP
    otherDeductions: number // Potongan lain-lain (material, dll)
    netPayable: number // Nilai bersih yang dibayarkan

    status: OpnameStatus
    notes: string

    approvedBy?: string
    approvedAt?: string

    createdAt: string
    updatedAt: string
}

// ─── Data Stores (In-Memory for Dev) ───

const subcons: SubcontractorInfo[] = [
    { id: 'sub-001', name: 'Pak Budi', type: 'MANDOR', specialty: 'Bekisting', phone: '08123456789', bankAccount: 'BCA 1234', rating: 4.5, status: 'ACTIVE' },
    { id: 'sub-002', name: 'PT Indah Karya MEP', type: 'SUBCON', specialty: 'MEP', phone: '021-98765', bankAccount: 'Mandiri 9876', rating: 4.8, status: 'ACTIVE' },
]

const spks: SPK[] = []
const opnames: Opname[] = []

// ─── Service ───

export const subcontractorService = {
    // ─── Subcontractors ───
    getSubcons(): SubcontractorInfo[] {
        return subcons
    },

    createSubcon(data: Omit<SubcontractorInfo, 'id'>): SubcontractorInfo {
        const subcon: SubcontractorInfo = {
            id: generateId('sub'),
            ...data
        }
        subcons.push(subcon)
        toast.success(`${data.type === 'MANDOR' ? 'Mandor' : 'Subcon'} Created`, { description: subcon.name })
        return subcon
    },

    // ─── SPKs ───
    getSPKs(projectId: string): SPK[] {
        return spks.filter(s => s.projectId === projectId)
    },

    createSPK(data: Omit<SPK, 'id' | 'createdAt' | 'updatedAt' | 'spkNumber' | 'status'>, userName: string): SPK {
        const spk: SPK = {
            id: generateId('spk'),
            spkNumber: `SPK-${new Date().getFullYear()}-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
            status: 'DRAFT',
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }
        spks.push(spk)

        auditService.log({
            action: 'CREATE',
            entity: 'spk',
            entityType: 'SUBCON',
            entityId: spk.id,
            details: { spkNumber: spk.spkNumber, wbsId: spk.wbsId, contractValue: spk.contractValue },
            userName
        })

        toast.success(`SPK Created: ${spk.spkNumber}`)
        return spk
    },

    activateSPK(spkId: string, userName: string) {
        const spk = spks.find(s => s.id === spkId)
        if (!spk) throw new Error("SPK not found")
        spk.status = 'ACTIVE'
        spk.updatedAt = new Date().toISOString()

        auditService.log({
            action: 'UPDATE',
            entity: 'spk',
            entityType: 'SUBCON',
            entityId: spk.id,
            details: { status: 'ACTIVE' },
            userName
        })
        toast.success(`SPK ${spk.spkNumber} Activated`)
    },

    // ─── Opnames (Progress Claims) ───
    getOpnames(projectId: string): Opname[] {
        return opnames.filter(o => o.projectId === projectId)
    },

    getOpnamesBySPK(spkId: string): Opname[] {
        return opnames.filter(o => o.spkId === spkId)
    },

    /**
     * Calculates and creates a new Opname draft for an SPK
     */
    draftOpname(spkId: string, requestedProgressPercentage: number, otherDeductions: number = 0): Opname {
        const spk = spks.find(s => s.id === spkId)
        if (!spk) throw new Error("SPK not found")
        if (spk.status !== 'ACTIVE') throw new Error("SPK is not active")

        const existingOpnames = this.getOpnamesBySPK(spkId).filter(o => o.status !== 'REJECTED')

        // Sum previous progress
        const previousProgressPercentage = existingOpnames.reduce((acc, curr) => acc + curr.currentPeriodProgressPercentage, 0)

        if (requestedProgressPercentage <= previousProgressPercentage) {
            throw new Error(`Requested progress (${requestedProgressPercentage}%) must be greater than previous cumulative progress (${previousProgressPercentage}%)`)
        }

        if (requestedProgressPercentage > 100) {
            throw new Error("Progress cannot exceed 100%")
        }

        const currentPeriodProgressPercentage = requestedProgressPercentage - previousProgressPercentage
        const periodNumber = existingOpnames.length + 1

        // Financial logic
        const grossAmount = spk.contractValue * (currentPeriodProgressPercentage / 100)
        const retentionDeduction = grossAmount * (spk.retainagePercentage / 100)

        // DP Repayment: Usually prorated over the progress. E.g., if DP was 20%, we deduct 20% from every progress claim until 100% progress.
        const dpRepaymentDeduction = grossAmount * (spk.downPaymentPercentage / 100)

        const netPayable = grossAmount - retentionDeduction - dpRepaymentDeduction - otherDeductions

        const opname: Opname = {
            id: generateId('opn'),
            spkId: spk.id,
            projectId: spk.projectId,
            periodNumber,
            date: new Date().toISOString(),
            progressPercentage: requestedProgressPercentage,
            previousProgressPercentage,
            currentPeriodProgressPercentage,
            grossAmount,
            retentionDeduction,
            dpRepaymentDeduction,
            otherDeductions,
            netPayable,
            status: 'DRAFT',
            notes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        }

        return opname
    },

    saveOpname(opname: Opname, userName: string): Opname {
        opnames.push(opname)
        auditService.log({
            action: 'CREATE',
            entity: 'opname',
            entityType: 'SUBCON',
            entityId: opname.id,
            details: { spkId: opname.spkId, netPayable: opname.netPayable },
            userName
        })
        toast.success(`Opname Period ${opname.periodNumber} Saved`)
        return opname
    },

    submitOpname(opnameId: string) {
        const opname = opnames.find(o => o.id === opnameId)
        if (!opname) throw new Error("Opname not found")
        opname.status = 'SUBMITTED'
        opname.updatedAt = new Date().toISOString()
        toast.success("Opname Submitted for Approval")
    },

    approveOpname(opnameId: string, userName: string) {
        const opname = opnames.find(o => o.id === opnameId)
        if (!opname) throw new Error("Opname not found")

        opname.status = 'APPROVED'
        opname.approvedBy = userName
        opname.approvedAt = new Date().toISOString()
        opname.updatedAt = new Date().toISOString()

        auditService.log({
            action: 'APPROVE',
            entity: 'opname',
            entityType: 'SUBCON',
            entityId: opname.id,
            userName
        })
        toast.success(`Opname Approved by ${userName}`)

        // Check if SPK is 100% complete
        if (opname.progressPercentage === 100) {
            const spk = spks.find(s => s.id === opname.spkId)
            if (spk) {
                spk.status = 'COMPLETED'
                toast.success(`SPK ${spk.spkNumber} marked as COMPLETED`)
            }
        }
    },

    rejectOpname(opnameId: string, reason: string, _userName: string) {
        const opname = opnames.find(o => o.id === opnameId)
        if (!opname) throw new Error("Opname not found")

        opname.status = 'REJECTED'
        opname.notes = reason
        opname.updatedAt = new Date().toISOString()

        toast.error("Opname Rejected")
    },

    postToFinance(opnameId: string, _userName: string) {
        const opname = opnames.find(o => o.id === opnameId)
        if (!opname) throw new Error("Opname not found")
        if (opname.status !== 'APPROVED') throw new Error("Opname must be approved first")

        opname.status = 'POSTED_TO_FINANCE'
        opname.updatedAt = new Date().toISOString()

        toast.success("Opname Posted to AP (Finance)")
        // Note: the actual finance AP creation will be handled in the component
        // by calling the finance service, or we can wire it up globally later.
    }
}
