import { describe, expect, it, vi } from 'vitest'

vi.mock('jspdf', () => ({ jsPDF: vi.fn() }))
vi.mock('jspdf-autotable', () => ({}))

import { tkdnService } from '../tkdnService'

describe('tkdnService', () => {
  it('calculates TKDN percentage and target compliance', () => {
    const summary = tkdnService.calculateSummary([
      {
        id: '1',
        project_id: 'p1',
        name: 'Domestic Material',
        category: 'material',
        origin: 'domestic',
        unit: 'unit',
        quantity: 1,
        unit_price: 600,
        total_value: 600,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
      {
        id: '2',
        project_id: 'p1',
        name: 'Imported Equipment',
        category: 'equipment',
        origin: 'imported',
        unit: 'unit',
        quantity: 1,
        unit_price: 400,
        total_value: 400,
        created_at: '2026-01-01',
        updated_at: '2026-01-01',
      },
    ] as any, 50)

    expect(summary.total_domestic).toBe(600)
    expect(summary.total_imported).toBe(400)
    expect(summary.tkdn_percentage).toBe(60)
    expect(summary.meets_target).toBe(true)
    expect(summary.by_category.length).toBe(4)
  })
})
