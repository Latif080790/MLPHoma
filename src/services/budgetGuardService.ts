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
    // G13 Fix: items without rapItemId cannot be validated against budget.
    // Reject instead of silent pass to prevent unauthorized spending.
    return {
      isValid: false,
      hasExceeded: false,
      requiresApproval: true,
      items: [],
      message: `${items.length} item tidak terhubung ke RAP — validasi anggaran tidak dapat dilakukan. Hubungkan item PO ke RAP terlebih dahulu.`,
      exceededItems: [],
      approvalItems: items.map(i => ({
        rapItemId: '',
        itemName: i.itemName || '',
        totalBudget: 0,
        committed: 0,
        actual: 0,
        remaining: 0,
        requested: (i.quantity || 0) * (i.unitPrice || 0),
        exceeds: false,
        overageAmount: 0,
      }))
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
  const rapMap = new Map<string, typeof dbRapItems[number]>()
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

    // Check if close to or past threshold (requires approval) — includes exceeded case (wouldRemain < 0)
    const wouldRemain = remaining - requested
    const thresholdAmount = totalBudget * (APPROVAL_THRESHOLD_PERCENT / 100)
    const needsApproval = wouldRemain < thresholdAmount

    if (exceeds) hasExceeded = true
    if (needsApproval) requiresApproval = true

    const ahspItemsAny = rapItem.ahsp_items as unknown as Array<{ name?: string }> | { name?: string } | null
    const rabItemsAny = rapItem.rab_items as unknown as Array<{ name?: string }> | { name?: string } | null
    const itemName = (Array.isArray(ahspItemsAny) ? ahspItemsAny[0]?.name : ahspItemsAny?.name) || (Array.isArray(rabItemsAny) ? rabItemsAny[0]?.name : rabItemsAny?.name) || item.itemName

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
    return !r.exceeds && wouldRemain < thresholdAmount
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
 * Atomically check budget availability AND commit in a single DB round-trip.
 * Uses rpc_check_and_commit_budget which acquires a row-level lock (FOR UPDATE)
 * preventing the race condition where two POs pass the check before either commits.
 * Fixes BUDGET-01.
 */
export async function atomicCheckAndCommitBudget(
  rapItemId: string,
  amount: number,
  poId?: string
): Promise<{ success: boolean; error?: string; remaining?: number }> {
  const { data, error } = await assertSupabase()
    .rpc('rpc_check_and_commit_budget', {
      p_rap_item_id: rapItemId,
      p_amount:      amount,
      p_po_id:       poId ?? null,
    })

  if (error) {
    throw new Error(`atomicCheckAndCommitBudget RPC failed: ${error.message}`)
  }

  if (data?.success) {
    // Audit trail for successful commit
    try {
      await auditService.log({
        action: 'BUDGET_CHANGE',
        entity: 'rap_items',
        entityType: 'RAP_ITEM',
        entityId: rapItemId,
        details: { type: 'COMMIT', amount, poId, remaining: data.remaining },
      })
    } catch { /* audit is non-blocking */ }
  }

  return data as { success: boolean; error?: string; remaining?: number }
}

/**
 * Increment committed cost for RAP item after PO approval.
 * @deprecated Use atomicCheckAndCommitBudget() instead to avoid race conditions.
 * Kept for backward compatibility with callers that have already validated budget.
 */
export async function commitBudget(
  rapItemId: string,
  amount: number
): Promise<void> {
  const result = await atomicCheckAndCommitBudget(rapItemId, amount)
  if (!result.success) {
    throw new Error(result.error ?? 'Failed to commit budget')
  }
}

/**
 * Release committed cost atomically (e.g., after PO cancellation).
 * Uses rpc_release_budget which acquires a row-level lock.
 */
export async function releaseBudget(
  rapItemId: string,
  amount: number,
  poId?: string
): Promise<void> {
  const { data, error } = await assertSupabase()
    .rpc('rpc_release_budget', {
      p_rap_item_id: rapItemId,
      p_amount:      amount,
      p_po_id:       poId ?? null,
    })

  if (error) {
    throw new Error(`releaseBudget RPC failed: ${error.message}`)
  }

  // Audit trail
  try {
    await auditService.log({
      action: 'BUDGET_CHANGE',
      entity: 'rap_items',
      entityType: 'RAP_ITEM',
      entityId: rapItemId,
      details: { type: 'RELEASE', amount, poId, newCommitted: data?.newCommitted },
    })
  } catch { /* audit is non-blocking */ }
}
