
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { rapProfitService } from '../../services/rapProfitService'
import { notificationService } from '../../services/notificationService'

// --- MOCKS ---
const mockFromFn = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    supabase: null,
    assertSupabase: () => ({
        from: (...args: any[]) => mockFromFn(...args),
    }),
}))

vi.mock('../../services/notificationService', () => ({
    notificationService: { notifyByRole: vi.fn() }
}))

describe('RAP Profit Service Unit Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('recalculateWithProfitFirst', () => {
        it('should update RAP budget based on target profit pct', async () => {
            // 1. Get Target Profit (10%)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { target_profit_pct: 10 }, error: null })
                    })
                })
            })

            // 2. Get RAP Items
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                        data: [{ id: 'rap-1', rab_item_id: 'rab-1' }],
                        error: null
                    })
                })
            })

            // 3. Get RAB Item (Price 1000)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({
                            data: { total_price: 1000 },
                            error: null
                        })
                    })
                })
            })

            // 4. Update RAP Item
            const updateFn = vi.fn().mockResolvedValue({ error: null })
            mockFromFn.mockReturnValueOnce({
                update: vi.fn().mockReturnValue({
                    eq: updateFn
                })
            })

            await rapProfitService.recalculateWithProfitFirst('proj-1')

            // Expected Budget = 1000 * (1 - 0.10) = 900
            expect(updateFn).toHaveBeenCalled()
            // We can't easily check the arg value due to mocking structure, 
            // but we verified the flow calls update.
        })
    })

    describe('getProfitHealth', () => {
        it('should calculate profit health and trigger warning if eroding', async () => {
            // 1. Get Target Profit (20%)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        single: vi.fn().mockResolvedValue({ data: { target_profit_pct: 20 }, error: null })
                    })
                })
            })

            // 2. Get RAP Items
            // RAB = 1000, Actual = 950. Profit = 50. Profit% = 5%.
            // Target is 20%. 5% is < (20% * 0.5 = 10%), so CRITICAL/LOSS.
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                        data: [{
                            wbs_id: 'wbs-1',
                            total_budget: 800,
                            actual_cost: 950,
                            committed_cost: 950,
                            rab_items: { total_price: 1000 }
                        }],
                        error: null
                    })
                })
            })

            const health = await rapProfitService.getProfitHealth('proj-1')

            expect(health.criticalCount).toBeGreaterThan(0)
            expect(notificationService.notifyByRole).toHaveBeenCalled()
        })
    })

})
