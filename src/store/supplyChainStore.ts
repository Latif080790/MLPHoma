
import { create } from 'zustand'
import { supplyChainService } from '../services/supplyChainService'
import { MaterialRequest, PurchaseOrder, InventoryTransaction, InventoryStock, PoItem, MrStatus, PoStatus } from '../types/supply-chain'
import { checkBudgetAvailability, type BudgetCheckResult, type CheckableItem } from '../services/budgetGuardService'
import { materialTransferService } from '../services/materialTransferService'
import type { MaterialTransferRequest } from '../types/material-transfer'

interface SupplyChainState {
    materialRequests: MaterialRequest[]
    purchaseOrders: PurchaseOrder[]
    inventoryTransactions: InventoryTransaction[]
    inventoryStock: InventoryStock[]

    activePoItems: PoItem[] // Items for the currently selected PO

    // Budget Guard
    budgetCheckResult: BudgetCheckResult | null
    budgetCheckLoading: boolean

    // Material Transfers
    materialTransfers: MaterialTransferRequest[]

    loading: {
        mr: boolean
        po: boolean
        inventory: boolean
        transfer: boolean
    }

    error: string | null

    // Actions
    fetchMaterialRequests: (projectId: string) => Promise<void>
    createMaterialRequest: (data: any) => Promise<void>
    updateMrStatus: (id: string, status: MrStatus) => Promise<void>

    fetchPurchaseOrders: (projectId: string) => Promise<void>
    createPurchaseOrder: (data: any, items: any[]) => Promise<void>
    fetchPoItems: (poId: string) => Promise<void>
    updatePoStatus: (id: string, status: PoStatus, approverId?: string) => Promise<void>

    fetchInventory: (projectId: string) => Promise<void>
    recordTransaction: (data: any) => Promise<void>

    // Budget Guard actions
    checkBudgetBeforePO: (projectId: string, items: CheckableItem[]) => Promise<BudgetCheckResult>
    clearBudgetCheck: () => void

    // MTR actions
    fetchTransfers: (projectId: string) => Promise<void>
    createMaterialTransfer: (input: any, requesterId: string, requesterName: string) => Promise<void>
    executeMaterialTransfer: (transferId: string) => Promise<void>
}

export const useSupplyChainStore = create<SupplyChainState>((set, get) => ({
    materialRequests: [],
    purchaseOrders: [],
    inventoryTransactions: [],
    inventoryStock: [],
    activePoItems: [],

    budgetCheckResult: null,
    budgetCheckLoading: false,
    materialTransfers: [],

    loading: {
        mr: false,
        po: false,
        inventory: false,
        transfer: false
    },

    error: null,

    fetchMaterialRequests: async (projectId: string) => {
        set(state => ({ loading: { ...state.loading, mr: true }, error: null }))
        try {
            const data = await supplyChainService.getMaterialRequests(projectId)
            set(state => ({
                materialRequests: data,
                loading: { ...state.loading, mr: false }
            }))
        } catch (err: any) {
            set(state => ({
                error: err.message,
                loading: { ...state.loading, mr: false }
            }))
        }
    },

    createMaterialRequest: async (data: any) => {
        set(state => ({ loading: { ...state.loading, mr: true }, error: null }))
        try {
            await supplyChainService.createMaterialRequest(data)
            // Refresh list if logical, or just add to state
            // For now, let's assume we refresh or user navigates
            const currentProjectId = data.project_id
            if (currentProjectId) {
                const newData = await supplyChainService.getMaterialRequests(currentProjectId)
                set(state => ({
                    materialRequests: newData,
                    loading: { ...state.loading, mr: false }
                }))
            } else {
                set(state => ({ loading: { ...state.loading, mr: false } }))
            }
        } catch (err: any) {
            set(state => ({
                error: err.message,
                loading: { ...state.loading, mr: false }
            }))
            throw err
        }
    },

    updateMrStatus: async (id: string, status: MrStatus) => {
        try {
            await supplyChainService.updateMrStatus(id, status)
            set(state => ({
                materialRequests: state.materialRequests.map(mr =>
                    mr.id === id ? { ...mr, status } : mr
                )
            }))
        } catch (err: any) {
            set({ error: err.message })
        }
    },

    fetchPurchaseOrders: async (projectId: string) => {
        set(state => ({ loading: { ...state.loading, po: true }, error: null }))
        try {
            const data = await supplyChainService.getPurchaseOrders(projectId)
            set(state => ({
                purchaseOrders: data,
                loading: { ...state.loading, po: false }
            }))
        } catch (err: any) {
            set(state => ({
                error: err.message,
                loading: { ...state.loading, po: false }
            }))
        }
    },

    createPurchaseOrder: async (data: any, items: any[]) => {
        set(state => ({ loading: { ...state.loading, po: true }, error: null }))
        try {
            await supplyChainService.createPurchaseOrder(data, items)
            if (data.project_id) {
                const newData = await supplyChainService.getPurchaseOrders(data.project_id)
                set(state => ({
                    purchaseOrders: newData,
                    loading: { ...state.loading, po: false }
                }))
            } else {
                set(state => ({ loading: { ...state.loading, po: false } }))
            }
        } catch (err: any) {
            set(state => ({
                error: err.message,
                loading: { ...state.loading, po: false }
            }))
            throw err
        }
    },

    fetchPoItems: async (poId: string) => {
        try {
            const items = await supplyChainService.getPoItems(poId)
            set({ activePoItems: items })
        } catch (err: any) {
            console.error(err)
            set({ error: err.message })
        }
    },

    updatePoStatus: async (id: string, status: PoStatus, approverId?: string) => {
        try {
            await supplyChainService.updatePoStatus(id, status, approverId)
            set(state => ({
                purchaseOrders: state.purchaseOrders.map(po =>
                    po.id === id ? { ...po, status, approvedBy: approverId, approvedAt: status === 'APPROVED' ? new Date().toISOString() : po.approvedAt } : po
                )
            }))
        } catch (err: any) {
            set({ error: err.message })
        }
    },

    fetchInventory: async (projectId: string) => {
        set(state => ({ loading: { ...state.loading, inventory: true }, error: null }))
        try {
            const txs = await supplyChainService.getInventoryTransactions(projectId)
            // We calculate stock client-side for now based on txs, or service calls
            // Ideally separate call, but let's re-use
            const stock = await supplyChainService.getInventoryStock(projectId) // This calls getTransactions again internally in service, optimization opportunity later

            set(state => ({
                inventoryTransactions: txs,
                inventoryStock: stock,
                loading: { ...state.loading, inventory: false }
            }))
        } catch (err: any) {
            set(state => ({
                error: err.message,
                loading: { ...state.loading, inventory: false }
            }))
        }
    },

    recordTransaction: async (data: any) => {
        set(state => ({ loading: { ...state.loading, inventory: true }, error: null }))
        try {
            await supplyChainService.recordTransaction(data)
            if (data.project_id) {
                // Refresh both
                const stock = await supplyChainService.getInventoryStock(data.project_id)
                const txs = await supplyChainService.getInventoryTransactions(data.project_id)
                set(state => ({
                    inventoryTransactions: txs,
                    inventoryStock: stock,
                    loading: { ...state.loading, inventory: false }
                }))
            } else {
                set(state => ({ loading: { ...state.loading, inventory: false } }))
            }
        } catch (err: any) {
            set(state => ({
                error: err.message,
                loading: { ...state.loading, inventory: false }
            }))
            throw err
        }
    },

    // --- Budget Guard ---
    checkBudgetBeforePO: async (projectId: string, items: CheckableItem[]) => {
        set({ budgetCheckLoading: true, budgetCheckResult: null })
        try {
            const result = await checkBudgetAvailability(projectId, items)
            set({ budgetCheckResult: result, budgetCheckLoading: false })
            return result
        } catch (err: any) {
            set({ budgetCheckLoading: false, error: err.message })
            throw err
        }
    },

    clearBudgetCheck: () => {
        set({ budgetCheckResult: null, budgetCheckLoading: false })
    },

    // --- Material Transfers ---
    fetchTransfers: async (projectId: string) => {
        set(state => ({ loading: { ...state.loading, transfer: true }, error: null }))
        try {
            const data = await materialTransferService.getTransfers(projectId)
            set(state => ({
                materialTransfers: data,
                loading: { ...state.loading, transfer: false }
            }))
        } catch (err: any) {
            set(state => ({
                error: err.message,
                loading: { ...state.loading, transfer: false }
            }))
        }
    },

    createMaterialTransfer: async (input: any, requesterId: string, requesterName: string) => {
        set(state => ({ loading: { ...state.loading, transfer: true }, error: null }))
        try {
            await materialTransferService.createTransfer(input, requesterId, requesterName)
            // Refresh list
            if (input.projectId) {
                const data = await materialTransferService.getTransfers(input.projectId)
                set(state => ({
                    materialTransfers: data,
                    loading: { ...state.loading, transfer: false }
                }))
            } else {
                set(state => ({ loading: { ...state.loading, transfer: false } }))
            }
        } catch (err: any) {
            set(state => ({
                error: err.message,
                loading: { ...state.loading, transfer: false }
            }))
            throw err
        }
    },

    executeMaterialTransfer: async (transferId: string) => {
        set(state => ({ loading: { ...state.loading, transfer: true }, error: null }))
        try {
            await materialTransferService.executeTransfer(transferId)
            // Update local state
            set(state => ({
                materialTransfers: state.materialTransfers.map(t =>
                    t.id === transferId ? { ...t, status: 'EXECUTED' as const } : t
                ),
                loading: { ...state.loading, transfer: false }
            }))
        } catch (err: any) {
            set(state => ({
                error: err.message,
                loading: { ...state.loading, transfer: false }
            }))
            throw err
        }
    }

}))
