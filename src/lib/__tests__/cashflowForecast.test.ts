import { describe, expect, it } from 'vitest'
import {
  buildHistoricalTransactionsFromFinance,
  buildScheduledTransactionsFromFinance,
  calculateCashflowForecast,
} from '../cashflowForecast'

describe('cashflowForecast', () => {
  it('builds historical transactions from finance inputs', () => {
    const historical = buildHistoricalTransactionsFromFinance({
      invoices: [],
      claims: [
        { created_at: '2026-02-01T00:00:00.000Z', amount: 20000000, status: 'APPROVED' },
      ],
      transactions: [
        { transaction_date: '2026-02-02T00:00:00.000Z', amount: -5000000 },
        { transaction_date: '2026-02-03T00:00:00.000Z', amount: 7000000 },
      ],
    })

    expect(historical.length).toBe(3)
    expect(historical.filter((t) => t.type === 'AR').length).toBe(2)
    expect(historical.filter((t) => t.type === 'AP').length).toBe(1)
  })

  it('includes only relevant scheduled items in forecast window', () => {
    const now = new Date()
    const in2Weeks = new Date(now)
    in2Weeks.setDate(in2Weeks.getDate() + 14)
    const in10Weeks = new Date(now)
    in10Weeks.setDate(in10Weeks.getDate() + 70)

    const scheduled = buildScheduledTransactionsFromFinance(
      {
        invoices: [
          { due_date: in2Weeks.toISOString(), total_amount: 10000000, status: 'UNPAID' },
          { due_date: in10Weeks.toISOString(), total_amount: 11000000, status: 'UNPAID' },
        ],
        claims: [
          { created_at: in2Weeks.toISOString(), amount: 12000000, status: 'APPROVED' },
          { created_at: in10Weeks.toISOString(), amount: 13000000, status: 'APPROVED' },
        ],
        transactions: [],
      },
      4,
    )

    expect(scheduled.length).toBe(2)
    expect(scheduled.some((s) => s.type === 'AP')).toBe(true)
    expect(scheduled.some((s) => s.type === 'AR')).toBe(true)
  })

  it('calculates deterministic forecast with scheduled payments', () => {
    const forecast = calculateCashflowForecast(
      100000000,
      [
        { date: '2026-02-01T00:00:00.000Z', amount: 20000000, type: 'AR' },
        { date: '2026-02-02T00:00:00.000Z', amount: 10000000, type: 'AP' },
      ],
      4,
      true,
      [{ date: new Date().toISOString(), amount: 5000000, type: 'AP' }],
    )

    expect(forecast.weeks).toHaveLength(4)
    expect(forecast.summary.totalInflow).toBeGreaterThan(0)
    expect(forecast.summary.totalOutflow).toBeGreaterThan(0)
    expect(typeof forecast.projectedBalance).toBe('number')
  })
})
