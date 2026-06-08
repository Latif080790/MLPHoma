// src/lib/wbsCalculations.ts
import type { WBSItem, WBSFlatRow, KPIFilter } from '../types/wbs'
import type { RABItem } from '../types/rab'

function safeNum(v: unknown): number {
  const n = Number(v)
  return isFinite(n) && n >= 0 ? n : 0
}

function rabTotal(r: RABItem): number {
  if (r.finalTotal != null && isFinite(Number(r.finalTotal))) return Number(r.finalTotal)
  if ((r as any).final_total != null && isFinite(Number((r as any).final_total))) return Number((r as any).final_total)
  if ((r as any).finalPrice != null && isFinite(Number((r as any).finalPrice))) return Number((r as any).finalPrice)
  return safeNum(r.volume) * safeNum((r as unknown as { unit_price?: number }).unit_price ?? (r as unknown as { unitPrice?: number }).unitPrice)
}

export function recursiveBudget(
  nodeId: string,
  items: WBSItem[],
  rabItems: RABItem[],
  visited: Set<string> = new Set()
): number {
  if (visited.has(nodeId)) return 0
  visited.add(nodeId)
  const direct = rabItems
    .filter(r => r.wbsId === nodeId)
    .reduce((s, r) => s + rabTotal(r), 0)
  const childSum = items
    .filter(i => i.parentId === nodeId)
    .reduce((s, c) => s + recursiveBudget(c.id, items, rabItems, visited), 0)
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
  const childProgresses: number[] = []
  for (const child of children) {
    const b = recursiveBudget(child.id, items, rabItems, new Set())
    const p = weightedProgress(child.id, items, rabItems)
    childProgresses.push(p)
    totalBudget += b
    weightedSum += b * p
  }
  if (totalBudget === 0) {
    return Math.round(childProgresses.reduce((s, p) => s + p, 0) / children.length)
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

  const childrenByParent = new Map<string | null, WBSItem[]>()
  for (const item of items) {
    const key = item.parentId ?? null
    if (!childrenByParent.has(key)) childrenByParent.set(key, [])
    childrenByParent.get(key)!.push(item)
  }

  const budgetCache = new Map<string, number>()
  const progressCache = new Map<string, number>()

  function getCachedBudget(id: string): number {
    if (!budgetCache.has(id)) budgetCache.set(id, recursiveBudget(id, items, rabItems, new Set()))
    return budgetCache.get(id)!
  }
  function getCachedProgress(id: string): number {
    if (!progressCache.has(id)) progressCache.set(id, weightedProgress(id, items, rabItems))
    return progressCache.get(id)!
  }

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
    (childrenByParent.get(parentId) ?? [])
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .forEach(item => {
        if (visibleIds && !visibleIds.has(item.id)) return
        const hasChildren = (childrenByParent.get(item.id) ?? []).length > 0
        const isExpanded = expandedIds.has(item.id)
        rows.push({
          item,
          depth,
          isExpanded,
          hasChildren,
          recursiveBudget: getCachedBudget(item.id),
          weightedProgress: getCachedProgress(item.id),
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
