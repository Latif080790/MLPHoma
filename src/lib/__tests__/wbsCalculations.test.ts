// src/lib/__tests__/wbsCalculations.test.ts
import { describe, it, expect } from 'vitest'
import { recursiveBudget, weightedProgress, flattenVisibleRows, parseBulkPasteText } from '../wbsCalculations'
import type { WBSItem } from '@/types/wbs'
import type { RABItem } from '@/types/rab'

// Minimal WBSItem factory
function wbs(id: string, parentId: string | null, progress = 0, sortOrder = 0): WBSItem {
  return { id, code: id, name: id, level: 1, parentId, sortOrder, projectId: 'p1',
           progress, createdAt: '', updatedAt: '' }
}

// Minimal RABItem factory — only fields used by rabTotal
function rab(wbsId: string, finalTotal: number): Partial<RABItem> & { wbsId?: string; finalTotal?: number } {
  return { wbsId, finalTotal } as RABItem
}

describe('recursiveBudget', () => {
  it('returns 0 when no RAB items linked', () => {
    const items = [wbs('a', null)]
    expect(recursiveBudget('a', items, [])).toBe(0)
  })

  it('sums direct RAB items', () => {
    const items = [wbs('a', null)]
    const rabItems = [rab('a', 1000), rab('a', 500)] as RABItem[]
    expect(recursiveBudget('a', items, rabItems)).toBe(1500)
  })

  it('aggregates children recursively', () => {
    const items = [wbs('root', null), wbs('child1', 'root'), wbs('child2', 'root')]
    const rabItems = [rab('child1', 1000), rab('child2', 2000)] as RABItem[]
    expect(recursiveBudget('root', items, rabItems)).toBe(3000)
  })

  it('includes direct + children budget', () => {
    const items = [wbs('root', null), wbs('child', 'root')]
    const rabItems = [rab('root', 500), rab('child', 1000)] as RABItem[]
    expect(recursiveBudget('root', items, rabItems)).toBe(1500)
  })

  it('handles cyclic parent references without crashing', () => {
    const items: WBSItem[] = [
      { id: 'a', parentId: 'b', code: 'a', name: 'a', level: 1, sortOrder: 0, projectId: 'p', createdAt: '', updatedAt: '' },
      { id: 'b', parentId: 'a', code: 'b', name: 'b', level: 1, sortOrder: 0, projectId: 'p', createdAt: '', updatedAt: '' },
    ]
    expect(() => recursiveBudget('a', items, [])).not.toThrow()
    expect(recursiveBudget('a', items, [])).toBe(0)
  })
})

describe('weightedProgress', () => {
  it('returns leaf node progress directly', () => {
    const items = [wbs('leaf', null, 75)]
    expect(weightedProgress('leaf', items, [])).toBe(75)
  })

  it('returns budget-weighted average of children', () => {
    const items = [wbs('root', null), wbs('c1', 'root', 100), wbs('c2', 'root', 0)]
    // c1 budget=1000 (100%), c2 budget=1000 (0%) → (1000×100 + 1000×0)/2000 = 50
    const rabItems = [rab('c1', 1000), rab('c2', 1000)] as RABItem[]
    expect(weightedProgress('root', items, rabItems)).toBe(50)
  })

  it('falls back to simple average when budget is zero', () => {
    const items = [wbs('root', null), wbs('c1', 'root', 60), wbs('c2', 'root', 40)]
    // no RAB → simple avg: (60+40)/2 = 50
    expect(weightedProgress('root', items, [])).toBe(50)
  })
})

describe('flattenVisibleRows', () => {
  it('returns root items only when none expanded', () => {
    const items = [wbs('root', null, 0, 0), wbs('child', 'root', 0, 0)]
    const rows = flattenVisibleRows(items, new Set(), null, [], new Map())
    expect(rows).toHaveLength(1)
    expect(rows[0].item.id).toBe('root')
  })

  it('includes children when parent is expanded', () => {
    const items = [wbs('root', null, 0, 0), wbs('child', 'root', 0, 0)]
    const rows = flattenVisibleRows(items, new Set(['root']), null, [], new Map())
    expect(rows).toHaveLength(2)
    expect(rows[1].depth).toBe(1)
  })

  it('filters to matching + ancestor nodes when activeFilter set', () => {
    const items = [wbs('root', null, 0, 0), wbs('c1', 'root', 20, 0), wbs('c2', 'root', 80, 0)]
    // filter: low-progress (< 30) — should show root (ancestor) + c1
    const rows = flattenVisibleRows(items, new Set(['root']), 'low-progress', [], new Map())
    const ids = rows.map(r => r.item.id)
    expect(ids).toContain('root')
    expect(ids).toContain('c1')
    expect(ids).not.toContain('c2')
  })
})

describe('parseBulkPasteText', () => {
  it('returns empty array for blank input', () => {
    expect(parseBulkPasteText('', null)).toEqual([])
  })

  it('parses flat lines as depth 0', () => {
    const result = parseBulkPasteText('Alpha\nBeta', null)
    expect(result).toEqual([
      { name: 'Alpha', relativeDepth: 0 },
      { name: 'Beta', relativeDepth: 0 },
    ])
  })

  it('parses tab-indented lines', () => {
    const result = parseBulkPasteText('Parent\n\tChild\n\t\tGrandchild', null)
    expect(result).toEqual([
      { name: 'Parent', relativeDepth: 0 },
      { name: 'Child', relativeDepth: 1 },
      { name: 'Grandchild', relativeDepth: 2 },
    ])
  })

  it('ignores blank lines', () => {
    const result = parseBulkPasteText('A\n\nB', null)
    expect(result).toHaveLength(2)
  })
})
