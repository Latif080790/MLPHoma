/**
 * rabWbsLinkStore.ts
 * Zustand store for RAB ↔ WBS Smart Allocation linking.
 *
 * All DB operations use SECURITY DEFINER RPC functions to bypass
 * nested RLS issues. The RPCs verify project membership internally.
 *
 * Data model: junction table rab_wbs_links(id, rab_item_id, wbs_item_id, allocation_pct)
 * - One RAB item can link to N WBS nodes.
 * - allocationPct controls what share of the item's budget goes to each WBS node.
 * - Default: equal split (100/N). Manual override allowed but sum must equal 100.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { supabase as _supabaseClient } from '../lib/supabaseClient'
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const supabase = _supabaseClient!
import type { RabWbsLink, RabWbsLinkRow } from '../types/rabWbsLink'
import { rowToLink } from '../types/rabWbsLink'

// ─── State & Actions ────────────────────────────────────────────────────────

interface RabWbsLinkState {
  /** All links indexed by rabItemId for O(1) lookup */
  linksByRabItem: Record<string, RabWbsLink[]>
  loading: boolean
  error: string | null
}

interface RabWbsLinkActions {
  /** Load all links for a project via RPC */
  fetchLinks: (projectId: string) => Promise<void>

  /**
   * Add a link between a RAB item and a WBS node.
   * Auto-rebalances all existing links for that RAB item to equal split.
   */
  addLink: (rabItemId: string, wbsItemId: string) => Promise<void>

  /**
   * Remove a specific link.
   * Auto-rebalances the remaining links for that RAB item.
   */
  removeLink: (rabItemId: string, wbsItemId: string) => Promise<void>

  /**
   * Set allocationPct for a specific link (manual override).
   * Does NOT auto-rebalance other links.
   */
  updateAllocation: (rabItemId: string, wbsItemId: string, pct: number) => Promise<void>

  /**
   * Reset all links for a RAB item to equal-split (100/N).
   */
  rebalanceEqually: (rabItemId: string) => Promise<void>

  /**
   * Remove all links pointing to a specific WBS node.
   * Called when a WBS item is deleted — auto-unlinks all RAB items from it.
   */
  unlinkByWbsId: (wbsItemId: string) => Promise<void>

  /** Selector: get all links for one RAB item (sorted by createdAt) */
  getLinksForItem: (rabItemId: string) => RabWbsLink[]

  /** Sum of allocationPct for a RAB item (should ideally equal 100) */
  getAllocationSum: (rabItemId: string) => number
}

type RabWbsLinkStore = RabWbsLinkState & RabWbsLinkActions

// ─── Store ──────────────────────────────────────────────────────────────────

export const useRabWbsLinkStore = create<RabWbsLinkStore>()(
  devtools(
    (set, get) => ({
      linksByRabItem: {},
      loading: false,
      error: null,

      // ── fetchLinks ─────────────────────────────────────────────────────────
      fetchLinks: async (projectId) => {
        set({ loading: true, error: null })
        try {
          const { data, error } = await supabase
            .rpc('rpc_get_rab_wbs_links', { p_project_id: projectId })

          if (error) throw error

          const rows = (data || []) as RabWbsLinkRow[]
          const byRabItem: Record<string, RabWbsLink[]> = {}
          rows.forEach((row) => {
            const link = rowToLink(row)
            if (!byRabItem[link.rabItemId]) byRabItem[link.rabItemId] = []
            byRabItem[link.rabItemId].push(link)
          })

          // Merge with existing (don't overwrite links for other projects)
          set((s) => ({
            linksByRabItem: { ...s.linksByRabItem, ...byRabItem },
            loading: false,
          }))
        } catch (err: unknown) {
          const msg = (err as { message?: string })?.message ?? String(err)
          set({ loading: false, error: msg })
          console.error('[rabWbsLinkStore] fetchLinks error:', msg)
        }
      },

      // ── addLink ────────────────────────────────────────────────────────────
      addLink: async (rabItemId, wbsItemId) => {
        const existing = get().getLinksForItem(rabItemId)

        // Guard: already linked
        if (existing.some((l) => l.wbsItemId === wbsItemId)) return

        const allLinks = [...existing, {
          id: 'pending',
          rabItemId,
          wbsItemId,
          allocationPct: 100,
          createdAt: new Date().toISOString(),
        } as RabWbsLink]
        const equalPct = roundTo2(100 / allLinks.length)

        // Apply equal split including the new link
        const rebalanced = allLinks.map((l, i) => ({
          ...l,
          allocationPct: i === allLinks.length - 1
            ? roundTo2(100 - equalPct * (allLinks.length - 1))
            : equalPct,
        }))

        // Optimistic update
        set((s) => ({
          linksByRabItem: { ...s.linksByRabItem, [rabItemId]: rebalanced },
        }))

        try {
          // Insert via RPC
          const newPct = rebalanced.find((l) => l.wbsItemId === wbsItemId)?.allocationPct ?? equalPct
          const { data: newRow, error: insertError } = await supabase
            .rpc('rpc_add_rab_wbs_link', {
              p_rab_item_id: rabItemId,
              p_wbs_item_id: wbsItemId,
              p_allocation_pct: newPct,
            })

          if (insertError) {
            console.error('[rabWbsLinkStore] addLink RPC failed:', insertError.message)
            set((s) => ({
              linksByRabItem: { ...s.linksByRabItem, [rabItemId]: existing },
            }))
            return
          }

          // Update allocation_pct on pre-existing links via RPC
          const existingUpdates = rebalanced.filter((l) => l.wbsItemId !== wbsItemId)
          for (const l of existingUpdates) {
            await supabase.rpc('rpc_update_rab_wbs_allocation', {
              p_rab_item_id: rabItemId,
              p_wbs_item_id: l.wbsItemId,
              p_allocation_pct: l.allocationPct,
            })
          }

          // Update the pending ID with the real one from DB
          if (newRow) {
            const row = (Array.isArray(newRow) ? newRow[0] : newRow) as RabWbsLinkRow | undefined
            if (row?.id) {
              set((s) => {
                const links = (s.linksByRabItem[rabItemId] || []).map((l) =>
                  l.id === 'pending' && l.wbsItemId === wbsItemId
                    ? { ...l, id: row.id }
                    : l
                )
                return { linksByRabItem: { ...s.linksByRabItem, [rabItemId]: links } }
              })
            }
          }
        } catch (err) {
          console.error('[rabWbsLinkStore] addLink error:', err)
          set((s) => ({
            linksByRabItem: { ...s.linksByRabItem, [rabItemId]: existing },
          }))
        }
      },

      // ── removeLink ─────────────────────────────────────────────────────────
      removeLink: async (rabItemId, wbsItemId) => {
        const existing = get().getLinksForItem(rabItemId)
        const remaining = existing.filter((l) => l.wbsItemId !== wbsItemId)
        const rebalanced = remaining.length === 0 ? [] : rebalanceLinks(remaining)

        // Optimistic update
        set((s) => ({
          linksByRabItem: { ...s.linksByRabItem, [rabItemId]: rebalanced },
        }))

        try {
          await supabase.rpc('rpc_remove_rab_wbs_link', {
            p_rab_item_id: rabItemId,
            p_wbs_item_id: wbsItemId,
          })

          // Update pcts on remaining
          for (const l of rebalanced) {
            await supabase.rpc('rpc_update_rab_wbs_allocation', {
              p_rab_item_id: rabItemId,
              p_wbs_item_id: l.wbsItemId,
              p_allocation_pct: l.allocationPct,
            })
          }
        } catch (err) {
          console.error('[rabWbsLinkStore] removeLink error:', err)
        }
      },

      // ── updateAllocation ───────────────────────────────────────────────────
      updateAllocation: async (rabItemId, wbsItemId, pct) => {
        const existing = get().getLinksForItem(rabItemId)
        const updated = existing.map((l) =>
          l.wbsItemId === wbsItemId ? { ...l, allocationPct: pct } : l
        )

        set((s) => ({
          linksByRabItem: { ...s.linksByRabItem, [rabItemId]: updated },
        }))

        try {
          await supabase.rpc('rpc_update_rab_wbs_allocation', {
            p_rab_item_id: rabItemId,
            p_wbs_item_id: wbsItemId,
            p_allocation_pct: pct,
          })
        } catch (err) {
          console.error('[rabWbsLinkStore] updateAllocation error:', err)
        }
      },

      // ── rebalanceEqually ───────────────────────────────────────────────────
      rebalanceEqually: async (rabItemId) => {
        const existing = get().getLinksForItem(rabItemId)
        if (existing.length === 0) return
        const rebalanced = rebalanceLinks(existing)

        set((s) => ({
          linksByRabItem: { ...s.linksByRabItem, [rabItemId]: rebalanced },
        }))

        try {
          for (const l of rebalanced) {
            await supabase.rpc('rpc_update_rab_wbs_allocation', {
              p_rab_item_id: rabItemId,
              p_wbs_item_id: l.wbsItemId,
              p_allocation_pct: l.allocationPct,
            })
          }
        } catch (err) {
          console.error('[rabWbsLinkStore] rebalanceEqually error:', err)
        }
      },

      // ── unlinkByWbsId ──────────────────────────────────────────────────────
      unlinkByWbsId: async (wbsItemId) => {
        const { linksByRabItem } = get()
        const affectedRabIds = Object.entries(linksByRabItem)
          .filter(([, links]) => links.some((l) => l.wbsItemId === wbsItemId))
          .map(([rabId]) => rabId)

        if (affectedRabIds.length === 0) return

        // Optimistic update: remove links + rebalance remaining
        set((s) => {
          const next = { ...s.linksByRabItem }
          for (const rabId of affectedRabIds) {
            const remaining = (next[rabId] || []).filter((l) => l.wbsItemId !== wbsItemId)
            next[rabId] = remaining.length > 0 ? rebalanceLinks(remaining) : []
          }
          return { linksByRabItem: next }
        })

        try {
          // Delete all links for this WBS node via RPC
          await supabase.rpc('rpc_unlink_wbs_node', { p_wbs_item_id: wbsItemId })

          // Update pcts for remaining links
          const { linksByRabItem: updated } = get()
          for (const rabId of affectedRabIds) {
            for (const l of updated[rabId] || []) {
              await supabase.rpc('rpc_update_rab_wbs_allocation', {
                p_rab_item_id: rabId,
                p_wbs_item_id: l.wbsItemId,
                p_allocation_pct: l.allocationPct,
              })
            }
          }
        } catch (err) {
          console.error('[rabWbsLinkStore] unlinkByWbsId error:', err)
        }
      },

      // ── Selectors ──────────────────────────────────────────────────────────
      getLinksForItem: (rabItemId) => {
        return get().linksByRabItem[rabItemId] || []
      },

      getAllocationSum: (rabItemId) => {
        const links = get().linksByRabItem[rabItemId] || []
        return links.reduce((sum, l) => sum + l.allocationPct, 0)
      },
    }),
    { name: 'rabWbsLinkStore' }
  )
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

function roundTo2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Equal-split rebalance — last item absorbs rounding remainder */
function rebalanceLinks(links: RabWbsLink[]): RabWbsLink[] {
  const n = links.length
  if (n === 0) return []
  const equalPct = roundTo2(100 / n)
  return links.map((l, i) => ({
    ...l,
    allocationPct: i === n - 1
      ? roundTo2(100 - equalPct * (n - 1))
      : equalPct,
  }))
}

// ─── Event Bus Subscriptions ────────────────────────────────────────────────
// These subscriptions replace the direct wbsStore → rabWbsLinkStore coupling.
// wbsStore now emits events, and this store reacts to them independently.

import { eventBus } from '../lib/eventBus'

// When WBS items are deleted, auto-unlink all RAB items pointing to them
eventBus.on('wbs:deleted', ({ wbsItemIds }) => {
  for (const wbsItemId of wbsItemIds) {
    void useRabWbsLinkStore.getState().unlinkByWbsId(wbsItemId)
  }
})

// When WBS items are re-imported, clean up local link state for old items
eventBus.on('wbs:imported', ({ oldWbsItemIds }) => {
  if (oldWbsItemIds.length === 0) return
  const oldWbsIdSet = new Set(oldWbsItemIds)
  const { linksByRabItem } = useRabWbsLinkStore.getState()
  const cleaned: Record<string, RabWbsLink[]> = {}
  for (const [rabId, links] of Object.entries(linksByRabItem)) {
    cleaned[rabId] = links.filter(l => !oldWbsIdSet.has(l.wbsItemId))
  }
  useRabWbsLinkStore.setState({ linksByRabItem: cleaned })
})

