/**
 * tkdnService.test.ts
 * Unit tests for TKDN calculation logic.
 * Tests calculateSummary (pure function, no DB).
 */

import { describe, it, expect } from 'vitest'
import { tkdnService } from '../../services/tkdnService'
import type { TKDNItem } from '../../types/tkdn'

function makeItem(overrides: Partial<TKDNItem> = {}): TKDNItem {
  return {
    id: 'tkdn-001',
    project_id: 'P-001',
    name: 'Semen Portland',
    category: 'material',
    origin: 'domestic',
    unit: 'kg',
    quantity: 100,
    unit_price: 50000,
    total_value: 5_000_000,
    created_at: '2025-01-01',
    updated_at: '2025-01-01',
    ...overrides,
  }
}

describe('tkdnService.calculateSummary', () => {
  it('should return 100% TKDN when all items are domestic', () => {
    const items: TKDNItem[] = [
      makeItem({ id: '1', name: 'Semen', total_value: 10_000_000 }),
      makeItem({ id: '2', name: 'Pasir', total_value: 5_000_000 }),
    ]
    const summary = tkdnService.calculateSummary(items, 40)
    expect(summary.tkdn_percentage).toBe(100)
    expect(summary.total_domestic).toBe(15_000_000)
    expect(summary.total_imported).toBe(0)
    expect(summary.meets_target).toBe(true)
  })

  it('should return 0% TKDN when all items are imported', () => {
    const items: TKDNItem[] = [
      makeItem({ id: '1', origin: 'imported', total_value: 8_000_000 }),
    ]
    const summary = tkdnService.calculateSummary(items, 40)
    expect(summary.tkdn_percentage).toBe(0)
    expect(summary.meets_target).toBe(false)
  })

  it('should calculate correct percentage for mixed items', () => {
    const items: TKDNItem[] = [
      makeItem({ id: '1', origin: 'domestic', total_value: 60_000_000 }),
      makeItem({ id: '2', origin: 'imported', total_value: 40_000_000 }),
    ]
    const summary = tkdnService.calculateSummary(items, 40)
    expect(summary.tkdn_percentage).toBe(60)
    expect(summary.total_domestic).toBe(60_000_000)
    expect(summary.total_imported).toBe(40_000_000)
    expect(summary.meets_target).toBe(true)
  })

  it('should compute per-category breakdown', () => {
    const items: TKDNItem[] = [
      makeItem({ id: '1', category: 'material', origin: 'domestic', total_value: 50_000_000 }),
      makeItem({ id: '2', category: 'material', origin: 'imported', total_value: 50_000_000 }),
      makeItem({ id: '3', category: 'labor', origin: 'domestic', total_value: 30_000_000 }),
      makeItem({ id: '4', category: 'equipment', origin: 'imported', total_value: 20_000_000 }),
    ]
    const summary = tkdnService.calculateSummary(items, 40)

    // Material: 50M domestic / 100M = 50%
    const materialCat = summary.by_category.find(c => c.category === 'material')!
    expect(materialCat.tkdn_percentage).toBe(50)
    expect(materialCat.item_count).toBe(2)

    // Labor: 30M domestic / 30M = 100%
    const laborCat = summary.by_category.find(c => c.category === 'labor')!
    expect(laborCat.tkdn_percentage).toBe(100)
    expect(laborCat.item_count).toBe(1)

    // Equipment: 0 domestic / 20M = 0%
    const equipmentCat = summary.by_category.find(c => c.category === 'equipment')!
    expect(equipmentCat.tkdn_percentage).toBe(0)
    expect(equipmentCat.item_count).toBe(1)

    // Service: 0 items = 0%
    const serviceCat = summary.by_category.find(c => c.category === 'service')!
    expect(serviceCat.tkdn_percentage).toBe(0)
    expect(serviceCat.item_count).toBe(0)
  })

  it('should respect custom target percentage', () => {
    const items: TKDNItem[] = [
      makeItem({ id: '1', origin: 'domestic', total_value: 30_000_000 }),
      makeItem({ id: '2', origin: 'imported', total_value: 70_000_000 }),
    ]
    // 30% TKDN — fails at 40% target
    expect(tkdnService.calculateSummary(items, 40).meets_target).toBe(false)
    // 30% TKDN — passes at 25% target
    expect(tkdnService.calculateSummary(items, 25).meets_target).toBe(true)
  })

  it('should handle empty items array gracefully', () => {
    const summary = tkdnService.calculateSummary([], 40)
    expect(summary.tkdn_percentage).toBe(0)
    expect(summary.total_domestic).toBe(0)
    expect(summary.total_imported).toBe(0)
    expect(summary.meets_target).toBe(false)
    expect(summary.by_category).toHaveLength(4) // all 4 categories with 0
  })

  it('should round percentage to 2 decimals', () => {
    const items: TKDNItem[] = [
      makeItem({ id: '1', origin: 'domestic', total_value: 1 }),
      makeItem({ id: '2', origin: 'imported', total_value: 2 }),
    ]
    // 1/3 = 33.333... -> 33.33
    const summary = tkdnService.calculateSummary(items)
    expect(summary.tkdn_percentage).toBe(33.33)
  })

  it('should include all 4 categories even with empty ones', () => {
    const items: TKDNItem[] = [
      makeItem({ id: '1', category: 'material', total_value: 100 }),
    ]
    const summary = tkdnService.calculateSummary(items)
    expect(summary.by_category).toHaveLength(4)
    const categories = summary.by_category.map(c => c.category)
    expect(categories).toContain('material')
    expect(categories).toContain('labor')
    expect(categories).toContain('equipment')
    expect(categories).toContain('service')
  })
})
