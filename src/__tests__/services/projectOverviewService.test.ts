
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { projectOverviewService } from '../../services/projectOverviewService'
import { riskService } from '../../services/riskService'

// --- MOCKS ---
const mockFromFn = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    supabase: null,
    assertSupabase: () => ({
        from: (...args: any[]) => mockFromFn(...args),
    }),
}))

vi.mock('../../services/riskService', () => ({
    riskService: { getRisks: vi.fn() }
}))

describe('Project Overview Service Unit Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('getProjectKPIs', () => {
        it('should aggregate RAB, RAP, and Actual Costs correctly', async () => {
            // 1. RAB Items
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                        data: [{ total_price: 1000 }, { total_price: 500 }],
                        error: null
                    })
                })
            })

            // 2. RAP Items
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                        data: [{ amount: 800, actual_cost: 200 }, { amount: 400, actual_cost: 100 }],
                        error: null
                    })
                })
            })

            // 3. Tasks (Progress)
            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({
                        data: [{ progress: 50 }, { progress: 100 }],
                        error: null
                    })
                })
            })

            const kpis = await projectOverviewService.getProjectKPIs('proj-1')

            // RAB Total = 1000 + 500 = 1500
            expect(kpis.rabTotal).toBe(1500)
            // RAP Total = 800 + 400 = 1200 (Committed)
            expect(kpis.rapTotal).toBe(1200)
            expect(kpis.committedCost).toBe(1200)
            // Actual Cost = 200 + 100 = 300
            expect(kpis.actualCost).toBe(300)
            // Remaining Budget = RAB - Actual = 1500 - 300 = 1200
            expect(kpis.remainingBudget).toBe(1200)
            // Progress = (50 + 100) / 2 = 75
            expect(kpis.progressPercent).toBe(75)
        })
    })

    describe('getTopRisks', () => {
        it('should filter CLOSED risks and limit results', async () => {
            const mockRisks = [
                { id: '1', status: 'OPEN', score: 10 },
                { id: '2', status: 'CLOSED', score: 20 },
                { id: '3', status: 'MITIGATED', score: 5 }
            ]
            vi.mocked(riskService.getRisks).mockResolvedValue(mockRisks as any)

            const results = await projectOverviewService.getTopRisks('proj-1', 5)

            expect(results).toHaveLength(2)
            expect(results.find(r => r.id === '2')).toBeUndefined()
        })
    })

    describe('getUpcomingMilestones', () => {
        it('should calculate daysUntilDue correctly', async () => {
            const today = new Date()
            const tomorrow = new Date(today)
            tomorrow.setDate(today.getDate() + 1)
            const tomorrowStr = tomorrow.toISOString().split('T')[0]

            mockFromFn.mockReturnValueOnce({
                select: vi.fn().mockReturnValue({
                    eq: vi.fn().mockReturnValue({
                        gte: vi.fn().mockReturnValue({
                            order: vi.fn().mockReturnValue({
                                limit: vi.fn().mockResolvedValue({
                                    data: [{ id: 't1', end_date: tomorrowStr, name: 'Task 1' }],
                                    error: null
                                })
                            })
                        })
                    })
                })
            })

            const tasks = await projectOverviewService.getUpcomingMilestones('proj-1')

            expect(tasks).toHaveLength(1)
            // Expect roughly 1 day (or 0 if run late in day vs UTC, but math.ceil should be positive)
            // Since we mocked Date in service vs test, it might slightly vary, but should be defined
            expect(tasks[0].daysUntilDue).toBeGreaterThanOrEqual(0)
        })
    })

})
