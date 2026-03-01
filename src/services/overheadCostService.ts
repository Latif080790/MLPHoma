/**
 * overheadCostService.ts
 *
 * Overhead & Indirect Cost Management Service.
 * Tracks project costs that don't map to specific RAB/WBS items,
 * such as site overhead, insurance, permits, mobilization, tax, profit margins.
 *
 * These costs are typically a percentage of direct costs or fixed amounts,
 * and are essential for accurate project financial reporting.
 */

import { generateId } from '../lib/idGenerator'
import { auditService } from './auditService'
import { toast } from 'sonner'

// ─── Types ───

export type OverheadCategory =
    | 'OVERHEAD_SITE'      // Overhead umum lokasi
    | 'OVERHEAD_OFFICE'    // Overhead kantor pusat
    | 'INSURANCE'          // Asuransi proyek
    | 'PERMIT'             // Izin & perijinan
    | 'TAX'                // Pajak (PPN, PPh)
    | 'MOBILIZATION'       // Mob/demob alat & personel
    | 'CONTINGENCY'        // Cadangan risiko
    | 'PROFIT'             // Keuntungan kontraktor
    | 'BOND'               // Jaminan (Performance/Bid Bond)
    | 'UTILITIES'          // Utilitas (listrik, air, dll)
    | 'OTHER'              // Lain-lain

export type CalculationMethod = 'PERCENTAGE' | 'FIXED' | 'LUMP_SUM'

export interface OverheadItem {
    id: string
    projectId: string
    category: OverheadCategory
    label: string
    description: string
    /** How to calculate */
    method: CalculationMethod
    /** Percentage of direct cost (if method=PERCENTAGE) */
    percentage?: number
    /** Fixed amount (if method=FIXED or LUMP_SUM) */
    fixedAmount?: number
    /** Calculated total */
    calculatedAmount: number
    /** Is this item included in the contract price? */
    inContract: boolean
    /** Notes */
    notes: string
    createdAt: string
    updatedAt: string
}

export interface CreateOverheadInput {
    projectId: string
    category: OverheadCategory
    label: string
    description?: string
    method: CalculationMethod
    percentage?: number
    fixedAmount?: number
    inContract?: boolean
    notes?: string
}

export interface OverheadSummary {
    /** Total direct cost (from RAB) */
    directCost: number
    /** Total overhead / indirect cost */
    totalOverhead: number
    /** Overhead ratio (overhead / direct) */
    overheadRatio: number
    /** Grand total (direct + overhead) */
    grandTotal: number
    /** Breakdown by category */
    byCategory: { category: OverheadCategory; label: string; total: number; count: number }[]
    /** Items list */
    items: OverheadItem[]
}

// ─── Category Labels ───

export const OVERHEAD_CATEGORY_LABELS: Record<OverheadCategory, string> = {
    OVERHEAD_SITE: 'Overhead Lokasi',
    OVERHEAD_OFFICE: 'Overhead Kantor',
    INSURANCE: 'Asuransi',
    PERMIT: 'Perijinan',
    TAX: 'Pajak',
    MOBILIZATION: 'Mobilisasi/Demobilisasi',
    CONTINGENCY: 'Cadangan Risiko',
    PROFIT: 'Keuntungan',
    BOND: 'Jaminan',
    UTILITIES: 'Utilitas',
    OTHER: 'Lain-lain',
}

export const OVERHEAD_CATEGORY_ICONS: Record<OverheadCategory, string> = {
    OVERHEAD_SITE: '🏗️',
    OVERHEAD_OFFICE: '🏢',
    INSURANCE: '🛡️',
    PERMIT: '📜',
    TAX: '💰',
    MOBILIZATION: '🚛',
    CONTINGENCY: '⚠️',
    PROFIT: '📈',
    BOND: '🔒',
    UTILITIES: '⚡',
    OTHER: '📋',
}

// ─── In-Memory Store ───

const overheadStore: OverheadItem[] = []

// ─── Service ───

export const overheadCostService = {

    /**
     * Add a new overhead cost item.
     */
    addItem(input: CreateOverheadInput, directCost: number = 0): OverheadItem {
        let calculatedAmount = 0

        if (input.method === 'PERCENTAGE' && input.percentage) {
            calculatedAmount = directCost * (input.percentage / 100)
        } else if (input.method === 'FIXED' || input.method === 'LUMP_SUM') {
            calculatedAmount = input.fixedAmount || 0
        }

        const item: OverheadItem = {
            id: generateId('oh'),
            projectId: input.projectId,
            category: input.category,
            label: input.label,
            description: input.description || '',
            method: input.method,
            percentage: input.percentage,
            fixedAmount: input.fixedAmount,
            calculatedAmount,
            inContract: input.inContract ?? true,
            notes: input.notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        }

        overheadStore.push(item)

        auditService.log({
            action: 'CREATE',
            entity: 'overhead_cost',
            entityType: 'OVERHEAD',
            entityId: item.id,
            details: {
                category: input.category,
                label: input.label,
                method: input.method,
                calculatedAmount,
            },
        })

        toast.success('Overhead Item Added', {
            description: `${OVERHEAD_CATEGORY_LABELS[input.category]}: ${input.label}`,
        })

        return item
    },

    /**
     * Update an existing overhead item.
     */
    updateItem(itemId: string, updates: Partial<CreateOverheadInput>, directCost: number = 0): OverheadItem {
        const item = overheadStore.find(i => i.id === itemId)
        if (!item) throw new Error(`Overhead item ${itemId} not found`)

        if (updates.category !== undefined) item.category = updates.category
        if (updates.label !== undefined) item.label = updates.label
        if (updates.description !== undefined) item.description = updates.description
        if (updates.method !== undefined) item.method = updates.method
        if (updates.percentage !== undefined) item.percentage = updates.percentage
        if (updates.fixedAmount !== undefined) item.fixedAmount = updates.fixedAmount
        if (updates.inContract !== undefined) item.inContract = updates.inContract
        if (updates.notes !== undefined) item.notes = updates.notes

        // Recalculate
        if (item.method === 'PERCENTAGE' && item.percentage) {
            item.calculatedAmount = directCost * (item.percentage / 100)
        } else {
            item.calculatedAmount = item.fixedAmount || 0
        }

        item.updatedAt = new Date().toISOString()
        return item
    },

    /**
     * Remove an overhead item.
     */
    removeItem(itemId: string): void {
        const idx = overheadStore.findIndex(i => i.id === itemId)
        if (idx === -1) throw new Error(`Overhead item ${itemId} not found`)
        overheadStore.splice(idx, 1)
        toast.success('Overhead Item Removed')
    },

    /**
     * Get all overhead items for a project.
     */
    getByProject(projectId: string): OverheadItem[] {
        return overheadStore.filter(i => i.projectId === projectId)
    },

    /**
     * Recalculate all percentage-based items when direct cost changes.
     */
    recalculate(projectId: string, newDirectCost: number): void {
        overheadStore
            .filter(i => i.projectId === projectId && i.method === 'PERCENTAGE')
            .forEach(item => {
                item.calculatedAmount = newDirectCost * ((item.percentage || 0) / 100)
                item.updatedAt = new Date().toISOString()
            })
    },

    /**
     * Get comprehensive overhead summary for a project.
     */
    getSummary(projectId: string, directCost: number): OverheadSummary {
        const items = overheadStore.filter(i => i.projectId === projectId)

        // Recalculate percentage items with current direct cost
        items.forEach(item => {
            if (item.method === 'PERCENTAGE' && item.percentage) {
                item.calculatedAmount = directCost * (item.percentage / 100)
            }
        })

        const totalOverhead = items.reduce((sum, i) => sum + i.calculatedAmount, 0)

        // Group by category
        const categoryMap = new Map<OverheadCategory, { total: number; count: number }>()
        items.forEach(item => {
            const existing = categoryMap.get(item.category)
            if (existing) {
                existing.total += item.calculatedAmount
                existing.count++
            } else {
                categoryMap.set(item.category, { total: item.calculatedAmount, count: 1 })
            }
        })

        const byCategory = Array.from(categoryMap.entries()).map(([category, data]) => ({
            category,
            label: OVERHEAD_CATEGORY_LABELS[category],
            total: data.total,
            count: data.count,
        }))

        return {
            directCost,
            totalOverhead,
            overheadRatio: directCost > 0 ? (totalOverhead / directCost) * 100 : 0,
            grandTotal: directCost + totalOverhead,
            byCategory,
            items,
        }
    },

    /**
     * Apply standard construction overhead template to a project.
     * Common Indonesian construction overhead structure.
     */
    applyTemplate(projectId: string, directCost: number): OverheadItem[] {
        const template: Omit<CreateOverheadInput, 'projectId'>[] = [
            { category: 'OVERHEAD_SITE', label: 'Overhead Lokasi Proyek', method: 'PERCENTAGE', percentage: 5, notes: 'Kantor lapangan, utilitas, keamanan' },
            { category: 'OVERHEAD_OFFICE', label: 'Overhead Kantor Pusat', method: 'PERCENTAGE', percentage: 3.5, notes: 'Administrasi pusat' },
            { category: 'PROFIT', label: 'Keuntungan Kontraktor', method: 'PERCENTAGE', percentage: 10, notes: 'Margin keuntungan' },
            { category: 'TAX', label: 'PPN 11%', method: 'PERCENTAGE', percentage: 11, notes: 'Pajak Pertambahan Nilai' },
            { category: 'INSURANCE', label: 'Asuransi CAR/TPL', method: 'PERCENTAGE', percentage: 0.5, notes: 'Construction All Risk' },
            { category: 'CONTINGENCY', label: 'Cadangan Risiko', method: 'PERCENTAGE', percentage: 2.5, notes: 'Contingency fund' },
            { category: 'MOBILIZATION', label: 'Mob/Demob', method: 'LUMP_SUM', fixedAmount: Math.round(directCost * 0.015), notes: 'Mobilisasi dan demobilisasi' },
            { category: 'BOND', label: 'Jaminan Pelaksanaan', method: 'PERCENTAGE', percentage: 0.3, notes: 'Performance bond 5% × 6% premium' },
        ]

        return template.map(t => this.addItem({ ...t, projectId }, directCost))
    },
}
