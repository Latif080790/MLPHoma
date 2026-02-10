/**
 * src/components/rab/RABCalculator.tsx
 *
 * RAB price calculator component.
 * Computes subtotal, overhead, profit, tax and final total for a RAB item.
 * Currently a placeholder — calculation logic lives inline in RABTable and RAB page.
 */

import React, { useMemo } from 'react'
import { formatIDR } from '../../lib/utils'

interface RABCalculatorProps {
  volume: number
  unitPrice: number
  overhead?: number
  profit?: number
  tax?: number
}

export default function RABCalculator({
  volume,
  unitPrice,
  overhead = 0,
  profit = 0,
  tax = 0.11,
}: RABCalculatorProps) {
  const totals = useMemo(() => {
    const subtotal = volume * unitPrice
    const overheadAmount = subtotal * overhead
    const profitAmount = subtotal * profit
    const beforeTax = subtotal + overheadAmount + profitAmount
    const taxAmount = beforeTax * tax
    const finalTotal = beforeTax + taxAmount
    return { subtotal, overheadAmount, profitAmount, taxAmount, finalTotal }
  }, [volume, unitPrice, overhead, profit, tax])

  return (
    <div className="rounded-md border p-3 bg-white shadow-sm text-sm space-y-1">
      <div className="font-medium mb-2">Price Calculator</div>
      <div className="flex justify-between">
        <span className="text-neutral-500">Volume × Unit Price</span>
        <span>{formatIDR(totals.subtotal)}</span>
      </div>
      {overhead > 0 && (
        <div className="flex justify-between">
          <span className="text-neutral-500">Overhead ({(overhead * 100).toFixed(1)}%)</span>
          <span>{formatIDR(totals.overheadAmount)}</span>
        </div>
      )}
      {profit > 0 && (
        <div className="flex justify-between">
          <span className="text-neutral-500">Profit ({(profit * 100).toFixed(1)}%)</span>
          <span>{formatIDR(totals.profitAmount)}</span>
        </div>
      )}
      {tax > 0 && (
        <div className="flex justify-between">
          <span className="text-neutral-500">Tax ({(tax * 100).toFixed(1)}%)</span>
          <span>{formatIDR(totals.taxAmount)}</span>
        </div>
      )}
      <div className="flex justify-between font-semibold border-t pt-1 mt-1">
        <span>Final Total</span>
        <span>{formatIDR(totals.finalTotal)}</span>
      </div>
    </div>
  )
}