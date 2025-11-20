/**
 * calculationService.test.ts
 * 
 * Comprehensive unit tests for the calculation service.
 * Tests all calculation functions with various edge cases.
 */

import { describe, it, expect } from 'vitest'
import {
  calculateComponentsTotal,
  calculatePriceWithMarkup,
  calculateAHSPPrice,
  calculateRABItemTotal,
  calculateRABTotals,
} from '../calculationService'

describe('calculationService', () => {
  describe('calculateComponentsTotal', () => {
    it('should calculate total from components correctly', () => {
      const result = calculateComponentsTotal([
        { coefficient: 1.5, unitPrice: 100000 },
        { coefficient: 2.0, unitPrice: 50000 },
        { coefficient: 0.5, unitPrice: 200000 },
      ])

      // 1.5 * 100000 + 2.0 * 50000 + 0.5 * 200000 = 150000 + 100000 + 100000 = 350000
      expect(result.subtotal).toBe(350000)
      expect(result.components).toHaveLength(3)
      expect(result.components[0].amount).toBe(150000)
      expect(result.components[1].amount).toBe(100000)
      expect(result.components[2].amount).toBe(100000)
    })

    it('should return 0 for empty components', () => {
      const result = calculateComponentsTotal([])
      expect(result.subtotal).toBe(0)
      expect(result.components).toHaveLength(0)
    })

    it('should handle zero values', () => {
      const result = calculateComponentsTotal([
        { coefficient: 0, unitPrice: 100000 },
        { coefficient: 1, unitPrice: 0 },
      ])
      expect(result.subtotal).toBe(0)
    })

    it('should handle decimal coefficients', () => {
      const result = calculateComponentsTotal([
        { coefficient: 0.333, unitPrice: 30000 },
        { coefficient: 2.667, unitPrice: 15000 },
      ])
      expect(result.subtotal).toBe(49995)
    })
  })

  describe('calculatePriceWithMarkup', () => {
    it('should apply markups sequentially', () => {
      const result = calculatePriceWithMarkup({
        basePrice: 1000000,
        overheadPercent: 10,
        profitPercent: 15,
        taxPercent: 11,
      })

      // Base: 1000000
      // + Overhead (10%): 1000000 * 1.1 = 1100000
      // + Profit (15%): 1100000 * 1.15 = 1265000
      // + Tax (11%): 1265000 * 1.11 = 1404150
      
      expect(result.basePrice).toBe(1000000)
      expect(result.overheadAmount).toBe(100000)
      expect(result.priceWithOverhead).toBe(1100000)
      expect(result.profitAmount).toBe(165000)
      expect(result.priceWithProfit).toBe(1265000)
      expect(result.taxAmount).toBeCloseTo(139150, 2)
      expect(result.finalPrice).toBeCloseTo(1404150, 2)
    })

    it('should handle zero markups', () => {
      const result = calculatePriceWithMarkup({
        basePrice: 500000,
        overheadPercent: 0,
        profitPercent: 0,
        taxPercent: 0,
      })

      expect(result.finalPrice).toBe(500000)
      expect(result.overheadAmount).toBe(0)
      expect(result.profitAmount).toBe(0)
      expect(result.taxAmount).toBe(0)
    })

    it('should handle undefined markups (default to 0)', () => {
      const result = calculatePriceWithMarkup({
        basePrice: 500000,
      })

      expect(result.finalPrice).toBe(500000)
    })

    it('should calculate breakdown correctly', () => {
      const result = calculatePriceWithMarkup({
        basePrice: 100000,
        overheadPercent: 20,
        profitPercent: 10,
        taxPercent: 11,
      })

      // Overhead: 100000 * 0.2 = 20000 → 120000
      // Profit: 120000 * 0.1 = 12000 → 132000
      // Tax: 132000 * 0.11 = 14520 → 146520
      expect(result.overheadAmount).toBe(20000)
      expect(result.profitAmount).toBe(12000)
      expect(result.taxAmount).toBe(14520)
      expect(result.finalPrice).toBe(146520)
    })

    it('should throw on invalid base price', () => {
      expect(() => calculatePriceWithMarkup({
        basePrice: -100,
      })).toThrow()
    })

    it('should throw on invalid percentages', () => {
      expect(() => calculatePriceWithMarkup({
        basePrice: 100000,
        overheadPercent: 150, // Invalid: > 100
      })).toThrow()
    })
  })

  describe('calculateAHSPPrice', () => {
    it('should calculate AHSP price with components and markups', () => {
      const result = calculateAHSPPrice({
        components: [
          { coefficient: 1, unitPrice: 100000 },
          { coefficient: 0.5, unitPrice: 200000 },
        ],
        overheadPercent: 10,
        profitPercent: 15,
      })

      // Base: 100000 + 100000 = 200000
      // + Overhead (10%): 220000
      // + Profit (15%): 253000

      expect(result.componentBreakdown.subtotal).toBe(200000)
      expect(result.priceBreakdown.basePrice).toBe(200000)
      expect(result.priceBreakdown.finalPrice).toBe(253000)
    })

    it('should include component breakdown', () => {
      const result = calculateAHSPPrice({
        components: [
          { coefficient: 1, unitPrice: 100000 },
          { coefficient: 2, unitPrice: 50000 },
          { coefficient: 0.4, unitPrice: 100000 },
        ],
      })

      expect(result.componentBreakdown.components).toHaveLength(3)
      expect(result.componentBreakdown.components[0].amount).toBe(100000)
      expect(result.componentBreakdown.components[1].amount).toBe(100000)
      expect(result.componentBreakdown.components[2].amount).toBe(40000)
    })

    it('should handle empty components', () => {
      const result = calculateAHSPPrice({
        components: [],
      })

      expect(result.componentBreakdown.subtotal).toBe(0)
      expect(result.priceBreakdown.finalPrice).toBe(0)
    })
  })

  describe('calculateRABItemTotal', () => {
    it('should calculate RAB item total correctly', () => {
      const result = calculateRABItemTotal({
        volume: 100,
        unitPrice: 10000,
        overheadPercent: 10,
        profitPercent: 15,
        taxPercent: 11,
      })

      // Subtotal: 100 * 10000 = 1000000
      // With markups: 1404150
      expect(result.volume).toBe(100)
      expect(result.unitPrice).toBe(10000)
      expect(result.subtotal).toBe(1000000)
      expect(result.finalPrice).toBeCloseTo(1404150, 2)
      expect(result.overheadAmount).toBe(100000)
      expect(result.profitAmount).toBe(165000)
      expect(result.taxAmount).toBeCloseTo(139150, 2)
    })

    it('should handle zero volume', () => {
      const result = calculateRABItemTotal({
        volume: 0,
        unitPrice: 10000,
      })

      expect(result.subtotal).toBe(0)
      expect(result.finalPrice).toBe(0)
    })

    it('should throw on negative volume', () => {
      expect(() => calculateRABItemTotal({
        volume: -10,
        unitPrice: 10000,
      })).toThrow()
    })
  })

  describe('calculateRABTotals', () => {
    it('should calculate totals for multiple RAB items', () => {
      const result = calculateRABTotals({
        items: [
          { volume: 10, unitPrice: 10000 },
          { volume: 5, unitPrice: 20000 },
          { volume: 20, unitPrice: 5000 },
        ],
        overheadPercent: 10,
        profitPercent: 15,
        taxPercent: 11,
      })

      // Subtotal: 100000 + 100000 + 100000 = 300000
      // With markups: 300000 * 1.1 * 1.15 * 1.11 = 421245
      expect(result.subtotal).toBe(300000)
      expect(result.finalPrice).toBeCloseTo(421245, 2)
    })

    it('should handle empty items array', () => {
      const result = calculateRABTotals({
        items: [],
        overheadPercent: 10,
        profitPercent: 15,
        taxPercent: 11,
      })

      expect(result.subtotal).toBe(0)
      expect(result.finalPrice).toBe(0)
    })

    it('should use project-level markups by default', () => {
      const result = calculateRABTotals({
        items: [{ volume: 10, unitPrice: 10000 }],
        overheadPercent: 10,
        profitPercent: 15,
        taxPercent: 11,
      })

      // Should apply project-level percentages
      expect(result.overheadPercent).toBe(10)
      expect(result.profitPercent).toBe(15)
      expect(result.taxPercent).toBe(11)
    })

    it('should use project-level markups for all items', () => {
      const result = calculateRABTotals({
        items: [
          { volume: 10, unitPrice: 10000 },
        ],
        overheadPercent: 10,
        profitPercent: 15,
        taxPercent: 11,
      })

      // Should apply project-level percentages
      expect(result.overheadPercent).toBe(10)
      expect(result.profitPercent).toBe(15)
      expect(result.taxPercent).toBe(11)
    })
  })

  describe('Edge Cases', () => {
    it('should handle very large numbers', () => {
      const result = calculatePriceWithMarkup({
        basePrice: 1000000000, // 1 billion
        overheadPercent: 10,
        profitPercent: 15,
        taxPercent: 11,
      })

      expect(result.finalPrice).toBeGreaterThan(1000000000)
      expect(result.finalPrice).toBeLessThan(2000000000)
    })

    it('should handle decimal results properly', () => {
      const result = calculateComponentsTotal([
        { coefficient: 0.333, unitPrice: 10000 },
      ])

      expect(result.subtotal).toBe(3330)
    })

    it('should be consistent across multiple calculations', () => {
      const result1 = calculatePriceWithMarkup({
        basePrice: 100000,
        overheadPercent: 10,
        profitPercent: 15,
        taxPercent: 11,
      })

      const result2 = calculatePriceWithMarkup({
        basePrice: 100000,
        overheadPercent: 10,
        profitPercent: 15,
        taxPercent: 11,
      })

      expect(result1.finalPrice).toBe(result2.finalPrice)
    })
  })

  describe('Formula Consistency', () => {
    it('should match rabUtils.computeFinalTotal results', () => {
      // Test that new service matches legacy behavior
      const basePrice = 1000000
      const overhead = 10
      const profit = 15
      const tax = 11

      const newResult = calculatePriceWithMarkup({
        basePrice,
        overheadPercent: overhead,
        profitPercent: profit,
        taxPercent: tax,
      })

      // Legacy formula: base * (1 + oh/100) * (1 + pr/100) * (1 + tax/100)
      const legacyResult = basePrice * 1.1 * 1.15 * 1.11

      expect(newResult.finalPrice).toBeCloseTo(legacyResult, 2)
    })

    it('should apply markups in correct order', () => {
      const result = calculatePriceWithMarkup({
        basePrice: 100,
        overheadPercent: 10,
        profitPercent: 20,
      })

      // Correct: 100 + 10 = 110, then 110 + 22 = 132
      // Wrong: 100 + 10 + 20 = 130
      expect(result.finalPrice).toBe(132)
      expect(result.finalPrice).not.toBe(130)
    })
  })
})
