/**
 * ahspStore.ts
 * Zustand store for AHSP (Analisis Harga Satuan Pekerjaan) management
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { ahspRepository } from '../lib/ahspRepository'
import {
  calculateSingleAHSPPrice,
  recalculateAllInWorker,
  prepareImportData,
  toSupabaseRows,
  initializeAHSPItem,
  initializeAHSPComponent,
  calculateAHSPPriceInWorker,
  ahspDataService
} from '../services/ahspService'
import { syncAHSPItem, syncAHSPComponent, syncDelete, syncAHSPItemsWithComponents, syncResources, syncAHSPItems } from '../lib/supabaseSyncService'
import { validate } from '../lib/validationMiddleware'
import {
  resourceInputSchema,
  resourceUpdateSchema,
  ahspItemInputSchema,
  ahspItemUpdateSchema,
  ahspComponentInputSchema
} from '../lib/validationSchemas'
import { toast } from 'sonner'
import { generateId } from '../lib/idGenerator'
import type {
  AHSPStore,
  Resource,
  AHSPItem,
  AHSPComponent,
  ResourceType,
  AHSPState,
  Zone,
  AhspZonePrice
} from '../types/ahsp'

/**
 * Debounce timer for cascading recalculation after resource price changes
 */
let _recalcTimer: ReturnType<typeof setTimeout> | null = null
const scheduleRecalc = (fn: () => void, ms = 400) => {
  if (_recalcTimer) clearTimeout(_recalcTimer)
  _recalcTimer = setTimeout(fn, ms)
}

/**
 * Create AHSP Store with Zustand
 */
export const useAHSPStore = create<AHSPStore>()(
  subscribeWithSelector(
    devtools(
      persist(
      (set, get) => ({
        // Initial state
        resources: [],
        totalResourceCount: 0,
        ahspItems: [],
        totalAhspCount: 0,
        componentsByAHSP: {},
        loading: {
          resources: false,
          ahspItems: false,
          components: false,
          priceHistory: false,
          zones: false,
          zonePrices: false,
        },
        zones: [],
        zonePricesByZone: {},
        settings: {
          defaultOverhead: 10,
          defaultProfit: 10,
        },
        errors: {
          resources: null,
          ahspItems: null,
          components: null,
          priceHistory: null,
          zones: null,
          zonePrices: null,
        },

        // Data fetching actions — delegated to ahspRepository
        fetchResources: async () => {
          set((state) => ({ loading: { ...state.loading, resources: true }, errors: { ...state.errors, resources: null } }))
          const { data, error } = await ahspDataService.fetchAllResources()
          if (error) {
            set((state) => ({
              loading: { ...state.loading, resources: false },
              errors: { ...state.errors, resources: error },
            }))
            toast.error('Failed to load resources', { description: error })
          } else {
            set((state) => ({
              resources: data,
              loading: { ...state.loading, resources: false },
              totalResourceCount: data.length
            }))
          }
        },

        fetchAHSPItems: async () => {
          set((state) => ({
            loading: { ...state.loading, ahspItems: true },
            errors: { ...state.errors, ahspItems: null },
          }))

          const { data: itemsWithLogs, error } = await ahspDataService.fetchAllAHSPItems()
          if (error) {
            set((state) => ({
              loading: { ...state.loading, ahspItems: false },
              errors: { ...state.errors, ahspItems: error },
            }))
            toast.error('Failed to load AHSP items', { description: error })
            return
          }

          set((state) => ({
            ahspItems: itemsWithLogs,
            loading: { ...state.loading, ahspItems: false },
            totalAhspCount: itemsWithLogs.length
          }))
        },

        fetchComponents: async (ahspId?: string) => {
          set((state) => ({
            loading: { ...state.loading, components: true },
            errors: { ...state.errors, components: null },
          }))

          const { data: componentsByAHSP, error } = await ahspRepository.fetchComponents(ahspId)
          if (error) {
            set((state) => ({
              loading: { ...state.loading, components: false },
              errors: { ...state.errors, components: error },
            }))
            toast.error('Failed to load components', { description: error })
          } else {
            set((state) => ({
              componentsByAHSP: ahspId
                ? { ...state.componentsByAHSP, [ahspId]: componentsByAHSP[ahspId] || [] }
                : componentsByAHSP,
              loading: { ...state.loading, components: false },
            }))
          }
        },

        fetchAll: async () => {
          await Promise.all([
            get().fetchResources(),
            get().fetchAHSPItems(),
            get().fetchComponents(),
          ])
        },

        fetchComponentsBatch: async (ahspIds: string[]) => {
          if (!ahspIds.length) return
          // Filter out ids already in store
          const cached = get().componentsByAHSP
          const missing = ahspIds.filter(id => !(id in cached))
          if (!missing.length) return

          set((state) => ({
            loading: { ...state.loading, components: true },
            errors: { ...state.errors, components: null },
          }))

          const { data: batchData, error } = await ahspRepository.fetchComponentsBatch(missing)
          if (error) {
            set((state) => ({
              loading: { ...state.loading, components: false },
              errors: { ...state.errors, components: error },
            }))
            toast.error('Failed to load components', { description: error })
          } else {
            set((state) => ({
              componentsByAHSP: { ...state.componentsByAHSP, ...batchData },
              loading: { ...state.loading, components: false },
            }))
          }
        },

        // Resource actions
        addResource: async (resource) => {
          const validation = validate(resourceInputSchema, resource)
          if (!validation.success) {
            const errorMsg = validation.errors?.[0]?.message || 'Validation failed'
            toast.error('Failed to add resource', { description: errorMsg })
            return ''
          }

          const newResource = await ahspDataService.addResource(validation.data!)
          
          set((state) => ({
            resources: [...state.resources, newResource],
            errors: { ...state.errors, resources: null },
          }))

          return newResource.id
        },

        updateResource: (id, updates) => {
          // Validate updates
          const validation = validate(resourceUpdateSchema, updates)
          if (!validation.success) {
            const errors = validation.errors || []
            const errorMsg = errors[0]?.message || 'Validation failed'
            toast.error('Failed to update resource', {
              description: errorMsg
            })
            return
          }

          set((state) => ({
            resources: state.resources.map(resource =>
              resource.id === id
                ? { ...resource, ...validation.data!, updatedAt: new Date().toISOString() }
                : resource
            ),
          }))

          // Cascade: any AHSP item whose component references this resource gets a new price
          scheduleRecalc(() => get().recalculateAllPrices())
        },

        deleteResource: async (id) => {
          try {
            await ahspDataService.deleteResource(id, get().componentsByAHSP)
            set((state) => ({
              resources: state.resources.filter(resource => resource.id !== id),
              errors: { ...state.errors, resources: null },
            }))
          } catch (err: unknown) {
            const errorMsg = (err as Error).message
            toast.error(errorMsg)
            set((state) => ({
              errors: { ...state.errors, resources: errorMsg },
            }))
          }
        },

        importResources: (resources) => {
          const newResources: Resource[] = resources.map(resource => ({
            ...resource,
            id: generateId('res'),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }))

          set((state) => ({
            resources: [...state.resources, ...newResources],
          }))

          // Persist to Supabase so imported resources survive reload and satisfy the
          // ahsp_components.resource_id FK when referenced later.
          syncResources(newResources)
        },

        exportResources: () => {
          return get().resources
        },

        // AHSP item actions
        addAHSPItem: (item) => {
          const validation = validate(ahspItemInputSchema, item)
          if (!validation.success) {
            const errorMsg = validation.errors?.[0]?.message || 'Validation failed'
            toast.error('Gagal tambah AHSP', { description: errorMsg })
            return ''
          }

          const newItem = initializeAHSPItem(validation.data || {}, {
            overhead: get().settings.defaultOverhead,
            profit: get().settings.defaultProfit
          })

          set((s) => ({
            ahspItems: [...s.ahspItems, newItem],
            componentsByAHSP: { ...s.componentsByAHSP, [newItem.id]: [] },
            errors: { ...s.errors, ahspItems: null },
          }))

          syncAHSPItem(newItem)
          return newItem.id
        },

        updateAHSPItem: async (id, updates) => {
          const validation = validate(ahspItemUpdateSchema, updates)
          if (!validation.success) {
            toast.error('Failed to update AHSP item', { description: validation.errors?.[0]?.message })
            return
          }

          const oldItem = get().ahspItems.find(i => i.id === id)
          if (!oldItem) return

          const updated = await ahspDataService.updateAHSPItemWithHistory(id, validation.data!, oldItem)

          set((state) => ({
            ahspItems: state.ahspItems.map(item => item.id === id ? updated : item),
          }))
        },

        deleteAHSPItem: (id) => {
          set((state) => {
            const newComponentsByAHSP = { ...state.componentsByAHSP }
            delete newComponentsByAHSP[id]

            return {
              ahspItems: state.ahspItems.filter(item => item.id !== id),
              componentsByAHSP: newComponentsByAHSP,
            }
          })
          syncDelete('ahsp_items', id)
        },

        importAHSPItems: async (items) => {
          const DIRECT_IMPORT_THRESHOLD = 100

          const { newItems, allNewResources, allNewComponents, componentsByAHSP } = prepareImportData(
            items,
            get().resources
          )

          if (items.length > DIRECT_IMPORT_THRESHOLD) {
            toast.info(`Import besar (${items.length} items) - langsung ke Supabase...`)

            try {
              const { ahspRows, resourceRows, componentRows } = toSupabaseRows(
                newItems,
                allNewResources,
                allNewComponents
              )

              const result = await ahspRepository.bulkImport(ahspRows, resourceRows, componentRows)

              if (!result.success) throw new Error(result.error || 'Unknown error')

              toast.success(`Berhasil import ${items.length} items ke Supabase!`)

              const state = get()
              await Promise.all([
                state.fetchAHSPItems(),
                state.fetchResources(),
                state.fetchComponents()
              ])
            } catch (error) {
              toast.error(`Gagal import ke Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
          } else {
            // SMALL IMPORT
            set((state) => ({
              resources: allNewResources.length > 0 ? [...state.resources, ...allNewResources] : state.resources,
              ahspItems: [...state.ahspItems, ...newItems],
              componentsByAHSP: { ...state.componentsByAHSP, ...componentsByAHSP },
            }))

            if (allNewResources.length > 0) {
              // syncResources(allNewResources)
            }
            // syncResources(newItems)
            syncAHSPItemsWithComponents(newItems, allNewComponents).catch(() => {
              // background sync — failure is non-fatal
            })
          }
        },

        exportAHSPItems: () => {
          return get().ahspItems
        },

        // Component actions
        addComponent: (ahspId, component) => {
          const validation = validate(ahspComponentInputSchema, component)
          if (!validation.success) {
            toast.error('Gagal tambah komponen', { description: validation.errors?.[0]?.message })
            return
          }

          const newComp = initializeAHSPComponent(ahspId, validation.data || {}, get().resources)

          set((s) => {
            const current = s.componentsByAHSP[ahspId] || []
            return {
              componentsByAHSP: { ...s.componentsByAHSP, [ahspId]: [...current, newComp] },
              errors: { ...s.errors, components: null }
            }
          })

          // 'temp' is the wizard draft bucket for a not-yet-saved AHSP item — do NOT
          // sync yet (no parent ahsp_items row exists → FK violation). Drafts are
          // persisted via commitDraftComponents() once the item is saved.
          if (ahspId !== 'temp') {
            syncAHSPComponent(newComp)
            get().calculateAHSPPrice(ahspId)
          }
        },

        updateComponent: (id, updates) => {
          let affectedAhspId: string | undefined

          set((state) => {
            const newComponentsByAHSP = { ...state.componentsByAHSP }

            Object.keys(newComponentsByAHSP).forEach((ahspId) => {
              const components = newComponentsByAHSP[ahspId]
              const componentIndex = components.findIndex((c) => c.id === id)

              if (componentIndex !== -1) {
                affectedAhspId = ahspId
                const component = components[componentIndex]
                const updatedComponent = { ...component, ...updates }

                if (updates.resourceId) {
                  const resource = state.resources.find((r) => r.id === updates.resourceId)
                  if (resource) {
                    updatedComponent.resource = resource
                    updatedComponent.unit = resource.unit
                    updatedComponent.unitPrice = resource.unitPrice
                  }
                }

                updatedComponent.coefficient = updatedComponent.coefficient ?? component.coefficient
                updatedComponent.unitPrice = updatedComponent.unitPrice ?? component.unitPrice
                updatedComponent.subtotal = updatedComponent.coefficient * updatedComponent.unitPrice
                updatedComponent.updatedAt = new Date().toISOString()

                newComponentsByAHSP[ahspId] = [
                  ...components.slice(0, componentIndex),
                  updatedComponent,
                  ...components.slice(componentIndex + 1),
                ]
              }
            })

            return { componentsByAHSP: newComponentsByAHSP }
          })

          // Recalculate immediately after state update, no setTimeout needed
          if (affectedAhspId && affectedAhspId !== 'temp') {
            const updatedComp = get().componentsByAHSP[affectedAhspId]?.find(c => c.id === id)
            if (updatedComp) syncAHSPComponent(updatedComp)
            get().calculateAHSPPrice(affectedAhspId)
          }
        },

        deleteComponent: (id) => {
          // Track parent AHSP id BEFORE the state mutation removes the component
          const byAhsp = get().componentsByAHSP
          const parentAhspId = Object.keys(byAhsp).find(
            (ahspId) => byAhsp[ahspId].some((c) => c.id === id)
          )

          if (!parentAhspId) return  // nothing to delete — invalid or already-deleted id

          set((state) => {
            const newComponentsByAHSP = { ...state.componentsByAHSP }
            Object.keys(newComponentsByAHSP).forEach((ahspId) => {
              const filtered = newComponentsByAHSP[ahspId].filter((c) => c.id !== id)
              if (filtered.length !== newComponentsByAHSP[ahspId].length) {
                newComponentsByAHSP[ahspId] = filtered
              }
            })
            return { componentsByAHSP: newComponentsByAHSP }
          })

          syncDelete('ahsp_components', id)

          // Now recalculate using the tracked parent id
          if (parentAhspId && parentAhspId !== 'temp') {
            get().calculateAHSPPrice(parentAhspId)
          }
        },

        reorderComponents: (ahspId, componentIds) => {
          set((state) => {
            const components = state.componentsByAHSP[ahspId] || []
            const reorderedComponents = componentIds
              .map(id => components.find(c => c.id === id))
              .filter(Boolean) as AHSPComponent[]

            return {
              componentsByAHSP: {
                ...state.componentsByAHSP,
                [ahspId]: reorderedComponents,
              },
            }
          })
        },

        moveComponents: (fromAhspId, toAhspId) => {
          set((state) => {
            const components = state.componentsByAHSP[fromAhspId] || []
            const updatedComponents = components.map(c => ({ ...c, ahspId: toAhspId }))

            const newComponentsByAHSP = { ...state.componentsByAHSP }
            delete newComponentsByAHSP[fromAhspId]

            newComponentsByAHSP[toAhspId] = [
              ...(newComponentsByAHSP[toAhspId] || []),
              ...updatedComponents
            ]

            return {
              componentsByAHSP: newComponentsByAHSP
            }
          })
        },

        commitDraftComponents: (toAhspId) => {
          const draft = get().componentsByAHSP['temp'] || []
          if (draft.length === 0) return
          const migrated = draft.map(c => ({ ...c, ahspId: toAhspId }))
          set((state) => {
            const next = { ...state.componentsByAHSP }
            delete next['temp']
            next[toAhspId] = [...(next[toAhspId] || []), ...migrated]
            return { componentsByAHSP: next }
          })
          // Parent ahsp_item was already enqueued by addAHSPItem, so these component
          // upserts run after it (queue is FIFO) and satisfy the ahsp_id FK.
          migrated.forEach(c => syncAHSPComponent(c))
          get().calculateAHSPPrice(toAhspId)
        },

        clearDraftComponents: () => {
          set((state) => {
            if (!state.componentsByAHSP['temp']) return state
            const next = { ...state.componentsByAHSP }
            delete next['temp']
            return { componentsByAHSP: next }
          })
        },

        // Calculation actions — delegated to ahspService
        calculateAHSPPrice: async (ahspId) => {
          const item = get().ahspItems.find(i => i.id === ahspId)
          const components = get().componentsByAHSP[ahspId] || []
          if (!item) return

          try {
            const results = await calculateAHSPPriceInWorker(item, components) as { componentBreakdown: { breakdown: { material: number; labor: number; equipment: number; subcontractor: number } }; priceBreakdown: { basePrice: number; finalPrice: number } }
            const { componentBreakdown, priceBreakdown } = results

            const updatedItem: AHSPItem = {
              ...item,
              basePrice: priceBreakdown.basePrice,
              finalPrice: priceBreakdown.finalPrice,
              price_material: componentBreakdown.breakdown.material,
              price_labor: componentBreakdown.breakdown.labor,
              price_equipment: componentBreakdown.breakdown.equipment,
              price_subcon: componentBreakdown.breakdown.subcontractor,
              updatedAt: new Date().toISOString()
            }

            set((s) => ({
              ahspItems: s.ahspItems.map(i => i.id === ahspId ? updatedItem : i)
            }))

            syncAHSPItem(updatedItem)
          } catch (error) {
            const result = calculateSingleAHSPPrice(item, components)
            const updatedItem: AHSPItem = {
              ...item,
              basePrice: result.priceBreakdown.basePrice,
              finalPrice: result.priceBreakdown.finalPrice,
              price_material: result.componentBreakdown.breakdown.material,
              price_labor: result.componentBreakdown.breakdown.labor,
              price_equipment: result.componentBreakdown.breakdown.equipment,
              price_subcon: result.componentBreakdown.breakdown.subcontractor,
              updatedAt: new Date().toISOString()
            }
            set((s) => ({ ahspItems: s.ahspItems.map(i => i.id === ahspId ? updatedItem : i) }))
            syncAHSPItem(updatedItem)
          }
        },

        recalculateAllPrices: async () => {
          const results = await recalculateAllInWorker(get().ahspItems, get().componentsByAHSP)

          set((s) => ({
            ahspItems: s.ahspItems.map(item => {
              const calc = results.find(r => r.ahspId === item.id)
              if (!calc) return item
              return {
                ...item,
                basePrice: calc.result.priceBreakdown.basePrice,
                finalPrice: calc.result.priceBreakdown.finalPrice,
                price_material: calc.result.componentBreakdown.breakdown.material,
                price_labor: calc.result.componentBreakdown.breakdown.labor,
                price_equipment: calc.result.componentBreakdown.breakdown.equipment,
                price_subcon: calc.result.componentBreakdown.breakdown.subcontractor,
                updatedAt: new Date().toISOString()
              }
            })
          }))

          // Batch the writes: one upsert task per ~500 items instead of one task per
          // item. Recalculating 2475 items used to enqueue 2475 sequential UPDATE
          // requests (100ms apart ≈ 4+ minutes + sync-error spam). RLS allows write
          // (ahsp_items policy USING true), so a chunked upsert is safe.
          const allItems = get().ahspItems
          const CHUNK = 500
          for (let i = 0; i < allItems.length; i += CHUNK) {
            syncAHSPItems(allItems.slice(i, i + CHUNK))
          }
        },

        bulkUpdatePrices: (type, percentage) => {
          set((s) => ({
            resources: s.resources.map(r => r.type === type
              ? { ...r, unitPrice: Math.round(r.unitPrice * (1 + percentage / 100)), updatedAt: new Date().toISOString() }
              : r
            ),
          }))
          setTimeout(() => get().recalculateAllPrices(), 100)
        },

        searchResources: (query) => {
          const q = query.toLowerCase()
          return get().resources.filter(r => r.name.toLowerCase().includes(q) || r.code.toLowerCase().includes(q))
        },

        searchAHSPItems: (query) => {
          const q = query.toLowerCase()
          return get().ahspItems.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q))
        },

        filterByCategory: (category) => get().ahspItems.filter(i => i.category === category),

        fetchPriceHistory: async (ahspId, zoneId) => {
          set((s) => ({ loading: { ...s.loading, priceHistory: true } }))
          const { data, error } = await ahspRepository.fetchPriceHistory(ahspId, zoneId)
          set((s) => ({ loading: { ...s.loading, priceHistory: false } }))
          if (error) toast.error('Failed to load history')
          return data || []
        },

        // Settings actions
        updateSettings: (newSettings) => {
          set((s) => ({ settings: { ...s.settings, ...newSettings } }))
        },

        applySettingsToAll: () => {
          const { defaultOverhead, defaultProfit } = get().settings
          set((s) => ({
            ahspItems: s.ahspItems.map(item => ({
              ...item,
              overheadPercentage: defaultOverhead,
              profitPercentage: defaultProfit,
              updatedAt: new Date().toISOString()
            }))
          }))
          setTimeout(() => get().recalculateAllPrices(), 0)
        },

        // Zone actions
        fetchZones: async () => {
          set((s) => ({ loading: { ...s.loading, zones: true } }))
          const { data, error } = await ahspRepository.fetchZones()
          set((s) => ({ zones: data || [], loading: { ...s.loading, zones: false } }))
          if (error) toast.error('Failed to load zones')
        },

        addZone: async (zoneData) => {
          const id = generateId('zone')
          const now = new Date().toISOString()
          const zone: Zone = { id, ...zoneData, createdAt: now, updatedAt: now }
          set((s) => ({ zones: [...s.zones, zone] }))
          await ahspRepository.insertZone(zone)
        },

        updateZone: async (id, updates) => {
          set((s) => ({
            zones: s.zones.map(z => z.id === id ? { ...z, ...updates, updatedAt: new Date().toISOString() } : z)
          }))
          await ahspRepository.updateZone(id, updates)
        },

        deleteZone: async (id) => {
          set((s) => ({ zones: s.zones.filter(z => z.id !== id) }))
          await ahspRepository.deleteZone(id)
        },

        fetchZonePrices: async (zoneId) => {
          set((s) => ({ loading: { ...s.loading, zonePrices: true } }))
          const { data } = await ahspRepository.fetchZonePrices(zoneId)
          if (data) {
            set((s) => ({
              zonePricesByZone: { ...s.zonePricesByZone, [zoneId]: data },
              loading: { ...s.loading, zonePrices: false }
            }))
          } else {
            set((s) => ({ loading: { ...s.loading, zonePrices: false } }))
          }
        },

        updateZonePrice: async (priceData) => {
          const zoneId = priceData.zoneId
          const ahspId = priceData.ahspId
          const id = generateId('zp')
          const now = new Date().toISOString()
          const newPrice: AhspZonePrice = { ...priceData, id, createdAt: now, updatedAt: now }

          set((s) => {
            const current = s.zonePricesByZone[zoneId] || []
            const exists = current.some(p => p.ahspId === ahspId)
            const updated = exists
              ? current.map(p => p.ahspId === ahspId ? newPrice : p)
              : [...current, newPrice]

            return { zonePricesByZone: { ...s.zonePricesByZone, [zoneId]: updated } }
          })

          await ahspRepository.upsertZonePrice(newPrice)
        },

        clearAllData: async () => {
          set((s) => ({ loading: { ...s.loading, ahspItems: true, resources: true } }))
          const { success } = await ahspRepository.clearAllData()
          if (success) {
            set({
              resources: [], ahspItems: [], componentsByAHSP: {}, zones: [], zonePricesByZone: {},
              totalResourceCount: 0, totalAhspCount: 0,
              loading: { resources: false, ahspItems: false, components: false, priceHistory: false, zones: false, zonePrices: false }
            })
            toast.success('All data cleared')
          } else {
            toast.error('Failed to clear data')
            set((s) => ({ loading: { ...s.loading, ahspItems: false, resources: false } }))
          }
        }
      }),
      {
        name: 'ahsp-store',
        partialize: (state) => ({ settings: state.settings }),
      }
    )
  )
))


/**
 * Get AHSP summary statistics
 */
export function getAHSPSummary(state: AHSPState) {
  const normalizeResourceType = (type?: string): ResourceType | null => {
    if (!type) return null
    if (type === 'subcon') return 'subcontractor'
    if (type === 'material' || type === 'labor' || type === 'equipment' || type === 'subcontractor') return type
    return null
  }

  const totalAHSPItems = state.totalAhspCount || state.ahspItems.length
  const totalResources = state.totalResourceCount || state.resources.length

  const averagePrice = totalAHSPItems > 0
    ? state.ahspItems.reduce((sum, item) => sum + item.finalPrice, 0) / totalAHSPItems
    : 0

  const priceByCategory: Record<string, { count: number; totalPrice: number }> = {}
  state.ahspItems.forEach(item => {
    const categoryKey = item.category || 'Uncategorized'
    if (!priceByCategory[categoryKey]) {
      priceByCategory[categoryKey] = { count: 0, totalPrice: 0 }
    }
    priceByCategory[categoryKey].count++
    priceByCategory[categoryKey].totalPrice += item.finalPrice || 0
  })

  const resourcesByType: Record<ResourceType, { count: number; totalPrice: number }> = {
    material: { count: 0, totalPrice: 0 },
    labor: { count: 0, totalPrice: 0 },
    equipment: { count: 0, totalPrice: 0 },
    subcontractor: { count: 0, totalPrice: 0 },
  }

  state.resources.forEach(resource => {
    const normalizedType = normalizeResourceType(resource.type as string)
    if (!normalizedType) return
    resourcesByType[normalizedType].count++
    resourcesByType[normalizedType].totalPrice += resource.unitPrice || 0
  })

  return {
    totalAHSPItems,
    totalResources,
    averagePrice,
    priceByCategory,
    resourcesByType,
  }
}

/**
 * Validate AHSP data
 */
export function validateAHSP(state: AHSPState) {
  const errors: string[] = []
  const warnings: string[] = []

  // Check for AHSP items without components
  state.ahspItems.forEach(item => {
    const components = state.componentsByAHSP[item.id] || []
    if (components.length === 0) {
      warnings.push(`AHSP item "${item.name}" has no components`)
    }
  })

  // Check for orphaned components
  Object.entries(state.componentsByAHSP).forEach(([ahspId, components]) => {
    const ahspItem = state.ahspItems.find(item => item.id === ahspId)
    if (!ahspItem) {
      errors.push(`Found components for non-existent AHSP item: ${ahspId}`)
    }

    components.forEach(component => {
      const resource = state.resources.find(r => r.id === component.resourceId)
      if (!resource) {
        errors.push(`Component references non-existent resource: ${component.resourceId}`)
      }
    })
  })

  // Check for duplicate codes
  const resourceCodes = new Set<string>()
  state.resources.forEach(resource => {
    if (resourceCodes.has(resource.code)) {
      errors.push(`Duplicate resource code: ${resource.code}`)
    }
    resourceCodes.add(resource.code)
  })

  const ahspCodes = new Set<string>()
  state.ahspItems.forEach(item => {
    if (ahspCodes.has(item.code)) {
      errors.push(`Duplicate AHSP code: ${item.code}`)
    }
    ahspCodes.add(item.code)
  })

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  }
}

/**
 * Cross-Store Synchronization: AHSP -> RAB
 * 
 * Notify useRABStore when AHSP prices change so it can flag drifts.
 * Fulfills Section 4.3A.1 of the refactoring plan.
 */
useAHSPStore.subscribe(
  (state) => state.ahspItems,
  (items) => {
    // We import useRABStore dynamically to avoid circular dependencies
    import('./rabStore').then(({ useRabStore }) => {
       const staleIds = items.map(i => i.id)
       if (staleIds.length > 0) {
         // This flags that catalog prices have changed
         // and the RAB view might need to highlight drifts.
         const rabStore = useRabStore.getState().checkPriceDrift()
       }
    }).catch(() => {
        // Silently ignore if RAB store is not yet loaded
    })
  }
)
