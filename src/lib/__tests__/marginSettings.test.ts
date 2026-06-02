import { describe, it, expect } from 'vitest'
import { readMarginSettings, effectiveMarginPct, type MarginSettings } from '../marginSettings'

describe('marginSettings', () => {
  describe('readMarginSettings', () => {
    it('returns safe defaults for empty meta', () => {
      expect(readMarginSettings(undefined)).toEqual<MarginSettings>({
        marginMode: 'fixed',
        defaultMarginPct: 0,
        costBasis: 'rap',
        itemMargins: {},
      })
    })

    it('reads provided values', () => {
      const s = readMarginSettings({
        marginMode: 'per_item',
        defaultMarginPct: 35,
        costBasis: 'rapp',
        itemMargins: { 'rab-1': 40 },
      })
      expect(s.marginMode).toBe('per_item')
      expect(s.defaultMarginPct).toBe(35)
      expect(s.costBasis).toBe('rapp')
      expect(s.itemMargins['rab-1']).toBe(40)
    })

    it('ignores invalid enum values, falling back to defaults', () => {
      const s = readMarginSettings({ marginMode: 'nonsense', costBasis: 'x' })
      expect(s.marginMode).toBe('fixed')
      expect(s.costBasis).toBe('rap')
    })
  })

  describe('effectiveMarginPct', () => {
    it('fixed mode always uses the project default', () => {
      const s = readMarginSettings({ marginMode: 'fixed', defaultMarginPct: 30, itemMargins: { a: 99 } })
      expect(effectiveMarginPct(s, 'a')).toBe(30)
    })

    it('per_item mode uses item override, falling back to default', () => {
      const s = readMarginSettings({ marginMode: 'per_item', defaultMarginPct: 30, itemMargins: { a: 45 } })
      expect(effectiveMarginPct(s, 'a')).toBe(45)
      expect(effectiveMarginPct(s, 'b')).toBe(30)
    })
  })
})