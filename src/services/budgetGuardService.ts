/**
 * Budget Guard Service
 * 
 * Provides budget availability checks before procurement commits.
 * Prevents overspend by validating against RAP budget allocations.
 * 
 * Epic S1.1: Budget Guard on Procurement
 * 
 * @module budgetGuardService
 */

import { assertSupabase } from '../lib/supabaseClient'
import { auditService } from './auditService'

/** Budget check result for single item */
export interface BudgetCheckItem {
  /** RAP Item ID */
  rapItemId: string
  /** Item display name */
  itemName: string
  /** Total budget allocated */
  totalBudget: number
  /** Currently committed amount (pending POs) */
  committed: number
  /** Actually spent amount (completed transactions) */
  actual: number
  /** Available remaining budget */
  remaining: number
  /** Requested amount for this check */
  requested: number
  /** Whether this item exceeds budget */
  exceeds: boolean
  /** Overage amount (0 if within budget) */
  overageAmount: number
}

/** Overall budget check result */
export interface BudgetCheckResult {
  /** Whether ALL items are within budget */
  isValid: boolean
  /** Whether ANY item exceeds budget */
  hasExceeded: boolean
  /** Whether ANY item requires PM approval (close to limit) */
  requiresApproval: boolean
  /** Individual item results */
  items: BudgetCheckItem[]
  /** Summary message */
  message: string
  /** Items that exceeded budget */
  exceededItems: BudgetCheckItem[]
  /** Items requiring approval */
  approvalItems: BudgetCheckItem[]
}

/** Item to be checked against budget */
export interface CheckableItem {
  /** RAP item ID (optional - if not linked, check skipped) */
  rapItemId?: string
  /** Item name for error messages */
  itemName: string
  /** Quantity to procure */
  quantity: number
  /** Unit price */
  unitPrice: number
}

/**
 * Approval threshold: require PM approval when remaining budget
 * falls below this percentage after commit
 */
const APPROVAL_THRESHOLD_PERCENT = 10

/**
 * Check budget availability for procurement items
 * 
 * @param projectId - Project ID for context
 * @param items - Items to check
 * @returns Budget check result with validation details
 */
export async function checkBudgetAvailability(
  projectId: string,
  items: CheckableItem[]
): Promise<BudgetCheckResult> {
  // Filter items that have RAP linkage
  const linkedItems = items.filter(item => item.rapItemId)

  if (linkedItems.length === 0) {
    // No linked items - no budget validation needed
    return {
      isValid: true,
      hasExceeded: false,
      requiresApproval: false,
      items: [],
      message: 'No budget-linked items to validate',
      exceededItems: [],
      approvalItems: []
    }
  }

  const rapItemIds = linkedItems.map(i => i.rapItemId!)

  // Fetch RAP items with budget info
  const { data: dbRapItems, error: dbError } = await assertSupabase()
    .from('rap_items')
    .select(`
      id,
      qty_budget,
      unit_price_budget,
      committed_cost,
      actual_cost,
      ahsp_items ( name ),
      rab_items ( name )
    `)
    .in('id', rapItemIds)
    .eq('project_id', projectId)

  if (dbError) {
    throw new Error(`Budget Guard: Failed to fetch RAP items - ${dbError.message}`)
  }

  if (!dbRapItems || dbRapItems.length === 0) {
    throw new Error('Budget Guard: RAP items not found for validation')
  }

  // Build map for quick lookup
  const rapMap = new Map<string, any>()
  dbRapItems.forEach(r => rapMap.set(r.id, r))

  // Process each item
  const results: BudgetCheckItem[] = []
  let hasExceeded = false
  let requiresApproval = false

  for (const item of linkedItems) {
    const rapItem = rapMap.get(item.rapItemId!)

    if (!rapItem) {
      throw new Error(`Budget Guard: RAP item not found - ${item.itemName}`)
    }

    const totalBudget = (rapItem.qty_budget || 0) * (rapItem.unit_price_budget || 0)
    const committed = rapItem.committed_cost || 0
    const actual = rapItem.actual_cost || 0
    const remaining = totalBudget - (committed + actual)
    const requested = item.quantity * item.unitPrice

    const exceeds = requested > remaining
    const overageAmount = exceeds ? (requested - remaining) : 0

    // Check if close to threshold (requires approval)
    const wouldRemain = remaining - requested
    const thresholdAmount = totalBudget * (APPROVAL_THRESHOLD_PERCENT / 100)
    const needsApproval = wouldRemain > 0 && wouldRemain < thresholdAmount

    if (exceeds) hasExceeded = true
    if (needsApproval) requiresApproval = true

    const itemName = rapItem.ahsp_items?.name || rapItem.rab_items?.name || item.itemName

    results.push({
      rapItemId: item.rapItemId!,
      itemName,
      totalBudget,
      committed,
      actual,
      remaining,
      requested,
      exceeds,
      overageAmount
    })
  }

  const exceededItems = results.filter(r => r.exceeds)
  const approvalItems = results.filter(r => {
    const wouldRemain = r.remaining - r.requested
    const thresholdAmount = r.totalBudget * (APPROVAL_THRESHOLD_PERCENT / 100)
    return !r.exceeds && wouldRemain > 0 && wouldRemain < thresholdAmount
  })

  // Build summary message
  let message = ''
  if (hasExceeded) {
    const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })
    const first = exceededItems[0]
    message = `Budget exceeded: ${first.itemName} - Requested ${formatter.format(first.requested)}, Available ${formatter.format(first.remaining)}`
    if (exceededItems.length > 1) {
      message += ` (+ ${exceededItems.length - 1} more)`
    }
  } else if (requiresApproval) {
    message = `${approvalItems.length} item(s) require PM approval (low remaining budget)`
  } else {
    message = 'All items within budget'
  }

  return {
    isValid: !hasExceeded,
    hasExceeded,
    requiresApproval,
    items: results,
    message,
    exceededItems,
    approvalItems
  }
}

/**
 * Format budget check result for user display
 */
export function formatBudgetCheckMessage(result: BudgetCheckResult): string {
  const formatter = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })

  if (result.hasExceeded) {
    const lines = result.exceededItems.map(item =>
      `• ${item.itemName}: Requested ${formatter.format(item.requested)} exceeds available ${formatter.format(item.remaining)}`
    )
    return `❌ Budget Exceeded\n\n${lines.join('\n')}\n\nReduce quantity or get budget approval.`
  }

  if (result.requiresApproval) {
    const lines = result.approvalItems.map(item =>
      `• ${item.itemName}: Would leave only ${formatter.format(item.remaining - item.requested)} remaining`
    )
    return `⚠️ Low Budget Warning\n\n${lines.join('\n')}\n\nPM approval required before proceeding.`
  }

  return '✅ All items within budget'
}

/**
 * Increment committed cost for RAP item after PO approval
 * (Called after PO is created to lock budget)
 */
export async function commitBudget(
  rapItemId: string,
  amount: number
): Promise<void> {
  const { data: rapItem, error: fetchError } = await assertSupabase()
    .from('rap_items')
    .select('committed_cost')
    .eq('id', rapItemId)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch RAP item for commit: ${fetchError.message}`)
  }

  const newCommitted = (rapItem.committed_cost || 0) + amount

  const { error: updateError } = await assertSupabase()
    .from('rap_items')
    .update({ committed_cost: newCommitted })
    .eq('id', rapItemId)

  if (updateError) {
    throw new Error(`Failed to commit budget: ${updateError.message}`)
  }

  // Audit trail
  try {
    await auditService.log({
      action: 'BUDGET_CHANGE',
      entity: 'rap_items',
      entityType: 'RAP_ITEM',
      entityId: rapItemId,
      details: { type: 'COMMIT', amount, previousCommitted: rapItem.committed_cost || 0, newCommitted },
    })
  } catch { /* audit is non-blocking */ }
}

/**
 * Release committed cost (e.g., after PO cancellation)
 */
export async function releaseBudget(
  rapItemId: string,
  amount: number
): Promise<void> {
  const { data: rapItem, error: fetchError } = await assertSupabase()
    .from('rap_items')
    .select('committed_cost')
    .eq('id', rapItemId)
    .single()

  if (fetchError) {
    throw new Error(`Failed to fetch RAP item for release: ${fetchError.message}`)
  }

  const newCommitted = Math.max(0, (rapItem.committed_cost || 0) - amount)

  const { error: updateError } = await assertSupabase()
    .from('rap_items')
    .update({ committed_cost: newCommitted })
    .eq('id', rapItemId)

  if (updateError) {
    throw new Error(`Failed to release budget: ${updateError.message}`)
  }

  // Audit trail
  try {
    await auditService.log({
      action: 'BUDGET_CHANGE',
      entity: 'rap_items',
      entityType: 'RAP_ITEM',
      entityId: rapItemId,
      details: { type: 'RELEASE', amount, previousCommitted: rapItem.committed_cost || 0, newCommitted },
    })
  } catch { /* audit is non-blocking */ }
}
