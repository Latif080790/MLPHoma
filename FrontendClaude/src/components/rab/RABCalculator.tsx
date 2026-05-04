/**
 * src/components/rab/RABCalculator.tsx
 *
 * RAB price calculator widget.
 * Uses the central calculationService — single source of truth for all markup logic.
 *
 * Supports:
 *   - profitBasis: 'base_plus_overhead' (SNI default) | 'base' (simple margin)
 *   - markupSource: 'baked_in' → price already includes OH+profit, skip re-applying
 */

import React, { useMemo } from 'react'
import { formatIDR } from '../../lib/utils'
import { calculateRABItemTotalSafe } from '../../lib/calculationService'
import type { RABItemTotalSafeInput } from '../../lib/calculationService'

interface RABCalculatorProps {
  volume: number
  unitPrice: number
  overhead?: number   // percentage 0-100
  profit?: number     // percentage 0-100
  tax?: number        // percentage 0-100, default 11
  profitBasis?: RABItemTotalSafeInput['profitBasis']
  markupSource?: RABItemTotalSafeInput['markupSource']
}

export default function RABCalculator({
  volume,
  unitPrice,
  overhead = 0,
  profit = 0,
  tax = 11,
  profitBasis = 'base_plus_overhead',
  markupSource,
}: RABCalculatorProps) {
  const result = useMemo(() => {
    return calculateRABItemTotalSafe({
      volume,
      unitPrice,
      overheadPercent: overhead,
      profitPercent: profit,
      taxPercent: tax,
      profitBasis,
      markupSource,
    })
  }, [volume, unitPrice, overhead, profit, tax, profitBasis, markupSource])

  const isBakedIn = markupSource === 'baked_in' || markupSource === 'none'

  return (
    <div className="rounded-md border p-3 bg-white shadow-sm text-sm space-y-1">
      <div className="font-medium mb-2 flex items-center gap-2">
        Price Calculator
        {isBakedIn && (
          <span className="text-xs font-bold uppercase tracking-wide text-violet-600 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5">
            baked-in
          </span>
        )}
      </div>

      <div className="flex justify-between">
        <span className="text-neutral-500">Volume × Unit Price</span>
        <span className="font-mono">{formatIDR(result.subtotal)}</span>
      </div>

      {!isBakedIn && overhead > 0 && (
        <div className="flex justify-between text-blue-700">
          <span className="text-neutral-500">Overhead ({overhead.toFixed(1)}%)</span>
          <span className="font-mono">+ {formatIDR(result.overheadAmount)}</span>
        </div>
      )}

      {!isBakedIn && profit > 0 && (
        <div className="flex justify-between text-emerald-700">
          <span className="text-neutral-500">
            Profit ({profit.toFixed(1)}%{profitBasis === 'base' ? ' on base' : ' on base+OH'})
          </span>
          <span className="font-mono">+ {formatIDR(result.profitAmount)}</span>
        </div>
      )}

      {!isBakedIn && tax > 0 && (
        <div className="flex justify-between text-orange-700">
          <span className="text-neutral-500">PPN ({tax.toFixed(1)}%)</span>
          <span className="font-mono">+ {formatIDR(result.taxAmount)}</span>
        </div>
      )}

      {isBakedIn && (
        <div className="text-xs text-violet-500 bg-violet-50 rounded px-2 py-1 mt-1">
          Harga sudah termasuk OH+Profit dari AHSP. Markup tidak diterapkan ulang.
        </div>
      )}

      <div className="flex justify-between font-semibold border-t pt-1 mt-1">
        <span>Final Total</span>
        <span className="font-mono">{formatIDR(result.finalPrice)}</span>
      </div>
    </div>
  )
}