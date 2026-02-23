/**
 * ahspStore.ts
 * Zustand store for AHSP (Analisis Harga Satuan Pekerjaan) management
 */

import { create } from 'zustand'
import { assertSupabase } from '../lib/supabaseClient'
import type {
  AhspItemRow,
  ResourceRow,
  AhspComponentRow,
  AhspPriceHistoryRow
} from '../lib/supabaseClient'
import { devtools, persist } from 'zustand/middleware'
import { ahspRepository } from '../lib/ahspRepository'
import {
  calculateSingleAHSPPrice,
  recalculateAllInWorker,
  prepareImportData,
  toSupabaseRows,
  initializeAHSPItem,
  initializeAHSPComponent,
  calculateAHSPPriceInWorker
} from '../services/ahspService'
import { syncAHSPItem, syncResource, syncResources, syncAHSPComponent, syncAHSPComponents, syncDelete, syncAHSPItems, syncAHSPItemsWithComponents } from '../lib/supabaseSyncService'
import { validate } from '../lib/validationMiddleware'
import {
  resourceInputSchema,
  resourceUpdateSchema,
  ahspItemInputSchema,
  ahspItemUpdateSchema,
  ahspComponentInputSchema,
  ahspComponentUpdateSchema
} from '../lib/validationSchemas'
import { toast } from 'sonner'
import { generateId } from '../lib/idGenerator'
import type {
  AHSPStore,
  Resource,
  AHSPItem,
  AHSPComponent,
  ResourceType,
  ResourceUnit,
  AHSPState,
  PriceHistory,
  Zone,
  AhspZonePrice
} from '../types/ahsp'

/**
 * Validate unit format
 */
function validateUnit(unit: string): unit is ResourceUnit {
  const validUnits: ResourceUnit[] = ['kg', 'm3', 'm2', 'm', 'ltr', 'bh', 'oh', 'jam', 'hr', 'hari', 'unit', 'ha', 'set', 'ls', 'btg', 'lembar']
  return validUnits.includes(unit as ResourceUnit)
}

/**
 * Create AHSP Store with Zustand
 */
export const useAHSPStore = create<AHSPStore>()(
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
          const { data, error } = await ahspRepository.fetchAllResources()
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

          const { data: allItems, error } = await ahspRepository.fetchAllAHSPItems()
          if (error) {
            set((state) => ({
              loading: { ...state.loading, ahspItems: false },
              errors: { ...state.errors, ahspItems: error },
            }))
            toast.error('Failed to load AHSP items', { description: error })
            return
          }

          // Fetch creation logs via repository
          const logByAhspId = await ahspRepository.fetchCreationLogs(allItems.map(i => i.id))

          const itemsWithLogs: AHSPItem[] = allItems.map((item) => {
            const log = logByAhspId.get(item.id)
            if (!log) return item
            return {
              ...item,
              creationMode: log.creation_mode as 'sni' | 'custom' | 'historical',
              sourceReference: log.source_reference || undefined,
            }
          })

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

        // Resource actions
        addResource: (resource) => {
          // Validate input
          const validation = validate(resourceInputSchema, resource)
          if (!validation.success) {
            const errors = validation.errors || []
            const errorMsg = errors[0]?.message || 'Validation failed'
            toast.error('Failed to add resource', {
              description: errorMsg
            })
            set((state) => ({
              errors: {
                ...state.errors,
                resources: errorMsg,
              },
            }))
            return
          }

          const newResource: Resource = {
            ...validation.data!,
            id: generateId('res'),
            isActive: validation.data!.isActive ?? true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          set((state) => ({
            resources: [...state.resources, newResource],
            errors: {
              ...state.errors,
              resources: null,
            },
          }))

          // Queue-based sync with retry logic
          syncResource(newResource)

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
        },

        deleteResource: (id) => {
          set((state) => {
            // Check if resource is used in any component
            const isUsed = Object.values(state.componentsByAHSP)
              .flat()
              .some(component => component.resourceId === id)

            if (isUsed) {
              return {
                errors: {
                  ...state.errors,
                  resources: 'Cannot delete resource that is used in AHSP components',
                },
              }
            }

            return {
              resources: state.resources.filter(resource => resource.id !== id),
              errors: {
                ...state.errors,
                resources: null,
              },
            }
          })
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

          // Persist to Supabase
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

          const newItem = initializeAHSPItem(validation.data, {
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

        updateAHSPItem: (id, updates) => {
          // Validate updates
          const validation = validate(ahspItemUpdateSchema, updates)
          if (!validation.success) {
            const errors = validation.errors || []
            const errorMsg = errors[0]?.message || 'Validation failed'
            toast.error('Failed to update AHSP item', {
              description: errorMsg
            })
            return
          }

          set((state) => ({
            ahspItems: state.ahspItems.map(item =>
              item.id === id
                ? { ...item, ...validation.data!, updatedAt: new Date().toISOString() }
                : item
            ),
          }))

          const state = get()
          const updated = state.ahspItems.find(i => i.id === id)
          if (updated) {
            syncAHSPItem(updated)
          }
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
              console.error('Direct import failed:', error)
              toast.error(`Gagal import ke Supabase: ${error instanceof Error ? error.message : 'Unknown error'}`)
            }
          } else {
            // SMALL IMPORT
            set((state) => ({
              resources: allNewResources.length > 0 ? [...state.resources, ...allNewResources] : state.resources,
              ahspItems: [...state.ahspItems, ...newItems],
              componentsByAHSP: { ...state.componentsByAHSP, ...componentsByAHSP },
            }))

            if (allNewResources.length > 0) syncResources(allNewResources)
            syncAHSPItemsWithComponents(newItems, allNewComponents).catch(error => {
              console.error('Failed to sync AHSP data:', error)
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

          const newComp = initializeAHSPComponent(ahspId, validation.data, get().resources)

          set((s) => {
            const current = s.componentsByAHSP[ahspId] || []
            return {
              componentsByAHSP: { ...s.componentsByAHSP, [ahspId]: [...current, newComp] },
              errors: { ...s.errors, components: null }
            }
          })

          syncAHSPComponent(newComp)
          get().calculateAHSPPrice(ahspId)
        },

        updateComponent: (id, updates) => {
          set((state) => {
            const newComponentsByAHSP = { ...state.componentsByAHSP }
            let updatedAHSPId: string | null = null

            // Find and update component
            Object.keys(newComponentsByAHSP).forEach(ahspId => {
              const components = newComponentsByAHSP[ahspId]
              const componentIndex = components.findIndex(c => c.id === id)

              if (componentIndex !== -1) {
                const component = components[componentIndex]
                const updatedComponent = { ...component, ...updates }

                // Update unit price if resource changed
                if (updates.resourceId) {
                  const resource = state.resources.find(r => r.id === updates.resourceId)
                  if (resource) {
                    updatedComponent.resource = resource
                    updatedComponent.unit = resource.unit
                    updatedComponent.unitPrice = resource.unitPrice
                  }
                }

                // Recalculate subtotal
                updatedComponent.coefficient = updatedComponent.coefficient ?? component.coefficient // Ensure coefficient is not undefined
                updatedComponent.unitPrice = updatedComponent.unitPrice ?? component.unitPrice // Ensure unitPrice is not undefined
                updatedComponent.subtotal = updatedComponent.coefficient * updatedComponent.unitPrice
                updatedComponent.updatedAt = new Date().toISOString()

                newComponentsByAHSP[ahspId] = [
                  ...components.slice(0, componentIndex),
                  updatedComponent,
                  ...components.slice(componentIndex + 1),
                ]

                updatedAHSPId = ahspId
              }
            })

            return {
              componentsByAHSP: newComponentsByAHSP,
            }
          })

          // Recalculate AHSP price if component was updated
          setTimeout(() => {
            const state = get()
            Object.keys(state.componentsByAHSP).forEach(ahspId => {
              if (state.componentsByAHSP[ahspId].some(c => c.id === id)) {
                get().calculateAHSPPrice(ahspId)
              }
            })
          }, 0)
        },

        deleteComponent: (id) => {
          set((state) => {
            const newComponentsByAHSP = { ...state.componentsByAHSP }
            let deletedAHSPId: string | null = null

            Object.keys(newComponentsByAHSP).forEach(ahspId => {
              const components = newComponentsByAHSP[ahspId]
              const filteredComponents = components.filter(c => c.id !== id)

              if (filteredComponents.length !== components.length) {
                newComponentsByAHSP[ahspId] = filteredComponents
                deletedAHSPId = ahspId
              }
            })

            return {
              componentsByAHSP: newComponentsByAHSP,
            }
          })

          // Recalculate AHSP price if component was deleted
          setTimeout(() => {
            const state = get()
            Object.keys(state.componentsByAHSP).forEach(ahspId => {
              if (state.componentsByAHSP[ahspId].some(c => c.id === id)) {
                get().calculateAHSPPrice(ahspId)
              }
            })
          }, 0)
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

        // Calculation actions — delegated to ahspService
        calculateAHSPPrice: async (ahspId) => {
          const item = get().ahspItems.find(i => i.id === ahspId)
          const components = get().componentsByAHSP[ahspId] || []
          if (!item) return

          try {
            const results = await calculateAHSPPriceInWorker(item, components)
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
            console.error('Failed to calculate price in worker:', error)
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

          get().ahspItems.forEach(item => syncAHSPItem(item))
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
          const { data, error } = await ahspRepository.fetchZonePrices(zoneId)
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
          const data = priceData as any
          const id = data.id || generateId('zp')
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
          const { success, error } = await ahspRepository.clearAllData()
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
)

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
