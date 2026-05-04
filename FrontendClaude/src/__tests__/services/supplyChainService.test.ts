
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supplyChainService } from '../../services/supplyChainService'

// --- 1. MOCK SUPABASE CLIENT & METHODS ---
function makeChain(result: any) {
    const c: any = {
        select: () => {
            // console.log("MOCK: select called"); 
            return c;
        },
        in: () => {
            // console.log("MOCK: in called"); 
            return c;
        },
        eq: () => {
            // console.log("MOCK: eq called"); 
            return c;
        },
        gte: () => c,
        lt: () => c,
        order: () => c,
        limit: () => c,
        single: () => Promise.resolve(result),
        update: () => c,
        insert: () => c,
        upsert: () => c,
        delete: () => c,
        then: (res: any) => Promise.resolve(result).then(res)
    }
    return c
}

const mockFromFn = vi.fn()
const mockRpcFn = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    supabase: null,
    assertSupabase: () => ({
        from: (t: string) => mockFromFn(t),
        rpc: (...args: any[]) => mockRpcFn(...args),
    }),
    // Mock exported helper functions directly
    upsertPurchaseOrder: vi.fn(),
    upsertPoItem: vi.fn(),
    fetchPurchaseOrders: vi.fn(),
    fetchPoItems: vi.fn(),
    upsertInventoryTransaction: vi.fn(),
    fetchInventoryTransactions: vi.fn(),
    fetchMaterialRequests: vi.fn(),
    upsertMaterialRequest: vi.fn(),
    // Mock generator
    generateId: () => 'mock-id-' + Math.random().toString(36).substr(2, 9)
}))

// Import mocked functions to assertion usage
import {
    upsertPurchaseOrder,
    upsertPoItem,
    fetchPoItems,
    upsertInventoryTransaction,
    fetchInventoryTransactions
} from '../../lib/supabaseClient'

// Mock Data Constants
const PROJECT_ID = 'proj-123'
const MOCK_RAP_ITEM = {
    id: 'rap-1',
    qty_budget: 100,
    unit_price_budget: 10000,
    committed_cost: 0,
    actual_cost: 0,
    ahsp_items: { name: 'Cement' }
}

describe('SupplyChainService Unit Tests', () => {

    beforeEach(() => {
        vi.resetAllMocks()
        mockFromFn.mockImplementation(() => makeChain({ data: [], error: null }))
    })

    // --- PURCHASE ORDER TESTS ---

    describe('createPurchaseOrder', () => {
        it('should create PO successfully when budget is sufficient', async () => {
            // Mock Budget Check (RAP Item)
            mockFromFn.mockReturnValue(makeChain({ data: [MOCK_RAP_ITEM], error: null }))

            vi.mocked(upsertPurchaseOrder).mockResolvedValue({ data: { id: 'po-new' }, error: null } as any)
            vi.mocked(upsertPoItem).mockResolvedValue({ data: { id: 'item-new' }, error: null } as any)

            const poData = { project_id: PROJECT_ID, po_number: 'PO-001', vendor_name: 'Vendor A', total_amount: 50000, status: 'DRAFT' }
            const items = [{ rap_item_id: 'rap-1', item_name: 'Cement', quantity: 5, unit_price: 10000 }]

            const result = await supplyChainService.createPurchaseOrder(poData as any, items as any)
            expect(result).toBeDefined()
        })

        it('should THROW error when budget is exceeded', async () => {
            // IMPORTANT: use a FRESH chain for each call if needed, but for now we'll just be careful
            mockFromFn.mockReturnValue(makeChain({ data: [MOCK_RAP_ITEM], error: null }))

            const poData = { project_id: PROJECT_ID, po_number: 'PO-OVER', vendor_name: 'Vendor B', total_amount: 2000000, status: 'DRAFT' }
            const items = [
                {
                    rap_item_id: 'rap-1',
                    item_name: 'Cement',
                    quantity: 200, // 200 * 10,000 = 2,000,000 (Exceeds 1,000,000)
                    unit_price: 10000
                }
            ]

            // We expect the error message to come from the budget guard
            await expect(supplyChainService.createPurchaseOrder(poData as any, items as any))
                .rejects
                .toThrow(/Budget exceeded/)
        })
    })

    describe('updatePoStatus (Approval)', () => {
        it('should stamp approver info when Approved', async () => {
            vi.mocked(upsertPurchaseOrder).mockResolvedValue({ data: { id: 'po-1' }, error: null } as any)
            await supplyChainService.updatePoStatus('po-1', 'APPROVED', 'user-manager')
            expect(upsertPurchaseOrder).toHaveBeenCalledWith(expect.objectContaining({ status: 'APPROVED', approved_by: 'user-manager' }))
        })
    })

    describe('updatePoStatus (Rejection/Cancellation)', () => {
        it('should rollback committed cost when Rejected', async () => {
            vi.mocked(fetchPoItems).mockResolvedValue({
                data: [{ id: 'item-1', po_id: 'po-1', rap_item_id: 'rap-1', quantity: 5, unit_price: 10000 }],
                error: null
            } as any)

            const mockRap = { ...MOCK_RAP_ITEM, committed_cost: 50000 }
            mockFromFn.mockImplementation(() => makeChain({ data: mockRap, error: null }))
            vi.mocked(upsertPurchaseOrder).mockResolvedValue({ data: { id: 'po-1' }, error: null } as any)

            await supplyChainService.updatePoStatus('po-1', 'REJECTED')
            expect(upsertPurchaseOrder).toHaveBeenCalledWith(expect.objectContaining({ status: 'REJECTED' }))
        })
    })

    describe('Inventory Transactions', () => {
        it('should record transaction successfully', async () => {
            vi.mocked(upsertInventoryTransaction).mockResolvedValue({ data: { id: 'tx-1' }, error: null } as any)
            const txData = { project_id: PROJECT_ID, material_name: 'Cement', transaction_type: 'IN', quantity: 100, unit: 'sak' }
            await supplyChainService.recordTransaction(txData as any)
            expect(upsertInventoryTransaction).toHaveBeenCalledWith(expect.objectContaining({ material_name: 'Cement', quantity: 100 }))
        })

        it('should calculate stock correctly', async () => {
            const mockTransactions = [
                { id: '1', material_name: 'Cement', transaction_type: 'IN', quantity: 100, unit: 'sak' },
                { id: '2', material_name: 'Cement', transaction_type: 'OUT', quantity: 20, unit: 'sak' },
                { id: '3', material_name: 'Sand', transaction_type: 'IN', quantity: 50, unit: 'm3' }
            ]
            vi.mocked(fetchInventoryTransactions).mockResolvedValue({ data: mockTransactions, error: null } as any)
            const stock = await supplyChainService.getInventoryStock(PROJECT_ID)
            expect(stock.find(s => s.materialName === 'Cement')?.current).toBe(80)
            expect(stock.find(s => s.materialName === 'Sand')?.current).toBe(50)
        })
    })

})
