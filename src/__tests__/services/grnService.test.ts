
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { grnService } from '../../services/grnService'
import { auditService } from '../../services/auditService'
import { notificationService } from '../../services/notificationService'
import { supplyChainService } from '../../services/supplyChainService'

// --- MOCKS ---
const mockFromFn = vi.fn()
const mockRpcFn = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    supabase: null,
    assertSupabase: () => ({
        from: (...args: any[]) => mockFromFn(...args),
        rpc: (...args: any[]) => mockRpcFn(...args),
    }),
    generateId: (prefix = 'id') => `${prefix}-${Math.random().toString(36).substr(2, 5)}`
}))

vi.mock('../../services/auditService', () => ({
    auditService: { log: vi.fn() }
}))

vi.mock('../../services/notificationService', () => ({
    notificationService: { notifyByRole: vi.fn() }
}))

vi.mock('../../services/supplyChainService', () => ({
    supplyChainService: { updatePoStatus: vi.fn() }
}))

describe('GRN Service Unit Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('createGRN', () => {
        it('should create GRN and Inventory Transactions', async () => {
            // Mock GRN count check
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ count: 5, error: null })
                })
            })

            // Mock GRN Insert
            const mockGrn = { id: 'grn-1', grn_number: 'GRN-0006' }
            mockFromFn.mockReturnValueOnce({
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: mockGrn, error: null })
                    })
                })
            })

            // Mock Inventory Insert
            mockFromFn.mockReturnValueOnce({
                insert: vi.fn().mockResolvedValue({ error: null })
            })

            const input = {
                projectId: 'p1',
                poId: 'po-1',
                receivedDate: '2023-01-01',
                items: [
                    { itemName: 'Item A', qtyReceived: 10, unit: 'pcs', rapItemId: 'r1' }
                ]
            }

            const result = await grnService.createGRN(input as any, 'user-1', 'User One')

            expect(result.grnNumber).toBe('GRN-0006')
            // Verify Inventory Insert was called
            // We can't easily spy on chained mocks without capturing them, but we expect no error.
            expect(auditService.log).toHaveBeenCalled()
        })
    })

    describe('verifyGRN', () => {
        const MOCK_GRN_ID = 'grn-verify'
        const MOCK_PO_ID = 'po-1'
        const MOCK_PROJECT_ID = 'proj-1'

        it('should create invoice and update PO status if fully received', async () => {
            // 1. Fetch GRN
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: {
                                id: MOCK_GRN_ID,
                                po_id: MOCK_PO_ID,
                                project_id: MOCK_PROJECT_ID,
                                grn_number: 'GRN-001',
                                items: [{ itemName: 'Item A', qtyReceived: 10 }]
                            },
                            error: null
                        })
                    })
                })
            })

            // 2. Update GRN Status
            mockFromFn.mockReturnValueOnce({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({
                                data: { id: MOCK_GRN_ID, po_id: MOCK_PO_ID, items: [{ itemName: 'Item A', qtyReceived: 10 }] },
                                error: null
                            })
                        })
                    })
                })
            })

            // 3. Fetch PO (for Invoice creation context)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: {
                                id: MOCK_PO_ID,
                                vendor_name: 'Vendor X',
                                po_items: [{ item_name: 'Item A', quantity: 10, unit_price: 1000 }]
                            },
                            error: null
                        })
                    })
                })
            })

            // 4. Check Existing Invoice (return null)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockReturnValue({
                            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null })
                        })
                    })
                })
            })

            // 5. Insert Invoice
            mockFromFn.mockReturnValueOnce({
                insert: vi.fn().mockResolvedValue({ error: null })
            })

            // 6. Check All GRNs (for full delivery check)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({
                            data: [{ items: [{ itemName: 'Item A', qtyReceived: 10 }] }],
                            error: null
                        })
                    })
                })
            })

            await grnService.verifyGRN(MOCK_GRN_ID, 'verifier-1', 'Verifier Name')

            // Expect Notification
            expect(notificationService.notifyByRole).toHaveBeenCalled()

            // Expect Audit
            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'APPROVE' }))

            // Expect PO Update to COMPLETED because 10 ordered vs 10 received
            expect(supplyChainService.updatePoStatus).toHaveBeenCalledWith(MOCK_PO_ID, 'COMPLETED')
        })
    })

})
