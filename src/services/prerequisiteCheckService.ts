/**
 * prerequisiteCheckService.ts
 *
 * Enforces business logic guards before critical project state transitions.
 * Cross-references data from multiple stores to ensure data integrity.
 */

import { useTimelineStore } from '../store/timelineStore'
import { useChangeOrderStore } from '../store/changeOrderStore'
import { useFinanceStore } from '../store/financeStore'
import { useProjectStore } from '../store/projectStore'

export interface HandoverReadiness {
    isReady: boolean
    reasons: string[]
    metrics: {
        progress: number
        pendingCcos: number
        outstandingBalance: number
    }
}

export const prerequisiteCheckService = {
    /**
     * Checks if a project is operationally and financially ready for handover.
     */
    async checkHandoverReady(projectId: string): Promise<HandoverReadiness> {
        const reasons: string[] = []
        
        // 1. Check Physical Progress (must be 100%)
        const tasks = useTimelineStore.getState().getTasks(projectId)
        const totalTasks = tasks.length
        const completedTasks = tasks.filter(t => t.progress >= 100 || t.status === 'completed').length
        const overallProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0
        
        if (overallProgress < 100) {
            reasons.push(`Physical progress is only ${overallProgress.toFixed(1)}%. All tasks must be 100% complete.`)
        }

        // 2. Check Change Orders (all must be finalized - APPROVED or REJECTED)
        const ccos = useChangeOrderStore.getState().orders.filter(c => c.project_id === projectId)
        const pendingCcos = ccos.filter(c => !['APPROVED', 'REJECTED'].includes(c.status)).length
        
        if (pendingCcos > 0) {
            reasons.push(`There are ${pendingCcos} pending Change Orders. Resolve all VOs before handover.`)
        }

        // 3. Check Financial Balance (must be zero outstanding AP)
        // We check FinanceStore invoices (AP) for any that are not PAID
        const invoices = useFinanceStore.getState().invoices.filter(i => i.project_id === projectId)
        const unpaidInvoices = invoices.filter(i => i.status !== 'PAID')
        const outstandingAmount = unpaidInvoices.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)
        
        if (outstandingAmount > 0) {
            reasons.push(`Outstanding balance of IDR ${outstandingAmount.toLocaleString()} in Accounts Payable.`)
        }

        return {
            isReady: reasons.length === 0,
            reasons,
            metrics: {
                progress: overallProgress,
                pendingCcos,
                outstandingBalance: outstandingAmount
            }
        }
    }
}
