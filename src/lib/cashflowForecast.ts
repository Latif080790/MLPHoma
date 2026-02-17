/**
 * cashflowForecast.ts
 * Calculates rolling cashflow forecasts for project financial planning.
 * Provides 4-week and 8-week projections based on historical data.
 */

/**
 * Cashflow data point
 */
export interface CashflowDataPoint {
    week: string // e.g., "Week 1", "2024-W12"
    date: string // ISO date string
    inflow: number // Accounts Receivable (AR) / Client payments
    outflow: number // Accounts Payable (AP) / Vendor payments
    net: number // inflow - outflow
}

/**
 * Cashflow forecast result
 */
export interface CashflowForecast {
    weeks: CashflowDataPoint[]
    summary: {
        totalInflow: number
        totalOutflow: number
        netCashflow: number
        runwayDays: number // Days until cash runs out (if negative)
        burnRate: number // Average weekly burn rate
        healthStatus: 'HEALTHY' | 'WARNING' | 'CRITICAL'
    }
    projectedBalance: number
    currentBalance: number
}

/**
 * Historical transaction for analysis
 */
export interface HistoricalTransaction {
    date: string
    amount: number
    type: 'AR' | 'AP' // Accounts Receivable or Accounts Payable
    category?: string
}

// ---------- Constants ----------

const RUNWAY_WARNING_DAYS = 30 // < 30 days runway = warning
const RUNWAY_CRITICAL_DAYS = 14 // < 14 days runway = critical

// ---------- Helpers ----------

/**
 * Weeks between two dates
 */
function getWeeksDiff(date1: Date, date2: Date): number {
    const diff = date2.getTime() - date1.getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24 * 7))
}

/**
 * Get week label for a date
 */
function getWeekLabel(date: Date, format: 'short' | 'iso' = 'short'): string {
    if (format === 'iso') {
        const year = date.getFullYear()
        const week = getWeekNumber(date)
        return `${year}-W${String(week).padStart(2, '0')}`
    }
    const weekNum = getWeekNumber(date)
    return `Week ${weekNum}`
}

/**
 * Get ISO week number
 */
function getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
    const dayNum = d.getUTCDay() || 7
    d.setUTCDate(d.getUTCDate() + 4 - dayNum)
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
    return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

/**
 * Add weeks to a date
 */
function addWeeks(date: Date, weeks: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + (weeks * 7))
    return result
}

/**
 * Get start of week (Monday)
 */
function getWeekStart(date: Date): Date {
    const result = new Date(date)
    const day = result.getDay()
    const diff = result.getDate() - day + (day === 0 ? -6 : 1) // Adjust to Monday
    result.setDate(diff)
    result.setHours(0, 0, 0, 0)
    return result
}

/**
 * Group transactions by week
 */
function groupByWeek(transactions: HistoricalTransaction[]): Map<string, { ar: number; ap: number }> {
    const weekMap = new Map<string, { ar: number; ap: number }>()
    
    transactions.forEach(tx => {
        const txDate = new Date(tx.date)
        const weekStart = getWeekStart(txDate)
        const weekKey = weekStart.toISOString()
        
        if (!weekMap.has(weekKey)) {
            weekMap.set(weekKey, { ar: 0, ap: 0 })
        }
        
        const week = weekMap.get(weekKey)!
        if (tx.type === 'AR') {
            week.ar += tx.amount
        } else {
            week.ap += tx.amount
        }
    })
    
    return weekMap
}

/**
 * Calculate average weekly AR/AP from historical data
 */
function calculateAverages(transactions: HistoricalTransaction[], weeks: number = 4): { avgAR: number; avgAP: number } {
    const now = new Date()
    const cutoffDate = addWeeks(now, -weeks)
    
    const recentTransactions = transactions.filter(tx => new Date(tx.date) >= cutoffDate)
    
    const totalAR = recentTransactions.filter(tx => tx.type === 'AR').reduce((sum, tx) => sum + tx.amount, 0)
    const totalAP = recentTransactions.filter(tx => tx.type === 'AP').reduce((sum, tx) => sum + tx.amount, 0)
    
    return {
        avgAR: totalAR / weeks,
        avgAP: totalAP / weeks,
    }
}

// ---------- Main Functions ----------

/**
 * Calculate rolling cashflow forecast
 */
export function calculateCashflowForecast(
    currentBalance: number,
    historicalTransactions: HistoricalTransaction[],
    forecastWeeks: 4 | 8 = 4,
    includeScheduledPayments: boolean = true,
): CashflowForecast {
    const now = new Date()
    const weekStart = getWeekStart(now)
    
    // Calculate historical averages (use last 4 weeks of data)
    const { avgAR, avgAP } = calculateAverages(historicalTransactions, 4)
    
    // Build forecast weeks
    const weeks: CashflowDataPoint[] = []
    let runningBalance = currentBalance
    
    for (let i = 0; i < forecastWeeks; i++) {
        const forecastDate = addWeeks(weekStart, i)
        const weekLabel = `Week ${i + 1}`
        
        // For first week, use more precise data if available
        // For future weeks, use historical averages
        let inflow = avgAR
        let outflow = avgAP
        
        if (i === 0) {
            // Current week - could include more precise scheduled payments
            // For now, use averages
        }
        
        const net = inflow - outflow
        runningBalance += net
        
        weeks.push({
            week: weekLabel,
            date: forecastDate.toISOString(),
            inflow,
            outflow,
            net,
        })
    }
    
    // Calculate summary metrics
    const totalInflow = weeks.reduce((sum, w) => sum + w.inflow, 0)
    const totalOutflow = weeks.reduce((sum, w) => sum + w.outflow, 0)
    const netCashflow = totalInflow - totalOutflow
    const burnRate = totalOutflow / forecastWeeks
    
    // Calculate runway (days until cash runs out)
    let runwayDays = Infinity
    if (netCashflow < 0) {
        // Cash is decreasing
        if (burnRate > 0) {
            const weeksUntilZero = Math.abs(currentBalance / (netCashflow / forecastWeeks))
            runwayDays = Math.floor(weeksUntilZero * 7)
        }
    }
    
    // Determine health status
    let healthStatus: CashflowForecast['summary']['healthStatus'] = 'HEALTHY'
    if (runwayDays < RUNWAY_CRITICAL_DAYS || netCashflow < -currentBalance * 0.5) {
        healthStatus = 'CRITICAL'
    } else if (runwayDays < RUNWAY_WARNING_DAYS || netCashflow < 0) {
        healthStatus = 'WARNING'
    }
    
    return {
        weeks,
        summary: {
            totalInflow,
            totalOutflow,
            netCashflow,
            runwayDays: runwayDays === Infinity ? -1 : runwayDays,
            burnRate,
            healthStatus,
        },
        projectedBalance: runningBalance,
        currentBalance,
    }
}

/**
 * Generate mock historical transactions for testing
 */
export function generateMockTransactions(weeks: number = 8): HistoricalTransaction[] {
    const transactions: HistoricalTransaction[] = []
    const now = new Date()
    
    // Generate random transactions for the past N weeks
    for (let w = 0; w < weeks; w++) {
        const weekDate = addWeeks(now, -w)
        
        // Generate 2-5 AR transactions per week
        const arCount = Math.floor(Math.random() * 4) + 2
        for (let i = 0; i < arCount; i++) {
            const dayOffset = Math.floor(Math.random() * 7)
            const txDate = new Date(weekDate)
            txDate.setDate(txDate.getDate() + dayOffset)
            
            transactions.push({
                date: txDate.toISOString(),
                amount: Math.floor(Math.random() * 50000000) + 10000000, // 10M - 60M
                type: 'AR',
                category: 'CLIENT_PAYMENT',
            })
        }
        
        // Generate 3-7 AP transactions per week
        const apCount = Math.floor(Math.random() * 5) + 3
        for (let i = 0; i < apCount; i++) {
            const dayOffset = Math.floor(Math.random() * 7)
            const txDate = new Date(weekDate)
            txDate.setDate(txDate.getDate() + dayOffset)
            
            transactions.push({
                date: txDate.toISOString(),
                amount: Math.floor(Math.random() * 40000000) + 5000000, // 5M - 45M
                type: 'AP',
                category: ['VENDOR_PAYMENT', 'EQUIPMENT_RENTAL', 'MATERIAL_PURCHASE'][Math.floor(Math.random() * 3)],
            })
        }
    }
    
    return transactions
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
    if (amount >= 1000000000) {
        return `Rp ${(amount / 1000000000).toFixed(1)}B`
    }
    if (amount >= 1000000) {
        return `Rp ${(amount / 1000000).toFixed(1)}M`
    }
    if (amount >= 1000) {
        return `Rp ${(amount / 1000).toFixed(0)}K`
    }
    return `Rp ${amount.toLocaleString()}`
}
