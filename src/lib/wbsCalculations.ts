// src/lib/wbsCalculations.ts
import type { WBSItem, WBSFlatRow, KPIFilter } from '../types/wbs'
import type { RABItem } from '../types/rab'

function rabTotal(r: RABItem): number {
  return (
    r.finalTotal ??
    r.final_total ??
    r.finalPrice ??
    (r.volume ?? 0) * ((r as unknown as { unit_price?: number }).unit_price ?? (r as unknown as { unitPrice?: number }).unitPrice ?? 0)
  )
}

export function recursiveBudget(
  nodeId: string,
  items: WBSItem[],
  rabItems: RABItem[]
): number {
  const direct = rabItems
    .filter(r => r.wbsId === nodeId)
    .reduce((s, r) => s + rabTotal(r), 0)
  const childSum = items
    .filter(i => i.parentId === nodeId)
    .reduce((s, c) => s + recursiveBudget(c.id, items, rabItems), 0)
  return direct + childSum
}

export function weightedProgress(
  nodeId: string,
  items: WBSItem[],
  rabItems: RABItem[]
): number {
  const children = items.filter(i => i.parentId === nodeId)
  if (children.length === 0) {
    return items.find(i => i.id === nodeId)?.progress ?? 0
  }
  let totalBudget = 0
  let weightedSum = 0
  for (const child of children) {
    const b = recursiveBudget(child.id, items, rabItems)
    const p = weightedProgress(child.id, items, rabItems)
    totalBudget += b
    weightedSum += b * p
  }
  if (totalBudget === 0) {
    const sum = children.reduce((s, c) => s + weightedProgress(c.id, items, rabItems), 0)
    return Math.round(sum / children.length)
  }
  return Math.round(weightedSum / totalBudget)
}

function passesFilter(
  item: WBSItem,
  filter: KPIFilter,
  rabItems: RABItem[],
  timelineCountByWbs: Map<string, number>
): boolean {
  if (filter === null) return true
  switch (filter) {
    case 'rab-unlinked': return !rabItems.some(r => r.wbsId === item.id)
    case 'timeline-linked': return (timelineCountByWbs.get(item.id) ?? 0) > 0
    case 'qc-passed': return item.qc_status === 'PASSED'
    case 'low-progress': return (item.progress ?? 0) < 30
  }
}

export function flattenVisibleRows(
  items: WBSItem[],
  expandedIds: Set<string>,
  activeFilter: KPIFilter,
  rabItems: RABItem[],
  timelineCountByWbs: Map<string, number>
): WBSFlatRow[] {
  const rows: WBSFlatRow[] = []
  const itemMap = new Map(items.map(i => [i.id, i]))

  let visibleIds: Set<string> | null = null
  if (activeFilter !== null) {
    const matchingIds = new Set(
      items.filter(i => passesFilter(i, activeFilter, rabItems, timelineCountByWbs)).map(i => i.id)
    )
    visibleIds = new Set(matchingIds)
    matchingIds.forEach(id => {
      let cur = itemMap.get(id)?.parentId ?? null
      while (cur) {
        visibleIds!.add(cur)
        cur = itemMap.get(cur)?.parentId ?? null
      }
    })
  }

  function walk(parentId: string | null, depth: number) {
    items
      .filter(i => i.parentId === parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach(item => {
        if (visibleIds && !visibleIds.has(item.id)) return
        const hasChildren = items.some(i => i.parentId === item.id)
        const isExpanded = expandedIds.has(item.id)
        rows.push({
          item,
          depth,
          isExpanded,
          hasChildren,
          recursiveBudget: recursiveBudget(item.id, items, rabItems),
          weightedProgress: weightedProgress(item.id, items, rabItems),
        })
        if (isExpanded) walk(item.id, depth + 1)
      })
  }

  walk(null, 0)
  return rows
}

export function parseBulkPasteText(
  text: string,
  _parentCode: string | null
): Array<{ name: string; relativeDepth: number }> {
  return text
    .split('\n')
    .filter(line => line.trim())
    .map(line => {
      const match = line.match(/^(\t*)(.+)$/)
      return {
        name: (match?.[2] ?? line).trim(),
        relativeDepth: match?.[1]?.length ?? 0,
      }
    })
}
