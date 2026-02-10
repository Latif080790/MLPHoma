import { describe, it, expect } from 'vitest'
import { computeCPM, CPMTask } from '../cpm'

describe('computeCPM - linear chain', () => {
  it('computes ES/EF/LS/LF/TF correctly', () => {
    const tasks: CPMTask[] = [
      { id: 'A', duration: 2 },
      { id: 'B', duration: 3, dependencies: [{ predecessorId: 'A' }] },
      { id: 'C', duration: 1, dependencies: [{ predecessorId: 'B' }] },
    ]
    const result = computeCPM(tasks)
    expect(result.cyclic).toBe(false)
    // Project duration: 2 + 3 + 1 = 6
    expect(result.projectDuration).toBe(6)
    expect(result.metrics.A).toEqual({ ES: 0, EF: 2, LS: 0, LF: 2, TF: 0 })
    expect(result.metrics.B).toEqual({ ES: 2, EF: 5, LS: 2, LF: 5, TF: 0 })
    expect(result.metrics.C).toEqual({ ES: 5, EF: 6, LS: 5, LF: 6, TF: 0 })
    expect(Array.from(result.criticalIds)).toEqual(['A','B','C'])
  })
})

describe('computeCPM - branching', () => {
  it('identifies critical path among branches', () => {
    const tasks: CPMTask[] = [
      { id: 'A', duration: 1 },
      { id: 'B', duration: 4, dependencies: [{ predecessorId: 'A' }] },
      { id: 'C', duration: 2, dependencies: [{ predecessorId: 'A' }] },
      { id: 'D', duration: 3, dependencies: [{ predecessorId: 'B' }, { predecessorId: 'C' }] },
    ]
    const r = computeCPM(tasks)
    // Path A-B-D: 1 + 4 + 3 = 8 (critical)
    // Path A-C-D: 1 + 2 + 3 = 6 (non-critical)
    expect(r.projectDuration).toBe(8)
    expect(r.metrics.C.TF).toBeGreaterThan(0) // branch slack
    expect(r.metrics.B.TF).toBe(0)
    expect(r.metrics.D.TF).toBe(0)
    expect(r.criticalIds.has('B')).toBe(true)
    expect(r.criticalIds.has('D')).toBe(true)
    expect(r.criticalIds.has('C')).toBe(false)
  })
})

describe('computeCPM - lag handling', () => {
  it('applies FS lag to successor ES', () => {
    const tasks: CPMTask[] = [
      { id: 'A', duration: 2 },
      { id: 'B', duration: 3, dependencies: [{ predecessorId: 'A', lag: 2 }] },
    ]
    const r = computeCPM(tasks)
    // A EF = 2; B ES should be 2 + lag(2) = 4; B EF = 7
    expect(r.metrics.B.ES).toBe(4)
    expect(r.metrics.B.EF).toBe(7)
    expect(r.projectDuration).toBe(7)
  })
})

describe('computeCPM - cycle detection', () => {
  it('flags cyclic graphs and returns empty metrics', () => {
    const tasks: CPMTask[] = [
      { id: 'A', duration: 1, dependencies: [{ predecessorId: 'B' }] },
      { id: 'B', duration: 1, dependencies: [{ predecessorId: 'A' }] },
    ]
    const r = computeCPM(tasks)
    expect(r.cyclic).toBe(true)
    expect(r.projectDuration).toBe(0)
    expect(Object.keys(r.metrics).length).toBe(0)
  })
})