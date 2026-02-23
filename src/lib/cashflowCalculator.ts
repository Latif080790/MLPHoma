import { CurvaSDataPoint } from '../types/curvaS'
import { PaymentTerms } from '../store/projectStore'
import { Invoice, ClientClaim } from '../types/finance'

export interface CashRow {
  period: string
  outflow: number
  inflow: number
  cumOutflow: number
  cumInflow: number
  balance: number
}

export function calculateCashFlow(
  points: CurvaSDataPoint[],
  terms: PaymentTerms,
  totalBudget: number,
  invoices: Invoice[] = [],
  claims: ClientClaim[] = []
): CashRow[] {
  if (!points || points.length === 0) return []

  const dpPct = terms.downPaymentPercent ?? 0.1
  const billingPct = terms.billingPercent ?? 1.0 // Default 100% of progress is billable
  const retentionPct = terms.retentionRate ?? 0.05
  const loanInterestRate = terms.loanInterestRate ?? 0 // Annual rate (e.g. 0.12)
  const taxRate = terms.taxRate ?? 0 // Tax on billing (e.g. 0.03)

  const dpAmount = totalBudget * dpPct

  let cumOutflow = 0
  let cumInflow = 0
  let prevProgress = 0
  let currentBalance = 0

  // Sort points by date
  const sortedPoints = [...points].sort((a, b) => a.date.localeCompare(b.date))

  return sortedPoints.map((p, idx) => {
    // ------------------------------------------------------------------
    // 1. OUTFLOW (Theoretical + Actual AP Commitments)
    // ------------------------------------------------------------------

    // Base Theoretical Outflow from S-Curve
    const prevPoint = idx > 0 ? sortedPoints[idx - 1] : null
    const currentCost = (p.actualCost || p.plannedCost || 0)
    const prevCost = prevPoint ? (prevPoint.actualCost || prevPoint.plannedCost || 0) : 0
    let periodOutflow = Math.max(0, currentCost - prevCost)

    // Add rigid AP Commitments (Unpaid Invoices due in this period)
    const periodStart = prevPoint ? prevPoint.date : '1970-01-01'
    const periodEnd = p.date

    const invoicesDueThisPeriod = invoices.filter(inv =>
      inv.status !== 'PAID' &&
      inv.due_date > periodStart &&
      inv.due_date <= periodEnd
    )

    const apCommitments = invoicesDueThisPeriod.reduce((sum, inv) => sum + (inv.total_amount || 0), 0)

    // We assume theoretical periodOutflow somewhat predicted AP.
    // If real AP > theoretical, we must use real AP as the absolute floor of outflow.
    periodOutflow = Math.max(periodOutflow, apCommitments)

    // ------------------------------------------------------------------
    // 2. INFLOW (Theoretical + Actual AR Commitments)
    // ------------------------------------------------------------------
    // 1. DP in first period? Or separate?
    // Let's assume DP is received in first period.
    let periodInflow = 0
    if (idx === 0) {
      periodInflow += dpAmount
    }

    // 2. Progress Billing
    // Progress made this period
    const currentProgress = (p.actualProgress || p.plannedProgress || 0)
    const progressDelta = Math.max(0, currentProgress - prevProgress)

    // Billable amount
    const grossBill = (progressDelta / 100) * totalBudget * billingPct

    // Deduct retention
    const netBill = grossBill * (1 - retentionPct)

    // Deduct DP recovery? 
    // Usually DP is recovered pro-rata. 
    // Recovery = (progressDelta / 100) * dpAmount
    const dpRecovery = (progressDelta / 100) * dpAmount

    const finalBill = Math.max(0, netBill - dpRecovery)

    let periodInflow = finalBill

    // Add rigid AR Expectations (Unpaid Claims due in this period)
    const claimsDueThisPeriod = claims.filter(c =>
      c.status !== 'PAID' &&
      c.dueDate && c.dueDate > periodStart &&
      c.dueDate <= periodEnd
    )
    const arExpectations = claimsDueThisPeriod.reduce((sum, c) => sum + (c.amount || 0), 0)

    // Ensure inflow is at least the rigidly expected AR
    periodInflow = Math.max(periodInflow, arExpectations)

    // Release retention if progress reaches 100% (or very close)
    if (currentProgress >= 99.9 && prevProgress < 99.9) {
      // Calculate total retention held
      // Total retention = Total Budget * Billing% * Retention%
      // Assuming billing is based on 100% progress eventually
      const totalRetention = totalBudget * billingPct * retentionPct
      periodInflow += totalRetention
    }

    // --- NEW: Tax Calculation ---
    // Tax is calculated on the Inflow (Billing)
    // Assuming Tax is an Outflow (Payment to Gov)
    if (taxRate > 0 && periodInflow > 0) {
      const taxAmount = periodInflow * taxRate
      periodOutflow += taxAmount
    }

    // --- NEW: Loan Interest Calculation ---
    // Interest is calculated on the *previous* period's negative balance (deficit)
    // Monthly rate = Annual Rate / 12
    if (loanInterestRate > 0 && currentBalance < 0) {
      const monthlyRate = loanInterestRate / 12
      const interestExpense = Math.abs(currentBalance) * monthlyRate
      periodOutflow += interestExpense
    }

    // Update state
    cumOutflow += periodOutflow
    cumInflow += periodInflow
    prevProgress = currentProgress
    currentBalance = cumInflow - cumOutflow

    return {
      period: p.date,
      outflow: periodOutflow,
      inflow: periodInflow,
      cumOutflow,
      cumInflow,
      balance: currentBalance
    }
  })
}
