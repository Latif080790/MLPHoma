
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { projectOverviewService } from '../../services/projectOverviewService'
import { riskService } from '../../services/riskService'

// --- MOCKS ---
function makeChain(result: any) {
    const c: any = {}
    c.select = () => c
    c.eq = () => c
    c.gte = () => c
    c.lt = () => c
    c.order = () => c
    c.limit = () => Promise.resolve(result)
    c.then = (res: any) => Promise.resolve(result).then(res)
    return c
}

const mockFromFn = vi.fn().mockImplementation(() => makeChain({ data: [], error: null }))

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
        mockFromFn.mockImplementation(() => makeChain({ data: [], error: null }))
    })

    describe('getProjectKPIs', () => {
        it('should aggregate RAB, RAP, and Actual Costs correctly', async () => {
            // 1. RAB Items
            mockFromFn.mockReturnValueOnce(makeChain({
                data: [{ final_total: 1000 }, { final_total: 500 }],
                error: null
            }))

            // 2. RAP Items
            mockFromFn.mockReturnValueOnce(makeChain({
                data: [{ total_budget: 800, actual_cost: 200, committed_cost: 0 }, { total_budget: 400, actual_cost: 100, committed_cost: 0 }],
                error: null
            }))

            // 3. Tasks (Progress)
            mockFromFn.mockReturnValueOnce(makeChain({
                data: [{ progress: 50 }, { progress: 100 }],
                error: null
            }))

            const kpis = await projectOverviewService.getProjectKPIs('proj-1')

            // RAB Total = 1000 + 500 = 1500
            expect(kpis.rabTotal).toBe(1500)
            // RAP Total = 800 + 400 = 1200
            expect(kpis.rapTotal).toBe(1200)
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

            mockFromFn.mockReturnValueOnce(makeChain({
                data: [{ id: 't1', end_date: tomorrowStr, name: 'Task 1' }],
                error: null
            }))

            const tasks = await projectOverviewService.getUpcomingMilestones('proj-1')

            expect(tasks).toHaveLength(1)
            expect(tasks[0].daysUntilDue).toBeGreaterThanOrEqual(0)
        })
    })

})
