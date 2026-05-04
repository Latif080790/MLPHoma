/**
 * SummaryCard.tsx
 *
 * Compact summary card showing totals and simple status badges.
 */

import React from 'react'

/**
 * SummaryCardProps
 * Props for SummaryCard.
 */
export interface SummaryCardProps {
  totalOutflow?: number
  totalInflow?: number
  endingBalance?: number
  minBalance?: number
  hasDeficit?: boolean
  bufferAmount?: number
}

/**
 * SummaryCard
 * Display a small grid of KPIs.
 */
export const SummaryCard: React.FC<SummaryCardProps> = ({ totalOutflow = 0, totalInflow = 0, endingBalance = 0, minBalance = 0, hasDeficit = false, bufferAmount = 0 }) => {
  return (
    <div className="grid gap-4 md:grid-cols-4 rounded-md border p-3 text-sm dark:border-neutral-800">
      <div>
        <div className="text-neutral-500 text-xs">Total Outflow</div>
        <div className="font-medium text-blue-700 dark:text-blue-300">Rp {Math.round(totalOutflow).toLocaleString('id-ID')}</div>
      </div>
      <div>
        <div className="text-neutral-500 text-xs">Total Inflow</div>
        <div className="font-medium text-blue-700 dark:text-blue-300">Rp {Math.round(totalInflow).toLocaleString('id-ID')}</div>
      </div>
      <div>
        <div className="text-neutral-500 text-xs">Ending Balance</div>
        <div className={`font-medium ${endingBalance < 0 ? 'text-red-600' : 'text-green-700'}`}>Rp {Math.round(endingBalance).toLocaleString('id-ID')}</div>
      </div>
      <div>
        <div className="text-neutral-500 text-xs">Min Balance</div>
        <div className={minBalance < 0 ? 'text-red-600 font-medium' : bufferAmount > 0 && minBalance < bufferAmount ? 'text-amber-600 font-medium' : 'text-green-700 font-medium'}>
          Rp {Math.round(minBalance).toLocaleString('id-ID')}
        </div>
      </div>
      {hasDeficit && (
        <div className="md:col-span-4 mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950 dark:text-red-300">
          Deficit detected in one or more periods. Consider adjusting billing or DP.
        </div>
      )}
    </div>
  )
}

export default SummaryCard