import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supplyChainService } from '../services/supplyChainService'

const makeChain = (result: any) => {
    const c: any = {}
    c.select = vi.fn().mockReturnValue(c)
    c.in = vi.fn().mockReturnValue(c)
    c.eq = vi.fn().mockReturnValue(c)
    c.single = vi.fn().mockResolvedValue(result)
    c.maybeSingle = vi.fn().mockResolvedValue(result)
    c.insert = vi.fn().mockReturnValue(c)
    c.update = vi.fn().mockReturnValue(c)
    c.upsert = vi.fn().mockReturnValue(c)
    c.then = (res: any) => Promise.resolve(result).then(res)
    return c
}

// Mock Supabase Client
vi.mock('../lib/supabaseClient', () => {
    const mockFrom = vi.fn()
    const mockRpc = vi.fn().mockResolvedValue({ data: { success: true, remaining: 0 }, error: null })
    return {
        supabase: { from: mockFrom },
        assertSupabase: () => ({ from: mockFrom, rpc: mockRpc }),
        upsertPurchaseOrder: vi.fn(),
        upsertPoItem: vi.fn(),
        fetchPurchaseOrders: vi.fn(),
        fetchPoItems: vi.fn(),
        fetchInventoryTransactions: vi.fn(),
        upsertInventoryTransaction: vi.fn(),
        fetchMaterialRequests: vi.fn(),
        upsertMaterialRequest: vi.fn(),
        fetchRabItems: vi.fn(),
        fetchProjects: vi.fn(),
        generateId: (prefix?: string) => `${prefix || 'mock'}-id`
    }
})

import { assertSupabase, upsertPurchaseOrder, upsertPoItem } from '../lib/supabaseClient'
const mockFromFn = (assertSupabase() as any).from

// Mock Data
const MOCK_RAP_ITEMS = [
    {
        id: 'rap-1',
        qty_budget: 10,
        unit_price_budget: 1000,
        committed_cost: 0,
        actual_cost: 0,
        ahsp_items: { name: 'Cement' },
        rab_items: { name: 'Cement Work' }
    }
]

describe('Verification: RAP Budget Locking', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('should BLOCK PO creation if budget is exceeded', async () => {
        // Setup Mock: Return RAP Item with Budget = 10,000
        mockFromFn.mockReturnValue(makeChain({ data: MOCK_RAP_ITEMS, error: null }))

        // Attempt to buy 20 items at 1000 (Total 20,000 > Budget 10,000)
        const itemsToBuy = [
            {
                rap_item_id: 'rap-1',
                item_name: 'Cement',
                quantity: 20,
                unit_price: 1000
            }
        ]

        // Expect Error
        await expect(supplyChainService.createPurchaseOrder(
            { project_id: 'p1', po_number: 'PO-001', vendor_name: 'Vendor A', total_amount: 20000, status: 'DRAFT' },
            itemsToBuy
        )).rejects.toThrow(/Budget exceeded/i)
    })

    it('should ALLOW PO creation if within budget', async () => {
        // Setup Mock: Return RAP Item with Budget = 10,000
        mockFromFn.mockImplementation((table: string) => {
            if (table === 'rap_items') {
                return makeChain({ data: MOCK_RAP_ITEMS, error: null })
            }
            return makeChain({ data: [], error: null })
        })

        // Attempt to buy 5 items at 1000 (Total 5,000 < Budget 10,000)
        const itemsToBuy = [
            {
                rap_item_id: 'rap-1',
                item_name: 'Cement',
                quantity: 5,
                unit_price: 1000
            }
        ]

        // Mock successful upserts
        vi.mocked(upsertPurchaseOrder).mockResolvedValue({ data: { id: 'po-1' }, error: null } as any)
        vi.mocked(upsertPoItem).mockResolvedValue({ data: { id: 'item-1' }, error: null } as any)
        // We already mocked the module at top level, so we can just use the imported functions if we imported them
        // But since we didn't import them at top level for usage, let's just assume the service uses them.
        // Wait, the service imports them. Tests don't need to re-import if we mocked the path.
        // The issue was I tried to re-import. Let's just let the service run.

        // However, I need to make sure the service's internal calls to upsert return success.
        // I can't easily access the internal functions unless I imported them.
        // Let's use the `vi.mock` factory at the top to ensure they return success by default, 
        // or import them at the top of the file to control them.

        // Let's fix the call arguments
        const result = await supplyChainService.createPurchaseOrder(
            { project_id: 'p1', po_number: 'PO-002', vendor_name: 'Vendor A', total_amount: 5000, status: 'DRAFT' },
            itemsToBuy
        )

        expect(result).toBeDefined()
    })
})
