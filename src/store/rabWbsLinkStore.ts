/**
 * rabWbsLinkStore.ts
 * Zustand store for RAB ↔ WBS Smart Allocation linking.
 *
 * Data model: junction table rab_wbs_links(id, rab_item_id, wbs_item_id, allocation_pct)
 * - One RAB item can link to N WBS nodes.
 * - allocationPct controls what share of the item's budget goes to each WBS node.
 * - Default: equal split (100/N). Manual override allowed but sum must equal 100.
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { supabase as _supabaseClient } from '../lib/supabaseClient'
// Supabase is present in all runtime environments; undefined only in
// test stubs that lack VITE_SUPABASE_* env vars. Assert non-null here
// so individual methods don't need per-call guards.
// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const supabase = _supabaseClient!
import type { RabWbsLink, RabWbsLinkRow } from '../types/rabWbsLink'
import { rowToLink } from '../types/rabWbsLink'
import { generateId } from '../lib/idGenerator'

// ─── State & Actions ────────────────────────────────────────────────────────

interface RabWbsLinkState {
  /** All links indexed by rabItemId for O(1) lookup */
  linksByRabItem: Record<string, RabWbsLink[]>
  loading: boolean
  error: string | null
}

interface RabWbsLinkActions {
  /** Load all links for a project (joins rab_items to scope by projectId) */
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
          // Join rab_items to filter by projectId
          const { data, error } = await supabase
            .from('rab_wbs_links')
            .select('*, rab_items!inner(project_id)')
            .eq('rab_items.project_id', projectId)
            .order('created_at', { ascending: true })

          if (error) throw error

          const rows = (data || []) as unknown as RabWbsLinkRow[]
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
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err)
          set({ loading: false, error: msg })
          console.error('[rabWbsLinkStore] fetchLinks error:', msg)
        }
      },

      // ── addLink ────────────────────────────────────────────────────────────
      addLink: async (rabItemId, wbsItemId) => {
        const existing = get().getLinksForItem(rabItemId)

        // Guard: already linked
        if (existing.some((l) => l.wbsItemId === wbsItemId)) return

        const newLink: RabWbsLink = {
          id: generateId('rwl'),
          rabItemId,
          wbsItemId,
          allocationPct: 100,
          createdAt: new Date().toISOString(),
        }

        const allLinks = [...existing, newLink]
        const equalPct = roundTo2(100 / allLinks.length)

        // Apply equal split including the new link
        const rebalanced = allLinks.map((l, i) => ({
          ...l,
          allocationPct: i === allLinks.length - 1
            ? roundTo2(100 - equalPct * (allLinks.length - 1)) // absorb rounding remainder
            : equalPct,
        }))

        // Optimistic update
        set((s) => ({
          linksByRabItem: { ...s.linksByRabItem, [rabItemId]: rebalanced },
        }))

        // Persist: insert new link + rebalance existing
        try {
          const newRow: Partial<RabWbsLinkRow> = {
            rab_item_id: newLink.rabItemId,
            wbs_item_id: newLink.wbsItemId,
            allocation_pct: rebalanced.find((l) => l.wbsItemId === wbsItemId)?.allocationPct ?? equalPct,
          }
          const { error: insertError } = await supabase.from('rab_wbs_links').insert(newRow)

          if (insertError) {
            // Revert optimistic update — restore state before this addLink call
            console.error('[rabWbsLinkStore] addLink insert failed:', insertError.message)
            set((s) => ({
              linksByRabItem: { ...s.linksByRabItem, [rabItemId]: existing },
            }))
            return
          }

          // Update allocation_pct on pre-existing links
          const existingUpdates = rebalanced.filter((l) => l.wbsItemId !== wbsItemId)
          for (const l of existingUpdates) {
            await supabase
              .from('rab_wbs_links')
              .update({ allocation_pct: l.allocationPct })
              .eq('rab_item_id', rabItemId)
              .eq('wbs_item_id', l.wbsItemId)
          }

          // Sync real DB ids into store (guarded — won't wipe state if read fails)
          await refreshLinksForRabItem(rabItemId, set)
        } catch (err) {
          // Revert optimistic update on unexpected error
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

        const rebalanced = remaining.length === 0
          ? []
          : rebalanceLinks(remaining)

        // Optimistic update
        set((s) => ({
          linksByRabItem: { ...s.linksByRabItem, [rabItemId]: rebalanced },
        }))

        try {
          await supabase
            .from('rab_wbs_links')
            .delete()
            .eq('rab_item_id', rabItemId)
            .eq('wbs_item_id', wbsItemId)

          // Update pcts on remaining
          for (const l of rebalanced) {
            await supabase
              .from('rab_wbs_links')
              .update({ allocation_pct: l.allocationPct })
              .eq('rab_item_id', rabItemId)
              .eq('wbs_item_id', l.wbsItemId)
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
          await supabase
            .from('rab_wbs_links')
            .update({ allocation_pct: pct })
            .eq('rab_item_id', rabItemId)
            .eq('wbs_item_id', wbsItemId)
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
            await supabase
              .from('rab_wbs_links')
              .update({ allocation_pct: l.allocationPct })
              .eq('rab_item_id', rabItemId)
              .eq('wbs_item_id', l.wbsItemId)
          }
        } catch (err) {
          console.error('[rabWbsLinkStore] rebalanceEqually error:', err)
        }
      },

      // ── unlinkByWbsId ──────────────────────────────────────────────────────
      unlinkByWbsId: async (wbsItemId) => {
        // Find all rabItemIds that have this wbsItemId
        const { linksByRabItem } = get()
        const affectedRabIds = Object.entries(linksByRabItem)
          .filter(([, links]) => links.some((l) => l.wbsItemId === wbsItemId))
          .map(([rabId]) => rabId)

        if (affectedRabIds.length === 0) return

        // Optimistic update: remove links from state + rebalance remaining
        set((s) => {
          const next = { ...s.linksByRabItem }
          for (const rabId of affectedRabIds) {
            const remaining = (next[rabId] || []).filter((l) => l.wbsItemId !== wbsItemId)
            next[rabId] = remaining.length > 0 ? rebalanceLinks(remaining) : []
          }
          return { linksByRabItem: next }
        })

        try {
          await supabase
            .from('rab_wbs_links')
            .delete()
            .eq('wbs_item_id', wbsItemId)

          // Update pcts for remaining links on affected rab items
          const { linksByRabItem: updated } = get()
          for (const rabId of affectedRabIds) {
            const remaining = updated[rabId] || []
            for (const l of remaining) {
              await supabase
                .from('rab_wbs_links')
                .update({ allocation_pct: l.allocationPct })
                .eq('rab_item_id', rabId)
                .eq('wbs_item_id', l.wbsItemId)
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

/**
 * Re-fetch links for one RAB item after insert to sync real DB ids.
 * IMPORTANT: only updates state if DB returns rows — never wipes optimistic
 * state with an empty array (which would happen if RLS blocked the read-back).
 */
async function refreshLinksForRabItem(
  rabItemId: string,
  set: (fn: (s: RabWbsLinkState) => Partial<RabWbsLinkState>) => void
) {
  const { data, error } = await supabase
    .from('rab_wbs_links')
    .select('*')
    .eq('rab_item_id', rabItemId)
    .order('created_at', { ascending: true })

  if (error) {
    console.warn('[rabWbsLinkStore] refreshLinksForRabItem read error:', error.message)
    return
  }
  // Guard: never overwrite optimistic state with empty array
  if (!data || data.length === 0) return
  const links = (data as RabWbsLinkRow[]).map(rowToLink)
  set((s) => ({
    linksByRabItem: { ...s.linksByRabItem, [rabItemId]: links },
  }))
}
