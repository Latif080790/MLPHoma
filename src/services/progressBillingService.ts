/**
 * progressBillingService.ts
 * FASE 2.3: Progress → Finance Billing Integration
 *
 * When progress is recorded, this service:
 * 1. Calculates billing weight (% progress × WBS contract value)
 * 2. Auto-generates/updates a Client Claim (AR) draft
 * 3. Notifies Finance team when a claim is ready for submission
 *
 * This bridges the gap between field progress and office billing.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import { notificationService } from './notificationService'
import { auditService } from './auditService'
import { financeService } from './financeService'

// ---------- Types ----------

export interface ProgressBillingInput {
    projectId: string
    periodStart: string
    periodEnd: string
    /** Overall project progress percentage at this point */
    overallProgress: number
    /** Breakdown per WBS if available */
    wbsBreakdown?: Array<{
        wbsId: string
        wbsName: string
        /** Progress % for this WBS */
        progress: number
        /** Contract value for this WBS */
        contractValue: number
    }>
}

export interface BillingSummary {
    totalContractValue: number
    previousBilled: number
    currentBillingAmount: number
    retentionAmount: number
    netClaimAmount: number
    claimId: string | null
}

// ---------- Service ----------

export const progressBillingService = {

    /**
     * Calculate billing amount based on progress and contract data.
     * Default retention = 5% (common in Indonesian construction).
     */
    calculateBilling(
        overallProgress: number,
        totalContractValue: number,
        previousBilledAmount: number,
        retentionPct: number = 5,
    ): { grossAmount: number; retentionAmount: number; netAmount: number } {
        const grossEarned = (overallProgress / 100) * totalContractValue
        const currentGross = Math.max(0, grossEarned - previousBilledAmount)
        const retentionAmount = (retentionPct / 100) * currentGross
        const netAmount = currentGross - retentionAmount

        return {
            grossAmount: currentGross,
            retentionAmount,
            netAmount: Math.max(0, netAmount),
        }
    },

    /**
     * Get total previously billed amount for a project
     */
    async getPreviousBilledAmount(projectId: string): Promise<number> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('client_claims')
            .select('amount')
            .eq('project_id', projectId)
            .in('status', ['SUBMITTED', 'APPROVED', 'PAID'])

        if (error) throw error
        return (data || []).reduce((sum, claim) => sum + Number(claim.amount || 0), 0)
    },

    /**
     * Get project contract value from project settings / RAB total
     */
    async getContractValue(projectId: string): Promise<number> {
        const client = assertSupabase()

        // Try to get from projects table first (contract_value field)
        const { data: project } = await client
            .from('projects')
            .select('contract_value, total_budget')
            .eq('id', projectId)
            .single()

        if (project?.contract_value) return Number(project.contract_value)
        if (project?.total_budget) return Number(project.total_budget)

        // Fallback: sum RAB items
        const { data: rabItems } = await client
            .from('rab_items')
            .select('total_price')
            .eq('project_id', projectId)

        return (rabItems || []).reduce((sum, item) => sum + Number(item.total_price || 0), 0)
    },

    /**
     * Generate a billing claim from progress data.
     * This is the main integration point called after progress submission.
     */
    async generateBillingFromProgress(input: ProgressBillingInput): Promise<BillingSummary> {
        const contractValue = await this.getContractValue(input.projectId)
        const previousBilled = await this.getPreviousBilledAmount(input.projectId)

        const billing = this.calculateBilling(
            input.overallProgress,
            contractValue,
            previousBilled,
        )

        // Only create a claim if there's meaningful amount to bill
        const MINIMUM_CLAIM_THRESHOLD = 100000 // Rp 100k minimum
        let claimId: string | null = null

        if (billing.netAmount >= MINIMUM_CLAIM_THRESHOLD) {
            // Check if a DRAFT claim already exists for this period
            const client = assertSupabase()
            const { data: existingClaim } = await client
                .from('client_claims')
                .select('id')
                .eq('project_id', input.projectId)
                .eq('status', 'DRAFT')
                .eq('period_end', input.periodEnd)
                .maybeSingle()

            if (existingClaim) {
                // Update existing draft
                const { error } = await client
                    .from('client_claims')
                    .update({
                        progress_percentage: input.overallProgress,
                        amount: billing.netAmount,
                        notes: `Auto-updated from progress input. Gross: Rp ${billing.grossAmount.toLocaleString('id-ID')}, Retention: Rp ${billing.retentionAmount.toLocaleString('id-ID')}`,
                    })
                    .eq('id', existingClaim.id)

                if (error) throw error
                claimId = existingClaim.id
            } else {
                // Create new claim
                const claimNumber = `CLM-${new Date(input.periodEnd).getFullYear()}-${String(new Date(input.periodEnd).getMonth() + 1).padStart(2, '0')}`

                const newClaim = await financeService.createClaim({
                    project_id: input.projectId,
                    claim_number: claimNumber,
                    period_start: input.periodStart,
                    period_end: input.periodEnd,
                    progress_percentage: input.overallProgress,
                    amount: billing.netAmount,
                    status: 'DRAFT',
                    notes: `Auto-generated from progress. Gross: Rp ${billing.grossAmount.toLocaleString('id-ID')}, Retention 5%: Rp ${billing.retentionAmount.toLocaleString('id-ID')}`,
                })
                claimId = newClaim.id
            }

            // Notify Finance team
            try {
                await notificationService.notifyByRole(input.projectId, 'admin', {
                    type: 'BILLING_MILESTONE',
                    title: `Client Claim Siap: Rp ${billing.netAmount.toLocaleString('id-ID')}`,
                    message: `Progress ${input.overallProgress.toFixed(1)}% → Claim ${billing.netAmount.toLocaleString('id-ID')} (setelah retensi 5%) siap disubmit.`,
                    severity: 'info',
                    projectId: input.projectId,
                    metadata: { claimId, amount: billing.netAmount },
                })
            } catch (e) {
                console.warn('Notification failed:', e)
            }

            // Audit
            try {
                await auditService.log({
                    action: 'CREATE',
                    entity: 'client_claims',
                    entityType: 'BILLING',
                    entityId: claimId!,
                    details: {
                        progress: input.overallProgress,
                        grossAmount: billing.grossAmount,
                        retention: billing.retentionAmount,
                        netAmount: billing.netAmount,
                    },
                })
            } catch (e) {
                console.warn('Audit log failed:', e)
            }
        }

        return {
            totalContractValue: contractValue,
            previousBilled,
            currentBillingAmount: billing.grossAmount,
            retentionAmount: billing.retentionAmount,
            netClaimAmount: billing.netAmount,
            claimId,
        }
    },

    /**
     * Quick helper: Generate monthly billing from latest overall progress
     * Called from Progress page after submitting progress data.
     */
    async generateMonthlyBilling(projectId: string, progressPct: number): Promise<BillingSummary> {
        const now = new Date()
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]
        const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]

        return this.generateBillingFromProgress({
            projectId,
            periodStart,
            periodEnd,
            overallProgress: progressPct,
        })
    },
}
