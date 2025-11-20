import { describe, it, expect } from 'vitest'
import { computeAHSPUnitPrice, computeSubtotal, computeFinalTotal, computeItemTotals } from '../rabUtils'

describe('rabUtils - computeAHSPUnitPrice', () => {
  it('returns 0 for empty components', () => {
    expect(computeAHSPUnitPrice([])).toBe(0)
  })
  it('sums coefficient * unitPrice', () => {
    const components = [
      { coefficient: 2, unitPrice: 1000 },
      { coefficient: 0.5, unitPrice: 2000 },
    ]
    // 2*1000 + 0.5*2000 = 2000 + 1000 = 3000
    expect(computeAHSPUnitPrice(components)).toBe(3000)
  })
})

describe('rabUtils - computeSubtotal', () => {
  it('multiplies volume by unitPrice', () => {
    expect(computeSubtotal(10, 1500)).toBe(15000)
  })
})

describe('rabUtils - computeFinalTotal', () => {
  it('applies overhead, profit, and tax sequentially', () => {
    const subtotal = 1000
    // overhead 10% => 1100
    // profit 5% => 1155
    // tax 11% => 1282.05
    const total = computeFinalTotal(subtotal, 10, 5, 11)
    expect(Number(total.toFixed(2))).toBe(1282.05)
  })
  it('handles zero percentages gracefully', () => {
    expect(computeFinalTotal(500, 0, 0, 0)).toBe(500)
  })
})

describe('rabUtils - computeItemTotals', () => {
  it('returns subtotal and finalTotal object', () => {
    const r = computeItemTotals({ volume: 2, unitPrice: 100, overhead: 10, profit: 10, tax: 10 })
    // subtotal: 200
    // overhead: 220
    // profit: 242
    // tax: 266.2
    expect(r.subtotal).toBe(200)
    expect(Number(r.finalTotal.toFixed(1))).toBe(266.2)
  })
})
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