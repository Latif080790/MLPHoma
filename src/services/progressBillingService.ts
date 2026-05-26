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
import { notificationService } from './notificationService'
import { auditService } from './auditService'
import { financeService } from './financeService'
import { approvalService } from './approvalService'

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

        if (error) {
            console.warn('[progressBilling] getPreviousBilledAmount error:', error.message)
            return 0
        }
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

            // Auto-route to approval workflow (PROGRESS_CLAIM entity type)
            try {
                const periodLabel = `${input.periodStart} – ${input.periodEnd}`
                const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
                await approvalService.createApproval({
                    projectId: input.projectId,
                    entityType: 'PROGRESS_CLAIM',
                    entityId: claimId!,
                    title: `Progress Claim ${periodLabel}`,
                    description: `Klaim termin progress ${input.overallProgress.toFixed(1)}% untuk periode ${periodLabel}.`,
                    approverRole: 'manager',
                    impactSummary: {
                        grossAmount: billing.grossAmount,
                        retentionAmount: billing.retentionAmount,
                        netAmount: billing.netAmount,
                        progress: input.overallProgress,
                        period: periodLabel,
                        formattedNet: formatter.format(billing.netAmount),
                    },
                })
            } catch (e) {
                // Non-blocking — claim exists; approval routing failure is logged
                console.warn('[progressBilling] Auto-approval routing failed:', e)
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

    // ------------------------------------------------------------------
    // Payment Certificate
    // ------------------------------------------------------------------

    /**
     * Generate a Payment Certificate as a downloadable HTML blob.
     * Triggered after PROGRESS_CLAIM approval — produces a signed-off PDF-ready document.
     *
     * The function returns a Blob of text/html which the caller can then:
     *   const url = URL.createObjectURL(blob)
     *   window.open(url)
     * or pass to a print dialog.
     */
    async generatePaymentCertificate(claimId: string): Promise<Blob> {
        const client = assertSupabase()

        // Load claim details
        const { data: claim, error: claimErr } = await client
            .from('client_claims')
            .select('*, projects(name, contract_value)')
            .eq('id', claimId)
            .single()

        if (claimErr || !claim) {
            throw new Error(`Payment certificate: claim not found — ${claimErr?.message ?? claimId}`)
        }

        const fmt = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 })
        const projectName = (claim.projects as { name?: string } | null)?.name ?? claim.project_id
        const grossAmount = Number(claim.amount) / (1 - 0.05)   // reverse the 5% retention to get gross
        const retentionAmount = grossAmount - Number(claim.amount)
        const netAmount = Number(claim.amount)
        const issuedAt = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })

        const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <title>Payment Certificate — ${claim.claim_number}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 12px; color: #1e293b; margin: 40px; }
    h1 { font-size: 18px; text-align: center; margin: 0 0 4px; }
    .subtitle { text-align: center; color: #64748b; margin: 0 0 24px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
    th, td { padding: 8px 10px; border: 1px solid #e2e8f0; }
    th { background: #f1f5f9; text-align: left; }
    .amount { text-align: right; font-family: monospace; }
    .total-row td { font-weight: bold; background: #f8fafc; }
    .net-row td { font-weight: bold; font-size: 14px; background: #eff6ff; color: #1e40af; }
    .sig-row { margin-top: 40px; display: flex; gap: 40px; }
    .sig-box { flex: 1; border-top: 1px solid #cbd5e1; padding-top: 8px; text-align: center; }
    .footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; }
    @media print { .no-print { display: none; } }
  </style>
</head>
<body>
  <h1>SERTIFIKAT PEMBAYARAN</h1>
  <p class="subtitle">Payment Certificate — ${claim.claim_number}</p>

  <table>
    <tr><th style="width:35%">Proyek</th><td>${projectName}</td></tr>
    <tr><th>No. Klaim</th><td>${claim.claim_number}</td></tr>
    <tr><th>Periode</th><td>${claim.period_start ?? '—'} s/d ${claim.period_end ?? '—'}</td></tr>
    <tr><th>Progress (%)</th><td>${Number(claim.progress_percentage ?? 0).toFixed(2)}%</td></tr>
    <tr><th>Tanggal Terbit</th><td>${issuedAt}</td></tr>
  </table>

  <table>
    <thead>
      <tr><th>Keterangan</th><th class="amount">Jumlah (IDR)</th></tr>
    </thead>
    <tbody>
      <tr><td>Nilai Tagihan Bruto</td><td class="amount">${fmt.format(grossAmount)}</td></tr>
      <tr><td>Retensi 5%</td><td class="amount">(${fmt.format(retentionAmount)})</td></tr>
      <tr class="net-row"><td>Nilai Tagihan Neto</td><td class="amount">${fmt.format(netAmount)}</td></tr>
    </tbody>
  </table>

  ${claim.notes ? `<p style="font-size:11px;color:#64748b;margin-bottom:32px;"><em>${claim.notes}</em></p>` : ''}

  <div class="sig-row">
    <div class="sig-box">
      <p>Diajukan oleh</p>
      <br/><br/><br/>
      <p>____________________________</p>
      <p>Project Manager</p>
    </div>
    <div class="sig-box">
      <p>Disetujui oleh</p>
      <br/><br/><br/>
      <p>____________________________</p>
      <p>Finance Manager</p>
    </div>
    <div class="sig-box">
      <p>Diterima oleh</p>
      <br/><br/><br/>
      <p>____________________________</p>
      <p>Pemberi Kerja / Klien</p>
    </div>
  </div>

  <div class="footer">
    Dokumen ini digenerate otomatis oleh MLPHoma pada ${new Date().toISOString()}. Claim ID: ${claimId}.
  </div>

  <div class="no-print" style="margin-top:24px;text-align:center;">
    <button onclick="window.print()" style="padding:10px 24px;background:#1e3a5f;color:#fff;border:none;border-radius:6px;cursor:pointer;font-size:14px;">
      Cetak / Simpan PDF
    </button>
  </div>
</body>
</html>`

        return new Blob([html], { type: 'text/html' })
    },

    /**
     * Trigger a browser download of the Payment Certificate for a given claim.
     * Convenience wrapper around generatePaymentCertificate.
     */
    async downloadPaymentCertificate(claimId: string, claimNumber?: string): Promise<void> {
        const blob = await this.generatePaymentCertificate(claimId)
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = `payment-certificate-${claimNumber ?? claimId}.html`
        link.click()
        URL.revokeObjectURL(url)
    },
}
