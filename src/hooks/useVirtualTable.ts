/**
 * useVirtualTable.ts
 *
 * Thin wrapper around @tanstack/react-virtual's useVirtualizer.
 * Renders only visible rows for tables with 500+ rows (RAB, opname history).
 *
 * Usage:
 *   const { containerRef, virtualItems, totalHeight } = useVirtualTable({
 *     count: items.length,
 *     estimateSize: () => 44,  // row height in px
 *   })
 *
 *   <div ref={containerRef} style={{ height: 500, overflowY: 'auto' }}>
 *     <div style={{ height: totalHeight, position: 'relative' }}>
 *       {virtualItems.map(row => (
 *         <div key={row.key} style={{ position: 'absolute', top: row.start, width: '100%' }}>
 *           <MyRow item={items[row.index]} />
 *         </div>
 *       ))}
 *     </div>
 *   </div>
 */

import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'

interface VirtualTableOptions {
  count: number
  estimateSize?: () => number
  overscan?: number
}

export function useVirtualTable({
  count,
  estimateSize = () => 44,
  overscan = 5,
}: VirtualTableOptions) {
  const containerRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => containerRef.current,
    estimateSize,
    overscan,
  })

  return {
    containerRef,
    virtualItems: virtualizer.getVirtualItems(),
    totalHeight: virtualizer.getTotalSize(),
    measureElement: virtualizer.measureElement,
  }
}
