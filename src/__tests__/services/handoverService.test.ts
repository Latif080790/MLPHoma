
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { handoverService } from '../../services/handoverService'
import { supplyChainService } from '../../services/supplyChainService'

// --- MOCKS ---
const mockFromFn = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    supabase: null,
    assertSupabase: () => ({
        from: (...args: any[]) => mockFromFn(...args),
        // chaining handled in tests
    }),
}))

vi.mock('../../services/supplyChainService', () => ({
    supplyChainService: { getInventoryStock: vi.fn() }
}))

describe('Handover Service Unit Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getHandoverSummary', () => {
        it('should aggregate budget and schedule correctly', async () => {
            // 1. RAP Items (Budget)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                        data: [{ total_price: 5000 }, { total_price: 2000 }],
                        error: null
                    })
                })
            })

            // 2. WBS Items (Schedule)
            // Weight 50, Progress 100 -> Contribution 5000
            // Weight 50, Progress 50 -> Contribution 2500
            // Total 7500 / 100 = 75%
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                        data: [
                            { weight: 50, progress: 100, start_date: '2023-01-01', end_date: '2023-02-01' },
                            { weight: 50, progress: 50, start_date: '2023-02-01', end_date: '2023-03-01' }
                        ],
                        error: null
                    })
                })
            })

            // 3. Risks (Safety)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        eq: vi.fn().mockResolvedValue({
                            data: [{ severity: 'HIGH', risk_score: 20 }, { severity: 'LOW', risk_score: 5 }],
                            error: null
                        })
                    })
                })
            })

            // 4. Inventory (Mocked Service)
            vi.mocked(supplyChainService.getInventoryStock).mockResolvedValue([
                { materialName: 'Cement', unit: 'sak', current: 100, value: 0 } as any
            ])

            const summary = await handoverService.getHandoverSummary('proj-1')

            expect(summary.budget.planned).toBe(7000)
            expect(summary.schedule.progress).toBe(75)
            expect(summary.safety.total).toBe(2)
            expect(summary.safety.highSeverity).toBe(1)
            expect(summary.inventory).toHaveLength(1)
        })
    })

    describe('getOutstandingIssues', () => {
        it('should fetch and map issues correctly', async () => {
            // 1. Risks
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            eq: vi.fn().mockResolvedValue({
                                data: [{ id: 'r1', description: 'Risk A', status: 'OPEN', risk_score: 25 }],
                                error: null
                            })
                        })
                    })
                })
            })

            // 2. WBS (Incomplete)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        lt: vi.fn().mockResolvedValue({
                            data: [{ id: 'w1', name: 'Task B', status: 'IN_PROGRESS', progress: 50 }],
                            error: null
                        })
                    })
                })
            })

            // 3. PO (Open)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        not: vi.fn().mockResolvedValue({
                            data: [{ id: 'p1', po_number: 'PO-1', status: 'ordered' }],
                            error: null
                        })
                    })
                })
            })

            const issues = await handoverService.getOutstandingIssues('proj-1')

            expect(issues).toHaveLength(3)
            expect(issues.find(i => i.type === 'RISK')).toBeDefined()
            expect(issues.find(i => i.type === 'WBS')).toBeDefined()
            expect(issues.find(i => i.type === 'PO')).toBeDefined()
            expect(issues[0].priority).toBe('CRITICAL') // Score 25 >= 20
        })
    })

})
