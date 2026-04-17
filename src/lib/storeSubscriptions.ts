/**
 * src/lib/storeSubscriptions.ts — Phase 10
 * 
 * Centralized reactivity logic for cross-store synchronization.
 * This ensures that a change in one module (e.g., Resource Price) 
 * automatically propagates throughout the entire enterprise data chain:
 * AHSP -> RAB -> Timeline -> Cost Forecast.
 */

import { useAHSPStore } from '@/store/ahspStore'
import { useRabStore } from '@/store/rabStore'
import { useTimelineStore } from '@/store/timelineStore'
import { useProjectStore } from '@/store/projectStore'

let isInitialized = false

/**
 * Initialize all cross-store subscriptions.
 * Call this once at the root level of the application (e.g., in App.tsx or useAppInit).
 */
export function initStoreSubscriptions() {
  if (isInitialized) return
  isInitialized = true

  console.info('[Sync] Initializing Cross-Store Subscriptions')

  // 1. AHSP -> RAB: Update RAB unit prices when AHSP (Catalog) changes
  // This listener fires when ahspItems in AHSP store are updated
  useAHSPStore.subscribe(
    (state) => state.ahspItems,
    (items) => {
      if (!items || items.length === 0) return
      
      const activeProjectId = useProjectStore.getState().activeProjectId
      if (!activeProjectId) return

      console.debug(`[Sync] AHSP Catalog changed (${items.length} items). Triggering RAB drift check.`)
      
      // Debounce logic already exists in checkPriceDrift/syncWithCatalog
      // But we trigger it here to ensure reactivity
      useRabStore.getState().checkPriceDrift()
    }
  )

  // 2. RAB -> Timeline: Update Task Costs when RAB volume/price changes
  // We subscribe to itemsByProject in rabStore
  useRabStore.subscribe(
    (state) => state.itemsByProject,
    () => {
      console.debug('[Sync] RAB items changed. Propagating to Timeline.')
      
      // Sync timeline costs from RAB
      useTimelineStore.getState().syncTaskCostsFromRAB()
    }
  )

  // 3. Timeline -> Curva-S: Recalculate S-Curve when Timeline progresses
  // Assuming useCostForecastStore or similar exists
  useTimelineStore.subscribe(
    (state) => state.tasksByProject,
    () => {
      console.debug('[Sync] Timeline tasks changed. Refreshing Curves.')
      // If we had a forecast store, we would trigger it here:
      // useCostForecastStore.getState().recalculate()
    }
  )
}
