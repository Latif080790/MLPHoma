/**
 * ahspStore.ts
 * Zustand store for AHSP (Analisis Harga Satuan Pekerjaan) management
 */

import { create } from 'zustand'
import { assertSupabase, fetchResources, fetchAhspItems } from '../lib/supabaseClient'
import type {
  AhspItemRow,
  ResourceRow,
  AhspComponentRow,
  AhspPriceHistoryRow
} from '../lib/supabaseClient'
import { devtools, persist } from 'zustand/middleware'
import { calculateAHSPPrice as calcAHSPPrice } from '../lib/calculationService'
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
  const validUnits: ResourceUnit[] = ['kg', 'm3', 'm2', 'm', 'ltr', 'bh', 'oh', 'jam', 'hr', 'hari', 'unit']
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
        ahspItems: [],
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

        // Data fetching actions
        fetchResources: async () => {
          set((state) => ({ loading: { ...state.loading, resources: true }, errors: { ...state.errors, resources: null } }))
          try {
            const { data, error } = await fetchResources()
            if (error) throw error

            const rows = (data as ResourceRow[]) || []
            const resources: Resource[] = rows.map(r => {
              const dbType = (r.type || '').toUpperCase()
              const type: ResourceType =
                dbType === 'LABOR' ? 'labor' :
                  dbType === 'EQUIPMENT' ? 'equipment' :
                    dbType === 'SUBCON' || dbType === 'SUBCONTRACTOR' ? 'subcontractor' :
                      'material'

              return {
                id: r.id,
                code: r.code,
                name: r.name,
                type,
                unit: r.unit as ResourceUnit,
                unitPrice: r.unit_price,
                isActive: r.is_active ?? true,
                supplier: r.supplier,
                specifications: r.specifications,
                createdAt: r.created_at || new Date().toISOString(),
                updatedAt: r.updated_at || new Date().toISOString()
              }
            })

            set((state) => ({
              resources,
              loading: { ...state.loading, resources: false },
            }))
          } catch (error: any) {
            const errorMsg = error.message || 'Failed to fetch resources'
            set((state) => ({
              loading: { ...state.loading, resources: false },
              errors: { ...state.errors, resources: errorMsg },
            }))
            toast.error('Failed to load resources', {
              description: errorMsg
            })
          }
        },

        fetchAHSPItems: async () => {
          set((state) => ({
            loading: { ...state.loading, ahspItems: true },
            errors: { ...state.errors, ahspItems: null },
          }))

          try {
            const { data, error } = await fetchAhspItems()

            if (error) throw error

            const items = (data as AhspItemRow[]) || []
            set((state) => ({
              ahspItems: items.map((item) => ({
                ...item,
                // Ensure property mapping if names differ, though AhspItemRow mostly matches AHSPItem except for camelCase?
                // AHSPItem: id, code, name, category, unit, basePrice, finalPrice
                // AhspItemRow: id, code, name, category, unit, base_price, final_price
                // We need to map snake_case to camelCase
                basePrice: item.base_price || 0,
                finalPrice: item.final_price || 0,

                // Map split cost fields
                price_material: item.price_material || 0,
                price_labor: item.price_labor || 0,
                price_equipment: item.price_equipment || 0,
                price_subcon: item.price_subcon || 0,

                overheadPercentage: item.overhead_percentage || 0,
                profitPercentage: item.profit_percentage || 0,
                createdAt: item.created_at,
                updatedAt: item.updated_at
              })) as AHSPItem[],
              loading: { ...state.loading, ahspItems: false },
            }))
          } catch (error: any) {
            const errorMsg = error.message || 'Failed to fetch AHSP items'
            set((state) => ({
              loading: { ...state.loading, ahspItems: false },
              errors: { ...state.errors, ahspItems: errorMsg },
            }))
            toast.error('Failed to load AHSP items', {
              description: errorMsg
            })
          }
        },

        fetchComponents: async (ahspId?: string) => {
          set((state) => ({
            loading: { ...state.loading, components: true },
            errors: { ...state.errors, components: null },
          }))

          try {
            const client = assertSupabase()
            let query = client
              .from('ahsp_components')
              .select(`
              *,
              resource:resources(*)
            `)
              .order('created_at', { ascending: true })

            if (ahspId) {
              query = query.eq('ahsp_id', ahspId)
            }

            const { data, error } = await query

            if (error) throw error

            // Group components by AHSP ID
            const componentsByAHSP: Record<string, AHSPComponent[]> = {}

            const rows = (data as (AhspComponentRow & { resource: ResourceRow | null })[]) || []

            rows.forEach((comp: AhspComponentRow & { resource: ResourceRow | null }) => {
              const component: AHSPComponent = {
                id: comp.id,
                ahspId: comp.ahsp_id,
                type: comp.type as ResourceType,
                resourceId: comp.resource_id,
                coefficient: comp.coefficient,
                unit: comp.unit as ResourceUnit,
                unitPrice: comp.unit_price,
                subtotal: comp.subtotal,
                resource: comp.resource ? {
                  id: comp.resource.id,
                  code: comp.resource.code,
                  name: comp.resource.name,
                  type: comp.resource.type as ResourceType,
                  unit: comp.resource.unit as ResourceUnit,
                  unitPrice: comp.resource.unit_price,
                  isActive: comp.resource.is_active ?? true,
                  supplier: comp.resource.supplier,
                  specifications: comp.resource.specifications,
                  createdAt: comp.resource.created_at || new Date().toISOString(),
                  updatedAt: comp.resource.updated_at || new Date().toISOString()
                } : undefined,
                createdAt: comp.created_at || new Date().toISOString(),
                updatedAt: comp.updated_at || new Date().toISOString(),
              }

              if (!componentsByAHSP[comp.ahsp_id]) {
                componentsByAHSP[comp.ahsp_id] = []
              }
              componentsByAHSP[comp.ahsp_id].push(component)
            })

            set((state) => ({
              componentsByAHSP: ahspId
                ? { ...state.componentsByAHSP, [ahspId]: componentsByAHSP[ahspId] || [] }
                : componentsByAHSP,
              loading: { ...state.loading, components: false },
            }))
          } catch (error: any) {
            const errorMsg = error.message || 'Failed to fetch components'
            set((state) => ({
              loading: { ...state.loading, components: false },
              errors: { ...state.errors, components: errorMsg },
            }))
            toast.error('Failed to load components', {
              description: errorMsg
            })
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
          // Validate input
          const validation = validate(ahspItemInputSchema, item)
          if (!validation.success) {
            const errors = validation.errors || []
            const errorMsg = errors[0]?.message || 'Validation failed'
            toast.error('Failed to add AHSP item', {
              description: errorMsg
            })
            set((state) => ({
              errors: {
                ...state.errors,
                ahspItems: errorMsg,
              },
            }))
            return ''
          }

          const id = item.id || generateId('ahsp')
          const newItem: AHSPItem = {
            ...validation.data!,
            id,
            basePrice: validation.data!.basePrice ?? 0,
            finalPrice: validation.data!.finalPrice ?? 0,
            isActive: validation.data!.isActive ?? true,
            overheadPercentage: validation.data!.overheadPercentage ?? get().settings.defaultOverhead,
            profitPercentage: validation.data!.profitPercentage ?? get().settings.defaultProfit,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            // Initialize split costs as 0 or from input if available
            price_material: validation.data!.price_material ?? 0,
            price_labor: validation.data!.price_labor ?? 0,
            price_equipment: validation.data!.price_equipment ?? 0,
            price_subcon: validation.data!.price_subcon ?? 0,
          }

          set((state) => ({
            ahspItems: [...state.ahspItems, newItem],
            componentsByAHSP: {
              ...state.componentsByAHSP,
              [newItem.id]: [],
            },
            errors: {
              ...state.errors,
              ahspItems: null,
            },
          }))

          // Queue-based sync with retry logic
          syncAHSPItem(newItem)
          return id
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

        importAHSPItems: (items) => {
          const newItems: AHSPItem[] = []
          const allNewComponents: AHSPComponent[] = []
          const allNewResources: Resource[] = []
          const resourceMap = new Map<string, string>() // code -> id

          items.forEach(item => {
            const newItemId = generateId('ahsp')
            const newItem: AHSPItem = {
              ...item,
              id: newItemId,
              basePrice: item.basePrice || 0,
              finalPrice: item.finalPrice || 0,
              isActive: item.isActive !== false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            }
            newItems.push(newItem)

            // Process components if they exist in the import
            if ((item as any).components && Array.isArray((item as any).components)) {
              (item as any).components.forEach((comp: any) => {
                // Determine resource type safely
                const typeRaw = (comp.category || comp.type || 'material').toLowerCase()
                const type: ResourceType =
                  typeRaw.includes('labor') || typeRaw.includes('tenaga') ? 'labor' :
                    typeRaw.includes('equipment') || typeRaw.includes('alat') ? 'equipment' :
                      typeRaw.includes('subcon') ? 'subcontractor' : 'material'

                // Map/Generate Resource
                const resCode = comp.code || generateId('res-code').substring(0, 8)
                let resourceId = resourceMap.get(resCode)

                if (!resourceId) {
                  // Check if resource already exists in store by code
                  const existingRes = get().resources.find(r => r.code === resCode)
                  if (existingRes) {
                    resourceId = existingRes.id
                  } else {
                    const resPrice = Number(comp.price || comp.unitPrice || 0)
                    const validResPrice = isNaN(resPrice) ? 0 : resPrice

                    resourceId = `res-${resCode.toLowerCase().replace(/[^a-z0-9]/g, '-')}`
                    const newResource: Resource = {
                      id: resourceId,
                      code: resCode,
                      name: comp.name || 'Unknown Resource',
                      type,
                      unit: comp.unit || 'unit',
                      unitPrice: validResPrice,
                      isActive: true,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString()
                    }
                    allNewResources.push(newResource)
                    resourceMap.set(resCode, resourceId)
                  }
                }

                const price = Number(comp.price || comp.unitPrice || 0)
                const validPrice = isNaN(price) ? 0 : price
                const coeff = Number(comp.coefficient || 0)
                const validCoeff = isNaN(coeff) ? 0 : coeff

                const newComponent: AHSPComponent = {
                  id: generateId('comp'),
                  ahspId: newItemId,
                  resourceId: resourceId!,
                  type,
                  coefficient: validCoeff,
                  unit: comp.unit || 'unit',
                  unitPrice: validPrice,
                  subtotal: validCoeff * validPrice,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString()
                }
                allNewComponents.push(newComponent)
              })
            }
          })

          const componentsByAHSP: Record<string, AHSPComponent[]> = {}

          // Re-group for store state and calculate split costs
          newItems.forEach(item => {
            const itemComponents = allNewComponents.filter(c => c.ahspId === item.id)
            componentsByAHSP[item.id] = itemComponents

            // Calculate split cost fields for the item
            item.price_material = itemComponents
              .filter(c => c.type === 'material')
              .reduce((sum, c) => sum + c.subtotal, 0)
            item.price_labor = itemComponents
              .filter(c => c.type === 'labor')
              .reduce((sum, c) => sum + c.subtotal, 0)
            item.price_equipment = itemComponents
              .filter(c => c.type === 'equipment')
              .reduce((sum, c) => sum + c.subtotal, 0)
            item.price_subcon = itemComponents
              .filter(c => ((c.type as string) === 'subcontractor' || (c.type as string) === 'subcon'))
              .reduce((sum, c) => sum + c.subtotal, 0)
          })

          set((state) => ({
            resources: allNewResources.length > 0 ? [...state.resources, ...allNewResources] : state.resources,
            ahspItems: [...state.ahspItems, ...newItems],
            componentsByAHSP: { ...state.componentsByAHSP, ...componentsByAHSP },
          }))

          // Persist to Supabase
          if (allNewResources.length > 0) {
            syncResources(allNewResources)
          }
          // Sync AHSP items with components sequentially to avoid FK constraint error
          syncAHSPItemsWithComponents(newItems, allNewComponents).catch(error => {
            console.error('Failed to sync AHSP data:', error)
          })
        },

        exportAHSPItems: () => {
          return get().ahspItems
        },

        // Component actions
        addComponent: (ahspId, component) => {
          // Validate input
          const validation = validate(ahspComponentInputSchema, component)
          if (!validation.success) {
            const errors = validation.errors || []
            const errorMsg = errors[0]?.message || 'Validation failed'
            toast.error('Failed to add component', {
              description: errorMsg
            })
            set((prevState) => ({
              errors: {
                ...prevState.errors,
                components: errorMsg,
              },
            }))
            return
          }

          const state = get()
          const resource = state.resources.find(r => r.id === validation.data!.resourceId)

          if (!resource) {
            set((prevState) => ({
              errors: {
                ...prevState.errors,
                components: 'Resource not found',
              },
            }))
            return
          }

          const newComponent: AHSPComponent = {
            ...validation.data!,
            id: generateId('comp'),
            ahspId,
            unit: resource.unit,
            unitPrice: resource.unitPrice,
            subtotal: validation.data!.coefficient * resource.unitPrice,
            resource,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }

          set((state) => ({
            componentsByAHSP: {
              ...state.componentsByAHSP,
              [ahspId]: [...(state.componentsByAHSP[ahspId] || []), newComponent],
            },
            errors: {
              ...state.errors,
              components: null,
            },
          }))

          syncAHSPComponent(newComponent)

          // Recalculate AHSP price
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

        // Calculation actions
        calculateAHSPPrice: (ahspId) => {
          set((state) => {
            const components = state.componentsByAHSP[ahspId] || []
            const ahspItem = state.ahspItems.find(item => item.id === ahspId)
            if (!ahspItem) return state

            // Use centralized calculation service with validation
            const result = calcAHSPPrice({
              components: components.map(c => ({
                coefficient: c.coefficient,
                unitPrice: c.unitPrice
              })),
              overheadPercent: ahspItem.overheadPercentage,
              profitPercent: ahspItem.profitPercentage
            })

            return {
              ahspItems: state.ahspItems.map(item =>
                item.id === ahspId
                  ? {
                    ...item,
                    basePrice: result.priceBreakdown.basePrice,
                    finalPrice: result.priceBreakdown.finalPrice,

                    // Update split costs from breakdown - This will now be persisted via syncAHSPItem
                    price_material: result.componentBreakdown.breakdown.material,
                    price_labor: result.componentBreakdown.breakdown.labor,
                    price_equipment: result.componentBreakdown.breakdown.equipment,
                    price_subcon: result.componentBreakdown.breakdown.subcontractor,

                    updatedAt: new Date().toISOString(),
                  }
                  : item
              ),
            }
          })

          // Queue-based sync with retry
          const item = get().ahspItems.find(i => i.id === ahspId)
          if (item) {
            // Explicitly sync the new split cost fields to update the DB
            // Note: syncAHSPItem needs to be robust enough to handle these new fields if they are in the Type
            syncAHSPItem(item)
          }
        },

        recalculateAllPrices: () => {
          const state = get()
          Object.keys(state.componentsByAHSP).forEach(ahspId => {
            get().calculateAHSPPrice(ahspId)
          })
        },

        // Bulk actions
        bulkUpdatePrices: (type, percentage) => {
          set((state) => ({
            resources: state.resources.map(resource =>
              resource.type === type
                ? {
                  ...resource,
                  unitPrice: Math.round(resource.unitPrice * (1 + percentage / 100)),
                  updatedAt: new Date().toISOString(),
                }
                : resource
            ),
          }))

          // Recalculate all AHSP prices
          setTimeout(() => {
            get().recalculateAllPrices()
          }, 100)
        },

        // Search and filter
        searchResources: (query) => {
          const state = get()
          const lowerQuery = query.toLowerCase()
          return state.resources.filter(resource =>
            resource.name.toLowerCase().includes(lowerQuery) ||
            resource.code.toLowerCase().includes(lowerQuery) ||
            resource.specifications?.toLowerCase().includes(lowerQuery)
          )
        },

        searchAHSPItems: (query) => {
          const state = get()
          const lowerQuery = query.toLowerCase()
          return state.ahspItems.filter(item =>
            item.name.toLowerCase().includes(lowerQuery) ||
            item.code.toLowerCase().includes(lowerQuery) ||
            item.category.toLowerCase().includes(lowerQuery)
          )
        },

        filterByCategory: (category) => {
          const state = get()
          return state.ahspItems.filter(item => item.category === category)
        },

        // History actions
        fetchPriceHistory: async (ahspId: string, zoneId?: string) => {
          set((state) => ({
            loading: { ...state.loading, priceHistory: true },
            errors: { ...state.errors, priceHistory: null }
          }))
          try {
            const client = assertSupabase()
            let query = client
              .from('ahsp_price_history')
              .select('*')
              .eq('ahsp_id', ahspId)
              .order('created_at', { ascending: false })

            if (zoneId) {
              query = query.eq('zone_id', zoneId)
            } else {
              query = query.is('zone_id', null)
            }

            const { data, error } = await query

            if (error) throw error

            const history = (data as any[]).map((item) => ({
              id: item.id,
              ahspId: item.ahsp_id,
              zoneId: item.zone_id,
              oldPrice: item.old_price,
              newPrice: item.new_price,
              priceMaterial: item.price_material,
              priceLabor: item.price_labor,
              priceEquipment: item.price_equipment,
              priceSubcon: item.price_subcon,
              changeType: item.change_type,
              changeReason: item.change_reason,
              changedBy: item.changed_by, // ideally resolve user name
              createdAt: item.created_at || new Date().toISOString()
            }))

            return history
          } catch (error: any) {
            console.error('Failed to fetch price history:', error)
            set((state) => ({
              errors: { ...state.errors, priceHistory: error.message }
            }))
            return []
          } finally {
            set((state) => ({
              loading: { ...state.loading, priceHistory: false }
            }))
          }
        },

        // Settings actions
        updateSettings: (newSettings) => {
          set((state) => ({
            settings: { ...state.settings, ...newSettings }
          }))
        },

        /* -------------------------------------------------------------------------- */
        /*                                ZONE ACTIONS                                */
        /* -------------------------------------------------------------------------- */

        fetchZones: async () => {
          set((state) => ({
            loading: { ...state.loading, zones: true },
            errors: { ...state.errors, zones: null }
          }))
          try {
            const client = assertSupabase()
            const { data, error } = await client.from('zones').select('*').order('created_at')
            if (error) throw error

            const zones: Zone[] = (data || []).map(z => ({
              id: z.id,
              name: z.name,
              description: z.description,
              isActive: z.is_active,
              createdAt: z.created_at,
              updatedAt: z.updated_at
            }))

            set((state) => ({
              zones,
              loading: { ...state.loading, zones: false }
            }))
          } catch (err: any) {
            set((state) => ({
              loading: { ...state.loading, zones: false },
              errors: { ...state.errors, zones: err.message }
            }))
          }
        },

        addZone: (zoneData) => {
          const newZone: Zone = {
            id: generateId('zone'),
            name: zoneData.name,
            description: zoneData.description,
            isActive: zoneData.isActive ?? true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }

          set(state => ({
            zones: [...state.zones, newZone]
          }))

          // Sync
          const client = assertSupabase()
          client.from('zones').insert({
            id: newZone.id,
            name: newZone.name,
            description: newZone.description,
            is_active: newZone.isActive,
            created_at: newZone.createdAt,
            updated_at: newZone.updatedAt
          }).then(({ error }) => {
            if (error) toast.error("Failed to sync zone")
          })
        },

        updateZone: (id, updates) => {
          set(state => ({
            zones: state.zones.map(z => z.id === id ? { ...z, ...updates, updatedAt: new Date().toISOString() } : z)
          }))

          const client = assertSupabase()
          client.from('zones').update({
            name: updates.name,
            description: updates.description,
            is_active: updates.isActive,
            updated_at: new Date().toISOString()
          }).eq('id', id).then(({ error }) => {
            if (error) toast.error("Failed to update zone")
          })
        },

        deleteZone: (id) => {
          set(state => ({
            zones: state.zones.filter(z => z.id !== id)
          }))
          syncDelete('zones', id)
        },

        fetchZonePrices: async (zoneId) => {
          set(state => ({
            loading: { ...state.loading, zonePrices: true }
          }))
          try {
            const client = assertSupabase()
            const { data, error } = await client
              .from('ahsp_zone_prices')
              .select('*')
              .eq('zone_id', zoneId)

            if (error) throw error

            const prices: AhspZonePrice[] = (data || []).map(p => ({
              id: p.id,
              ahspId: p.ahsp_id,
              zoneId: p.zone_id,
              price_material: p.price_material || 0,
              price_labor: p.price_labor || 0,
              price_equipment: p.price_equipment || 0,
              price_subcon: p.price_subcon || 0,
              overheadPercentage: p.overhead_percentage || 0,
              profitPercentage: p.profit_percentage || 0,
              finalPrice: p.final_price || 0,
              createdAt: p.created_at,
              updatedAt: p.updated_at
            }))

            set(state => ({
              zonePricesByZone: {
                ...state.zonePricesByZone,
                [zoneId]: prices
              },
              loading: { ...state.loading, zonePrices: false }
            }))
          } catch (err: any) {
            console.error(err)
            set(state => ({ loading: { ...state.loading, zonePrices: false } }))
          }
        },

        updateZonePrice: (priceData) => {
          const { zoneId, ahspId } = priceData

          set(state => {
            const zonePrices = state.zonePricesByZone[zoneId] || []
            const existingIdx = zonePrices.findIndex(p => p.ahspId === ahspId)

            let newPrices = [...zonePrices]
            const now = new Date().toISOString()

            // Calculate final price locally
            const sum = (priceData.price_material || 0) +
              (priceData.price_labor || 0) +
              (priceData.price_equipment || 0) +
              (priceData.price_subcon || 0)
            const final = sum * (1 + ((priceData.overheadPercentage || 0) + (priceData.profitPercentage || 0)) / 100)

            const newRecord: AhspZonePrice = {
              id: existingIdx >= 0 ? zonePrices[existingIdx].id : generateId('zp'),
              ahspId,
              zoneId,
              price_material: priceData.price_material ?? 0,
              price_labor: priceData.price_labor ?? 0,
              price_equipment: priceData.price_equipment ?? 0,
              price_subcon: priceData.price_subcon ?? 0,
              overheadPercentage: priceData.overheadPercentage ?? 0,
              profitPercentage: priceData.profitPercentage ?? 0,
              finalPrice: final,
              createdAt: existingIdx >= 0 ? zonePrices[existingIdx].createdAt : now,
              updatedAt: now
            }

            if (existingIdx >= 0) {
              newPrices[existingIdx] = newRecord
            } else {
              newPrices.push(newRecord)
            }

            return {
              zonePricesByZone: {
                ...state.zonePricesByZone,
                [zoneId]: newPrices
              }
            }
          })

          // Sync
          const client = assertSupabase()
          const state = get()
          const price = state.zonePricesByZone[zoneId]?.find(p => p.ahspId === ahspId)
          if (!price) return

          client.from('ahsp_zone_prices').upsert({
            id: price.id,
            ahsp_id: price.ahspId,
            zone_id: price.zoneId,
            price_material: price.price_material,
            price_labor: price.price_labor,
            price_equipment: price.price_equipment,
            price_subcon: price.price_subcon,
            overhead_percentage: price.overheadPercentage,
            profit_percentage: price.profitPercentage,
            // final_price is generated
            updated_at: price.updatedAt
          }).then(({ error }) => {
            if (error) {
              console.error("Failed to sync zone price", error)
              toast.error("Failed to save zone price")
            }
          })
        },

        applySettingsToAll: () => {
          const state = get()
          const { defaultOverhead, defaultProfit } = state.settings

          set((state) => ({
            ahspItems: state.ahspItems.map(item => ({
              ...item,
              overheadPercentage: defaultOverhead,
              profitPercentage: defaultProfit,
              updatedAt: new Date().toISOString()
            }))
          }))

          // Recalculate all prices after applying settings
          setTimeout(() => {
            get().recalculateAllPrices()
          }, 0)
        },
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

  const totalAHSPItems = state.ahspItems.length
  const totalResources = state.resources.length

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
