
import { dashboardService } from './dashboardService'

export interface SimulationScenario {
    projectId: string
    shiftDays: number        // Positive = delay, Negative = accelerate
    resourceChange: number   // -1.0 to +1.0 (e.g., -0.2 = remove 20% labor)
}

export interface SimulationResult {
    originalAvgSpi: number
    simulatedAvgSpi: number
    originalCashflow: number
    simulatedCashflow: number
    impactSeverity: 'NONE' | 'LOW' | 'HIGH'
    recommendation: string
}

export const simulationService = {
    /**
     * Simulate the impact of specific shifts on the portfolio
     */
    async simulatePortfolioImpact(scenarios: SimulationScenario[]): Promise<SimulationResult> {
        const portfolio = await dashboardService.getPortfolioStats()

        let simulatedSpiSum = 0

        // Naive heuristic simulation logic
        scenarios.forEach(scenario => {
            // Shifting days usually decreases SPI if it's a delay
            const spiImpact = scenario.shiftDays > 0 ? (scenario.shiftDays / 30) * 0.05 : 0
            // Resource reduction directly impacts SPI
            const resourceImpact = scenario.resourceChange < 0 ? Math.abs(scenario.resourceChange) * 0.15 : 0

            const originalSpi = 0.95 // Abstracted for demo
            const newSpi = Math.max(0.1, originalSpi - spiImpact - resourceImpact)
            simulatedSpiSum += newSpi
        })

        const avgSimSpi = simulatedSpiSum / (scenarios.length || 1)
        const delta = portfolio.avgSpi - avgSimSpi

        return {
            originalAvgSpi: portfolio.avgSpi,
            simulatedAvgSpi: avgSimSpi,
            originalCashflow: portfolio.totalBudget * 0.2, // mock
            simulatedCashflow: (portfolio.totalBudget * 0.2) * (1 - delta),
            impactSeverity: delta > 0.1 ? 'HIGH' : delta > 0.03 ? 'LOW' : 'NONE',
            recommendation: delta > 0.05
                ? 'Strategy Warning: Proposed reallocations cause significant schedule drag. Consider overtime for projects A & B.'
                : 'Strategy Stable: Changes are within acceptable variance thresholds.'
        }
    }
}
