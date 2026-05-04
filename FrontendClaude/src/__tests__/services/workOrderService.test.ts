
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { workOrderService } from '../../services/workOrderService'
import { auditService } from '../../services/auditService'

// --- MOCKS ---
const mockFromFn = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    supabase: null,
    assertSupabase: () => ({
        from: (...args: any[]) => mockFromFn(...args),
        // select/insert/update/delete chaining handled in tests
    }),
    generateId: (prefix = 'id') => `${prefix}-${Math.random().toString(36).substr(2, 5)}`
}))

vi.mock('../../services/auditService', () => ({
    auditService: { log: vi.fn() }
}))

describe('WorkOrder Service Unit Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('createWorkOrder', () => {
        it('should create SPK successfully with correct number format', async () => {
            // Mock Count
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ count: 9, error: null })
                })
            })

            // Mock Insert
            mockFromFn.mockReturnValueOnce({
                insert: vi.fn().mockReturnValue({
                    select: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { id: 'spk-1', spk_number: 'SPK-0010', status: 'DRAFT' },
                            error: null
                        })
                    })
                })
            })

            const input = {
                projectId: 'p1',
                mandorName: 'Mandor A',
                scopeDescription: 'Build Wall',
                unit: 'm2',
                unitPrice: 50000,
                maxVolume: 100
            }

            const result = await workOrderService.createWorkOrder(input as any)

            expect(result.spkNumber).toBe('SPK-0010') // 9 + 1 = 10 -> 0010
            expect(auditService.log).toHaveBeenCalled()
        })
    })

    describe('recordOpname', () => {
        const MOCK_SPK = {
            id: 'spk-1',
            max_volume: 100,
            actual_volume: 50,
            unit: 'm2'
        }

        it('should record opname if within limit', async () => {
            // Fetch Current
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: MOCK_SPK, error: null })
                    })
                })
            })

            // Update
            mockFromFn.mockReturnValueOnce({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: { ...MOCK_SPK, actual_volume: 80 }, error: null })
                        })
                    })
                })
            })

            // Add 30 (50 + 30 = 80 <= 100) OK
            await workOrderService.recordOpname({ workOrderId: 'spk-1', volume: 30, notes: 'Progress' } as any)

            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'UPDATE' }))
        })

        it('should THROW error if opname exceeds max volume', async () => {
            // Fetch Current
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: MOCK_SPK, error: null })
                    })
                })
            })

            // Add 60 (50 + 60 = 110 > 100) Fail
            await expect(workOrderService.recordOpname({ workOrderId: 'spk-1', volume: 60 } as any))
                .rejects
                .toThrow(/melebihi plafon SPK/)

            expect(auditService.log).not.toHaveBeenCalled()
        })
    })

    describe('recordPayment', () => {
        const MOCK_SPK_PAY = {
            id: 'spk-1',
            unit_price: 10000,
            actual_volume: 50, // Value = 500,000
            paid_amount: 400000, // Remaining = 100,000
            mandor_name: 'Mandor A'
        }

        it('should record payment if within payable limit', async () => {
            // Fetch Current
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: MOCK_SPK_PAY, error: null })
                    })
                })
            })

            // Update
            mockFromFn.mockReturnValueOnce({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        select: vi.fn().mockReturnValue({
                            single: vi.fn().mockResolvedValue({ data: { ...MOCK_SPK_PAY, paid_amount: 450000 }, error: null })
                        })
                    })
                })
            })

            // Pay 50,000 (400k + 50k = 450k <= 500k) OK
            await workOrderService.recordPayment('spk-1', 50000)

            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'PAYMENT' }))
        })

        it('should THROW error if payment exceeds payable amount', async () => {
            // Fetch Current
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: MOCK_SPK_PAY, error: null })
                    })
                })
            })

            // Pay 150,000 (400k + 150k = 550k > 500k) Fail
            await expect(workOrderService.recordPayment('spk-1', 150000))
                .rejects
                .toThrow(/melebihi nilai opname/)
        })
    })

})
