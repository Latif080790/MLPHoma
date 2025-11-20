/**
 * ahspStore.ts
 * Zustand store for AHSP (Analisis Harga Satuan Pekerjaan) management
 */

import { create } from 'zustand'
import { 
  batchUpsertAhsp, 
  supabase, 
  deleteAhspItem,
  batchUpsertResources,
  batchUpsertAhspComponents,
  deleteAhspComponent, // Need to add this to client
  deleteResource // Need to add this to client
} from '../lib/supabaseClient'
import { devtools } from 'zustand/middleware'
import type { 
  AHSPStore, 
  Resource, 
  AHSPItem, 
  AHSPComponent,
  ResourceType,
  ResourceUnit,
  AHSPState
} from '../types/ahsp'

/**
 * Generate unique ID
 */
function generateId(prefix: string = 'ahsp'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

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
    (set, get) => ({
      // Initial state
      resources: [],
      ahspItems: [],
      componentsByAHSP: {},
      loading: {
        resources: false,
        ahspItems: false,
        components: false,
      },
      errors: {
        resources: null,
        ahspItems: null,
        components: null,
      },

      // Resource actions
      addResource: (resource) => {
        const newResource: Resource = {
          ...resource,
          id: generateId('res'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }

        set((state) => ({
          resources: [...state.resources, newResource],
        }))

        if (supabase) {
          batchUpsertResources([{
            id: newResource.id,
            code: newResource.code,
            name: newResource.name,
            type: newResource.type,
            unit: newResource.unit,
            unit_price: newResource.unitPrice,
            created_at: newResource.createdAt,
            updated_at: newResource.updatedAt
          }])
        }
      },

      updateResource: (id, updates) => {
        set((state) => ({
          resources: state.resources.map(resource =>
            resource.id === id
              ? { ...resource, ...updates, updatedAt: new Date().toISOString() }
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
      },

      exportResources: () => {
        return get().resources
      },

      // AHSP item actions
      addAHSPItem: (item) => {
        const id = item.id || generateId('ahsp')
        const newItem: AHSPItem = {
          ...item,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          basePrice: item.basePrice || 0,
          finalPrice: item.finalPrice || 0,
        }

        set((state) => ({
          ahspItems: [...state.ahspItems, newItem],
          componentsByAHSP: {
            ...state.componentsByAHSP,
            [newItem.id]: [],
          },
        }))

        // Fire-and-forget remote sync (ignore if supabase not configured)
        if (supabase) {
          batchUpsertAhsp([
            {
              id: newItem.id,
              code: newItem.code,
              name: newItem.name,
              description: newItem.description,
              unit: newItem.unit,
              category: newItem.category,
              base_price: newItem.basePrice,
              final_price: newItem.finalPrice,
              overhead_percentage: newItem.overheadPercentage,
              profit_percentage: newItem.profitPercentage,
              created_at: newItem.createdAt,
              updated_at: newItem.updatedAt,
            },
          ])
        }
        return id
      },

      updateAHSPItem: (id, updates) => {
        set((state) => ({
          ahspItems: state.ahspItems.map(item =>
            item.id === id
              ? { ...item, ...updates, updatedAt: new Date().toISOString() }
              : item
          ),
        }))

        if (supabase) {
          const state = get()
          const updated = state.ahspItems.find(i => i.id === id)
          if (updated) {
            batchUpsertAhsp([
              {
                id: updated.id,
                code: updated.code,
                name: updated.name,
                description: updated.description,
                unit: updated.unit,
                category: updated.category,
                base_price: updated.basePrice,
                final_price: updated.finalPrice,
                overhead_percentage: updated.overheadPercentage,
                profit_percentage: updated.profitPercentage,
                created_at: updated.createdAt,
                updated_at: updated.updatedAt,
              },
            ])
          }
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
        if (supabase) {
          deleteAhspItem(id).catch(err => console.warn('Failed to delete AHSP item from Supabase:', err))
        }
      },

      importAHSPItems: (items) => {
        const newItems: AHSPItem[] = items.map(item => ({
          ...item,
          id: generateId('ahsp'),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }))

        const componentsByAHSP: Record<string, AHSPComponent[]> = {}
        
        newItems.forEach(item => {
          componentsByAHSP[item.id] = []
        })

        set((state) => ({
          ahspItems: [...state.ahspItems, ...newItems],
          componentsByAHSP: { ...state.componentsByAHSP, ...componentsByAHSP },
        }))
      },

      exportAHSPItems: () => {
        return get().ahspItems
      },

      // Component actions
      addComponent: (ahspId, component) => {
        const state = get()
        const resource = state.resources.find(r => r.id === component.resourceId)
        
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
          ...component,
          id: generateId('comp'),
          ahspId,
          unit: resource.unit,
          unitPrice: resource.unitPrice,
          subtotal: component.coefficient * resource.unitPrice,
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

        if (supabase) {
          batchUpsertAhspComponents([{
            id: newComponent.id,
            ahsp_id: newComponent.ahspId,
            resource_id: newComponent.resourceId,
            type: newComponent.type,
            coefficient: newComponent.coefficient,
            unit: newComponent.unit,
            unit_price: newComponent.unitPrice,
            subtotal: newComponent.subtotal,
            created_at: newComponent.createdAt,
            updated_at: newComponent.updatedAt
          }])
        }

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
          const basePrice = components.reduce((sum, component) => sum + component.subtotal, 0)
          
          const ahspItem = state.ahspItems.find(item => item.id === ahspId)
          if (!ahspItem) return state

          const overhead = ahspItem.overheadPercentage || 0
          const profit = ahspItem.profitPercentage || 0
          
          let finalPrice = basePrice
          if (overhead > 0) {
            finalPrice *= (1 + overhead / 100)
          }
          if (profit > 0) {
            finalPrice *= (1 + profit / 100)
          }

          return {
            ahspItems: state.ahspItems.map(item =>
              item.id === ahspId
                ? { 
                    ...item, 
                    basePrice, 
                    finalPrice,
                    updatedAt: new Date().toISOString(),
                  }
                : item
            ),
          }
        })

        // Sync recalculated price
        if (supabase) {
          const item = get().ahspItems.find(i => i.id === ahspId)
          if (item) {
            batchUpsertAhsp([
              {
                id: item.id,
                code: item.code,
                name: item.name,
                description: item.description,
                unit: item.unit,
                category: item.category,
                base_price: item.basePrice,
                final_price: item.finalPrice,
                overhead_percentage: item.overheadPercentage,
                profit_percentage: item.profitPercentage,
                created_at: item.createdAt,
                updated_at: item.updatedAt,
              },
            ])
          }
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
    }),
    {
      name: 'ahsp-store',
    }
  )
)

/**
 * Get AHSP summary statistics
 */
export function getAHSPSummary(state: AHSPState) {
  const totalAHSPItems = state.ahspItems.length
  const totalResources = state.resources.length
  
  const averagePrice = totalAHSPItems > 0
    ? state.ahspItems.reduce((sum, item) => sum + item.finalPrice, 0) / totalAHSPItems
    : 0

  const priceByCategory: Record<string, { count: number; totalPrice: number }> = {}
  state.ahspItems.forEach(item => {
    if (!priceByCategory[item.category]) {
      priceByCategory[item.category] = { count: 0, totalPrice: 0 }
    }
    priceByCategory[item.category].count++
    priceByCategory[item.category].totalPrice += item.finalPrice
  })

  const resourcesByType: Record<ResourceType, { count: number; totalPrice: number }> = {
    material: { count: 0, totalPrice: 0 },
    labor: { count: 0, totalPrice: 0 },
    equipment: { count: 0, totalPrice: 0 },
    subcontractor: { count: 0, totalPrice: 0 },
  }

  state.resources.forEach(resource => {
    resourcesByType[resource.type].count++
    resourcesByType[resource.type].totalPrice += resource.unitPrice
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
