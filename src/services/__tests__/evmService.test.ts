/**
 * evmService.test.ts
 * Tests for computeEVM, computeForecasts, classifyHealth — all pure functions.
 */

import { describe, it, expect } from 'vitest'
import { computeEVM, computeForecasts, classifyHealth } from '../evmService'

// ─── computeEVM ───────────────────────────────────────────────────────────────

describe('computeEVM', () => {
  it('computes basic EVM metrics correctly', () => {
    const r = computeEVM({ totalBudget: 1_000_000, actualCost: 400_000, progressPercent: 50, plannedProgressPercent: 50 })
    expect(r.earnedValue).toBe(500_000)
    expect(r.plannedValue).toBe(500_000)
    expect(r.actualCost).toBe(400_000)
    expect(r.spi).toBe(1)
    expect(r.cpi).toBeCloseTo(1.25, 2)
    expect(r.sv).toBe(0)          // EV - PV
    expect(r.cv).toBe(100_000)    // EV - AC
    expect(r.acDataAvailable).toBe(true)
  })

  it('acDataAvailable=false when AC=0 and progress>0 (misleading CPI guard)', () => {
    const r = computeEVM({ totalBudget: 1_000_000, actualCost: 0, progressPercent: 20, plannedProgressPercent: 20 })
    expect(r.acDataAvailable).toBe(false)
    expect(r.cpi).toBe(1)  // defaults to 1 when ac=0
  })

  it('acDataAvailable=true when AC=0 and progress=0 (no work started)', () => {
    const r = computeEVM({ totalBudget: 1_000_000, actualCost: 0, progressPercent: 0, plannedProgressPercent: 0 })
    expect(r.acDataAvailable).toBe(true)
  })

  it('acDataAvailable=true when AC > 0', () => {
    const r = computeEVM({ totalBudget: 1_000_000, actualCost: 100, progressPercent: 10, plannedProgressPercent: 10 })
    expect(r.acDataAvailable).toBe(true)
  })

  it('SPI defaults to 1 when PV=0 (no planned work)', () => {
    const r = computeEVM({ totalBudget: 1_000_000, actualCost: 50_000, progressPercent: 10, plannedProgressPercent: 0 })
    expect(r.spi).toBe(1)
  })

  it('detects cost overrun: CPI < 1', () => {
    const r = computeEVM({ totalBudget: 1_000_000, actualCost: 600_000, progressPercent: 50, plannedProgressPercent: 50 })
    expect(r.cpi).toBeLessThan(1)
    expect(r.cv).toBeLessThan(0)  // negative cost variance = overrun
    expect(r.eac).toBeGreaterThan(1_000_000)
  })

  it('detects schedule delay: SPI < 1', () => {
    const r = computeEVM({ totalBudget: 1_000_000, actualCost: 300_000, progressPercent: 20, plannedProgressPercent: 40 })
    expect(r.spi).toBeLessThan(1)
    expect(r.sv).toBeLessThan(0)  // negative schedule variance = behind
  })

  it('handles zero budget gracefully', () => {
    const r = computeEVM({ totalBudget: 0, actualCost: 0, progressPercent: 0, plannedProgressPercent: 0 })
    expect(r.earnedValue).toBe(0)
    expect(r.plannedValue).toBe(0)
    expect(r.eac).toBe(0)
  })

  it('EAC = BAC when CPI=1', () => {
    const r = computeEVM({ totalBudget: 500_000, actualCost: 250_000, progressPercent: 50, plannedProgressPercent: 50 })
    expect(r.eac).toBe(500_000)
    expect(r.vac).toBe(0)
  })

  it('ETC is non-negative', () => {
    const r = computeEVM({ totalBudget: 100_000, actualCost: 90_000, progressPercent: 90, plannedProgressPercent: 90 })
    expect(r.etc).toBeGreaterThanOrEqual(0)
  })
})

// ─── computeForecasts ─────────────────────────────────────────────────────────

describe('computeForecasts', () => {
  const baseMetrics = { spi: 1, cpi: 1, earnedValue: 500_000, plannedValue: 500_000, actualCost: 500_000, sv: 0, cv: 0, eac: 1_000_000, etc: 500_000, vac: 0, acDataAvailable: true }

  it('returns forecastDate using SPI-adjusted duration (SPI=1 → no change)', () => {
    const result = computeForecasts({
      metrics: baseMetrics,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      progressPercent: 50,
      daysElapsed: 180,
    })
    // SPI=1 → forecastDuration = plannedDuration / 1 → same as planned end
    expect(result.forecastDate).toBe('2025-12-31')
  })

  it('forecastDate moves further into future when SPI < 1 (delayed)', () => {
    const slowMetrics = { ...baseMetrics, spi: 0.5 }
    const result = computeForecasts({
      metrics: slowMetrics,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      progressPercent: 20,
      daysElapsed: 100,
    })
    // Duration doubles when SPI=0.5
    expect(result.forecastDate).not.toBeNull()
    expect(result.forecastDate! > '2025-12-31').toBe(true)
  })

  it('forecastDate is earlier than planned when SPI > 1 (ahead of schedule)', () => {
    const fastMetrics = { ...baseMetrics, spi: 2 }
    const result = computeForecasts({
      metrics: fastMetrics,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      progressPercent: 50,
      daysElapsed: 90,
    })
    expect(result.forecastDate).not.toBeNull()
    expect(result.forecastDate! < '2025-12-31').toBe(true)
  })

  it('returns forecastDate=null when progress ≤ 5%', () => {
    const result = computeForecasts({
      metrics: baseMetrics,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      progressPercent: 4,
      daysElapsed: 30,
    })
    expect(result.forecastDate).toBeNull()
  })

  it('returns forecastDate=null when no startDate', () => {
    const result = computeForecasts({
      metrics: baseMetrics,
      startDate: '',
      endDate: '2025-12-31',
      progressPercent: 50,
      daysElapsed: 100,
    })
    expect(result.forecastDate).toBeNull()
  })

  it('confidence=high when progress ≥ 30%', () => {
    const r = computeForecasts({ metrics: baseMetrics, startDate: '2025-01-01', endDate: '2025-12-31', progressPercent: 30, daysElapsed: 100 })
    expect(r.confidence).toBe('high')
  })

  it('confidence=medium when progress 15-29%', () => {
    const r = computeForecasts({ metrics: baseMetrics, startDate: '2025-01-01', endDate: '2025-12-31', progressPercent: 15, daysElapsed: 50 })
    expect(r.confidence).toBe('medium')
  })

  it('confidence=low when progress < 15%', () => {
    const r = computeForecasts({ metrics: baseMetrics, startDate: '2025-01-01', endDate: '2025-12-31', progressPercent: 10, daysElapsed: 30 })
    expect(r.confidence).toBe('low')
  })

  it('SPI floor at 0.1 prevents extreme forecast dates', () => {
    // SPI=0.01 would be catastrophic; service clamps to 0.1
    const verySlowMetrics = { ...baseMetrics, spi: 0.01 }
    const result = computeForecasts({
      metrics: verySlowMetrics,
      startDate: '2025-01-01',
      endDate: '2025-06-30',
      progressPercent: 10,
      daysElapsed: 50,
    })
    // With SPI floor=0.1, duration at most 10× planned (180d → 1800d)
    // Without floor (SPI=0.01), duration would be 100× — unreasonably far
    if (result.forecastDate) {
      const forecastYear = new Date(result.forecastDate).getFullYear()
      expect(forecastYear).toBeLessThan(2035)  // reasonable upper bound
    }
  })
})

// ─── classifyHealth ───────────────────────────────────────────────────────────

describe('classifyHealth', () => {
  it('healthy when CPI≥0.95 and SPI≥0.95', () => {
    const h = classifyHealth(1, 1)
    expect(h.status).toBe('healthy')
    expect(h.projectStatus).toBe('on-track')
  })

  it('warning when CPI or SPI in [0.85, 0.95)', () => {
    expect(classifyHealth(0.9, 1).status).toBe('warning')
    expect(classifyHealth(1, 0.9).status).toBe('warning')
  })

  it('critical when CPI < 0.85', () => {
    expect(classifyHealth(0.8, 1).status).toBe('critical')
  })

  it('critical when SPI < 0.85', () => {
    expect(classifyHealth(1, 0.8).status).toBe('critical')
  })

  it('over-budget when CPI < 0.98', () => {
    const h = classifyHealth(0.95, 1)
    expect(h.projectStatus).toBe('over-budget')
    expect(h.insights.some(i => i.includes('Cost overrun'))).toBe(true)
  })

  it('behind-schedule when SPI < 0.98 and CPI ok', () => {
    const h = classifyHealth(1, 0.95)
    expect(h.projectStatus).toBe('behind-schedule')
    expect(h.insights.some(i => i.includes('Schedule'))).toBe(true)
  })

  it('ahead-schedule when SPI > 1.02', () => {
    const h = classifyHealth(1, 1.05)
    expect(h.projectStatus).toBe('ahead-schedule')
  })

  it('under-budget when CPI > 1.02 and SPI ok', () => {
    const h = classifyHealth(1.05, 1)
    expect(h.projectStatus).toBe('under-budget')
  })

  it('trend=improving when SPI or CPI > 1.01', () => {
    expect(classifyHealth(1.05, 1).trend).toBe('improving')
  })

  it('trend=declining when SPI or CPI < 0.99', () => {
    expect(classifyHealth(0.95, 1).trend).toBe('declining')
  })

  it('trend=stable when both indices near 1', () => {
    expect(classifyHealth(1, 1).trend).toBe('stable')
  })
})
