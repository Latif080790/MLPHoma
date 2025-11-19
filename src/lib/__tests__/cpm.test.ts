/**
 * cpm.test.ts
 * Basic unit tests for computeCPM util.
 */

import { computeCPM } from '../cpm'

test('computeCPM simple chain', () => {
  const tasks = [
    { id: 'A', duration: 2, dependencies: [] },
    { id: 'B', duration: 3, dependencies: [{ predecessorId: 'A', type: 'FS', lag: 0 }] },
    { id: 'C', duration: 1, dependencies: [{ predecessorId: 'B', type: 'FS', lag: 0 }] },
  ]
  const res = computeCPM(tasks as any)
  expect(res.cyclic).toBe(false)
  expect(res.projectDuration).toBeGreaterThan(0)
  expect(res.metrics['A'].ES).toBe(0)
  expect(res.metrics['A'].EF).toBe(2)
  expect(res.metrics['B'].ES).toBe(2)
})