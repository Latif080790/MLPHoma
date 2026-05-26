/**
 * src/components/rab/RABSummary.tsx
 *
 * Summary panel for RAB project totals.
 * Shows item count, subtotal, tax, and final total.
 * Currently a placeholder — summary logic lives inline in the RAB page.
 */

import React, { useMemo } from 'react'
import { useRabStore } from '../../store/rabStore'
import { formatIDR } from '../../lib/utils'
import { useShallow } from 'zustand/react/shallow'

interface RABSummaryProps {
  projectId: string
  taxRate?: number
}

export default function RABSummary({ projectId, taxRate = 0.11 }: RABSummaryProps) {
  const items = useRabStore(useShallow((s) => s.getItems(projectId)))

  const summary = useMemo(() => {
    const subtotal = items.reduce(
      (sum, item) => sum + (item.finalTotal ?? item.final_total ?? 0),
      0
    )
    const tax = subtotal * taxRate
    const total = subtotal + tax
    return { count: items.length, subtotal, tax, total }
  }, [items, taxRate])

  return (
    <div className="rounded-md border p-4 bg-white shadow-sm">
      <div className="font-medium text-sm mb-3">RAB Summary</div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-neutral-500">Total Items</span>
          <span className="font-medium">{summary.count}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Subtotal</span>
          <span>{formatIDR(summary.subtotal)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-neutral-500">Tax ({(taxRate * 100).toFixed(0)}%)</span>
          <span>{formatIDR(summary.tax)}</span>
        </div>
        <div className="flex justify-between font-semibold border-t pt-2 mt-2">
          <span>Final Total</span>
          <span>{formatIDR(summary.total)}</span>
        </div>
      </div>
    </div>
  )
}