/**
 * src/lib/__tests__/rabUtils.test.ts
 *
 * Basic unit tests for rabUtils functions.
 *
 * Note: test runner might not be configured in this environment; file provided
 * as reference and for CI integration.
 */

import { computeAHSPUnitPrice, computeItemTotals } from '../rabUtils'

test('computeAHSPUnitPrice sums coefficient*unitPrice', () => {
  const components = [
    { coefficient: 2, unitPrice: 100 },
    { coefficient: 0.5, unitPrice: 200 },
  ]
  expect(computeAHSPUnitPrice(components)).toBeCloseTo(2 * 100 + 0.5 * 200)
})

test('computeItemTotals calculates subtotal and finalTotal', () => {
  const res = computeItemTotals({ volume: 10, unitPrice: 100, overhead: 10, profit: 5, tax: 11 })
  const subtotal = 10 * 100
  let expected = subtotal * 1.10
  expected = expected * 1.05
  expected = expected * 1.11
  expect(res.subtotal).toBe(subtotal)
  expect(res.finalTotal).toBeCloseTo(expected)
})