import { describe, it, expect } from 'vitest'
import {
  rabMarkupMultiplier,
  rabContractExTax,
  grossMargin,
  grossMarginPct,
  clampMarginPct,
  sellingFromBase,
  baseFromSelling,
  kontribusi,
  bonus,
} from '../costingMargin'

describe('costingMargin', () => {
  describe('rabMarkupMultiplier', () => {
    it('returns 1 when no markup', () => {
      expect(rabMarkupMultiplier(0, 0)).toBe(1)
    })
    it('adds OH and Profit percentages', () => {
      expect(rabMarkupMultiplier(0, 20)).toBeCloseTo(1.2)
      expect(rabMarkupMultiplier(5, 15)).toBeCloseTo(1.2)
    })
    it('treats non-finite inputs as 0', () => {
      expect(rabMarkupMultiplier(NaN, 20)).toBeCloseTo(1.2)
    })
  })

  describe('rabContractExTax', () => {
    it('reproduces the real CMPLNG VILLAGE figures (OH 0%, Profit 20%)', () => {
      // From the RAB module: subtotal 4.966.572.640 → taxBase (ex-PPN contract) 5.959.887.168
      const base = 4_966_572_640
      expect(rabContractExTax(base, 0, 20)).toBeCloseTo(5_959_887_168, 0)
    })
    it('equals base when there is no markup', () => {
      expect(rabContractExTax(1_000_000, 0, 0)).toBe(1_000_000)
    })
  })

  describe('grossMargin', () => {
    it('is the profit portion when RAP execution equals the base cost', () => {
      const base = 4_966_572_640
      const contract = rabContractExTax(base, 0, 20)
      // RAP breaks down the same base production cost → margin = the 20% profit
      expect(grossMargin(contract, base)).toBeCloseTo(993_314_528, 0)
    })
    it('grows when execution cost is driven below the base (negotiated cheaper)', () => {
      const contract = rabContractExTax(1_000_000, 0, 20) // 1.200.000
      expect(grossMargin(contract, 900_000)).toBe(300_000)
    })
    it('goes negative on cost overrun above contract', () => {
      const contract = rabContractExTax(1_000_000, 0, 20) // 1.200.000
      expect(grossMargin(contract, 1_500_000)).toBe(-300_000)
    })
  })

  describe('grossMarginPct', () => {
    it('expresses margin as a share of contract revenue', () => {
      const contract = rabContractExTax(1_000_000, 0, 20) // 1.200.000
      // margin 200.000 / contract 1.200.000 = 16.67%
      expect(grossMarginPct(contract, 1_000_000)).toBeCloseTo(16.6667, 3)
    })
    it('returns null when there is no contract value (unlinked item)', () => {
      expect(grossMarginPct(0, 100)).toBeNull()
    })
  })

  describe('clampMarginPct', () => {
    it('clamps below 0 to 0', () => {
      expect(clampMarginPct(-5)).toBe(0)
    })
    it('clamps at/above 100 to 99.99 to avoid divide-by-zero', () => {
      expect(clampMarginPct(100)).toBe(99.99)
      expect(clampMarginPct(150)).toBe(99.99)
    })
    it('passes through valid values and non-finite -> 0', () => {
      expect(clampMarginPct(35)).toBe(35)
      expect(clampMarginPct(NaN)).toBe(0)
    })
  })

  describe('sellingFromBase (margin-on-revenue)', () => {
    it('reproduces CMPLNG VILLAGE at margin 35%', () => {
      // 4.966.572.640 / (1 - 0.35) = 7.640.880.984,6...
      expect(sellingFromBase(4_966_572_640, 35)).toBeCloseTo(7_640_880_984.6, 1)
    })
    it('returns base when margin 0', () => {
      expect(sellingFromBase(1_000_000, 0)).toBe(1_000_000)
    })
  })

  describe('baseFromSelling (inverse)', () => {
    it('round-trips with sellingFromBase', () => {
      const base = 4_966_572_640
      expect(baseFromSelling(sellingFromBase(base, 35), 35)).toBeCloseTo(base, 0)
    })
  })

  describe('kontribusi & bonus', () => {
    it('kontribusi = RAB selling - RAP Kontribusi', () => {
      const selling = sellingFromBase(4_966_572_640, 35)
      expect(kontribusi(selling, 4_966_572_640)).toBeCloseTo(2_674_308_344.6, 1)
    })
    it('bonus = RAP Kontribusi - RAPP, positive when PM beats the plafon', () => {
      expect(bonus(4_966_572_640, 4_500_000_000)).toBe(466_572_640)
    })
    it('bonus negative on overrun above plafon (flagged in UI, enforced in Fase B)', () => {
      expect(bonus(1_000_000, 1_200_000)).toBe(-200_000)
    })
  })
})
