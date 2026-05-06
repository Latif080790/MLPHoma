/**
 * src/lib/storeSubscriptions.ts — Phase 10 (Updated: Sprint 1)
 * 
 * Centralized reactivity logic for cross-store synchronization.
 * Data chain: AHSP → RAB → Timeline → RAP → CurvaS
 *
 * Subscriptions:
 * [1] AHSP    → RAB   : Update RAB unit prices when catalog changes
 * [2] RAB     → Timeline : Propagate RAB cost changes to linked tasks
 * [3] Timeline → RAP  : Recalculate monthly distribution when schedule changes
 * [4] RAP     → CurvaS  : Rebuild S-Curve data points when RAP plan changes
 *             (Handled in rapStore.ts bottom-of-file subscription)
 */

import { useAHSPStore } from '@/store/ahspStore'
import { useRabStore } from '@/store/rabStore'
import { useTimelineStore } from '@/store/timelineStore'
import { useRapStore } from '@/store/rapStore'
import { useProjectStore } from '@/store/projectStore'
import { useAuthStore } from '@/store/authStore'
import { toast } from 'sonner'

let isInitialized = false

/** Debounce helper — prevents rapid successive triggers from cascading */
function debounce<T extends(...args: unknown[]) => void>(fn: T, ms: number): T {
  let timer: ReturnType<typeof setTimeout>
  return ((...args: unknown[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }) as T
}

/**
 * Initialize all cross-store subscriptions.
 * Call this once at the root level of the application (e.g., in App.tsx or useAppInit).
 */
export function initStoreSubscriptions() {
  if (isInitialized) return
  isInitialized = true

  console.info('[Sync] Initializing Cross-Store Subscriptions — 4 pipelines active')

  // ── Subscription 0: Auth → Projects ────────────────────────────────────────
  // Auto-load projects whenever a user session becomes available.
  // This ensures any module (e.g. /costing) works even if ProjectManagement
  // was never visited in this session.
  let prevAuthUser = useAuthStore.getState().user
  if (prevAuthUser) {
    // User already authenticated at init time — load immediately
    useProjectStore.getState().loadProjects()
  }
  useAuthStore.subscribe((state) => {
    if (state.user !== prevAuthUser) {
      prevAuthUser = state.user
      if (state.user) {
        useProjectStore.getState().loadProjects()
      }
    }
  })

  // ── Subscription 1: AHSP → RAB ──────────────────────────────────────────────
  // Update RAB unit prices when AHSP (Resource Catalog) changes
  useAHSPStore.subscribe(
    (state) => state.ahspItems,
    (items) => {
      if (!items || items.length === 0) return

      const activeProjectId = useProjectStore.getState().activeProjectId
      if (!activeProjectId) return

      console.debug(`[Sync 1/4] AHSP Catalog changed (${items.length} items). Triggering RAB drift check.`)

      // checkPriceDrift handles debounce internally
      useRabStore.getState().checkPriceDrift()
    }
  )

  // ── Subscription 2: RAB → Timeline ──────────────────────────────────────────
  // Sync task cost metadata when RAB item prices/volumes change
  // NOTE: Primary handler is in rabStore.ts eventBus 'rab:changed' listener.
  // This subscribe adds a reactive layer for direct store mutations.
  const debouncedRabToTimeline = debounce(() => {
    console.debug('[Sync 2/4] RAB items changed. Propagating costs to Timeline.')
    useTimelineStore.getState().syncTaskCostsFromRAB()
  }, 300)

  // useRabStore does NOT use subscribeWithSelector — use 1-arg subscribe with closure comparison
  let prevRabItems = useRabStore.getState().itemsByProject
  useRabStore.subscribe((state) => {
    if (state.itemsByProject !== prevRabItems) {
      prevRabItems = state.itemsByProject
      debouncedRabToTimeline()
    }
  })

  // ── Subscription 3: Timeline → RAP ──────────────────────────────────────────
  // Recalculate RAP monthly distribution when schedule (task dates) changes.
  // This propagates date changes into the time-phased cost profile.
  const debouncedTimelineToRap = debounce(() => {
    const activeProjectId = useProjectStore.getState().activeProjectId
    if (!activeProjectId) return

    console.debug('[Sync 3/4] Timeline changed. Recalculating RAP distribution.')
    useRapStore.getState().recalculateDistribution(activeProjectId)

    // After RAP distribution updates, trigger CurvaS rebuild via the
    // rapStore bottom-of-file subscription (Subscription 4 — handled in rapStore.ts)
  }, 500)

  // useTimelineStore does NOT use subscribeWithSelector — use 1-arg subscribe with closure comparison
  let prevTasks = useTimelineStore.getState().tasksByProject
  useTimelineStore.subscribe((state) => {
    if (state.tasksByProject !== prevTasks) {
      prevTasks = state.tasksByProject
      debouncedTimelineToRap()
    }
  })

  console.info('[Sync] Pipeline ready: AHSP → RAB → Timeline → RAP → CurvaS')
}

/**
 * Toast notification for successful RAB → sync propagation.
 * Called after publishDrafts / bulk RAB update to confirm chain sync.
 */
export function notifySyncComplete(projectId: string) {
  const rapLastSync = useRapStore.getState().lastSyncedAt
  const description = rapLastSync
    ? `RAP & Curva-S tersinkronisasi ✓`
    : 'Timeline tersinkronisasi ✓'

  toast.success('RAB diperbarui', {
    description,
    duration: 3500,
    id: `rab-sync-${projectId}`,  // prevent duplicates
  })
}
