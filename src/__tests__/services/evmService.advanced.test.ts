import { describe, it, expect } from 'vitest'
import { computeTCPI, computeAdvancedEAC, computeConfidenceInterval } from '../../services/evmService'

describe('computeTCPI', () => {
  it('(BAC-EV)/(BAC-AC): BAC=1000,EV=400,AC=500 → tcpiBac=1.2', () => {
    expect(computeTCPI({ bac: 1000, ev: 400, ac: 500, eac: 1000 }).tcpiBac).toBeCloseTo(1.2, 3)
  })
  it('(BAC-EV)/(EAC-AC): BAC=1000,EV=400,AC=500,EAC=1200 → tcpiEac=0.857', () => {
    expect(computeTCPI({ bac: 1000, ev: 400, ac: 500, eac: 1200 }).tcpiEac).toBeCloseTo(0.857, 3)
  })
  it('returns tcpiBac=1 when BAC-AC=0 (project complete by cost)', () => {
    expect(computeTCPI({ bac: 1000, ev: 1000, ac: 1000, eac: 1000 }).tcpiBac).toBe(1)
  })
  it('TCPI > 1.1 → feasibility=unrealistic', () => {
    expect(computeTCPI({ bac: 1000, ev: 100, ac: 800, eac: 1000 }).feasibility).toBe('unrealistic')
  })
  it('TCPI 1.0 < x ≤ 1.1 → feasibility=challenging', () => {
    expect(computeTCPI({ bac: 1000, ev: 400, ac: 450, eac: 1000 }).feasibility).toBe('challenging')
  })
  it('TCPI ≤ 1.0 → feasibility=achievable', () => {
    expect(computeTCPI({ bac: 1000, ev: 600, ac: 500, eac: 1000 }).feasibility).toBe('achievable')
  })
})

describe('computeAdvancedEAC', () => {
  it('EAC1 = AC + ETC: AC=500, ETC=650 → 1150', () => {
    expect(computeAdvancedEAC({ bac: 1000, ev: 400, ac: 500, etc: 650 }).eac1).toBe(1150)
  })
  it('EAC2 = BAC / CPI: CPI=EV/AC=0.8 → BAC/0.8=1250', () => {
    expect(computeAdvancedEAC({ bac: 1000, ev: 400, ac: 500, etc: 650 }).eac2).toBeCloseTo(1250, 0)
  })
  it('EAC3 = AC + (BAC-EV)/CPI: AC=500, (BAC-EV)=600, CPI=0.8 → 500+750=1250', () => {
    expect(computeAdvancedEAC({ bac: 1000, ev: 400, ac: 500, etc: 650 }).eac3).toBeCloseTo(1250, 0)
  })
  it('recommendedEac = max(eac1, eac2, eac3)', () => {
    const r = computeAdvancedEAC({ bac: 1000, ev: 400, ac: 500, etc: 300 })
    expect(r.recommendedEac).toBe(Math.max(r.eac1, r.eac2, r.eac3))
  })
  it('vac = bac - recommendedEac', () => {
    const r = computeAdvancedEAC({ bac: 1000, ev: 400, ac: 500, etc: 650 })
    expect(r.vac).toBeCloseTo(1000 - r.recommendedEac, 0)
  })
})

describe('computeConfidenceInterval', () => {
  it('returns tighter interval (smaller range) with more snapshots', () => {
    const narrow = computeConfidenceInterval({ cpi: 0.95, progressPct: 60, snapshotCount: 30 })
    const wide   = computeConfidenceInterval({ cpi: 0.95, progressPct: 60, snapshotCount: 3  })
    expect(narrow.range).toBeLessThan(wide.range)
  })
  it('confidence=high when progressPct >= 30', () => {
    expect(computeConfidenceInterval({ cpi: 1.0, progressPct: 35, snapshotCount: 20 }).confidence).toBe('high')
  })
  it('confidence=medium when progressPct 10–29', () => {
    expect(computeConfidenceInterval({ cpi: 1.0, progressPct: 20, snapshotCount: 5 }).confidence).toBe('medium')
  })
  it('confidence=low when progressPct < 10', () => {
    expect(computeConfidenceInterval({ cpi: 1.0, progressPct: 5, snapshotCount: 2 }).confidence).toBe('low')
  })
  it('lower < cpi < upper', () => {
    const r = computeConfidenceInterval({ cpi: 0.9, progressPct: 40, snapshotCount: 15 })
    expect(r.lower).toBeLessThan(0.9)
    expect(r.upper).toBeGreaterThan(0.9)
  })
})
