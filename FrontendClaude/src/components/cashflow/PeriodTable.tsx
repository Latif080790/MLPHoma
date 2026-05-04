/**
 * PeriodTable.tsx
 *
 * Simple table to display per-period cashflow rows with status badges.
 */

import React from 'react'

/**
 * CashRow
 * Row structure used by the table.
 */
export interface CashRow {
  period: string
  outflow: number
  inflow: number
  cumOutflow: number
  cumInflow: number
  balance: number
}

/**
 * PeriodTableProps
 * Props for the table component.
 */
export interface PeriodTableProps {
  rows: CashRow[]
  bufferAmount?: number
}

/**
 * PeriodTable
 * Render a responsive table with per-period numbers and status badge.
 */
export const PeriodTable: React.FC<PeriodTableProps> = ({ rows, bufferAmount = 0 }) => {
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[720px]">
        <div className="grid grid-cols-7 border-b bg-neutral-50 p-2 text-sm font-medium dark:border-neutral-800 dark:bg-neutral-900">
          <div>Period</div>
          <div className="text-right">Outflow</div>
          <div className="text-right">Inflow</div>
          <div className="text-right">Cum Outflow</div>
          <div className="text-right">Cum Inflow</div>
          <div className="text-right">Balance</div>
          <div className="text-right">Status</div>
        </div>

        {rows.map((r) => {
          const isDeficit = r.balance < 0
          const isBelowBuffer = !isDeficit && bufferAmount > 0 && r.balance < bufferAmount
          return (
            <div key={r.period} className="grid grid-cols-7 border-b p-2 text-sm last:border-b-0 dark:border-neutral-800">
              <div>{r.period}</div>
              <div className="text-right">Rp {r.outflow.toLocaleString('id-ID')}</div>
              <div className="text-right">Rp {r.inflow.toLocaleString('id-ID')}</div>
              <div className="text-right">Rp {r.cumOutflow.toLocaleString('id-ID')}</div>
              <div className="text-right">Rp {r.cumInflow.toLocaleString('id-ID')}</div>
              <div className={`text-right ${isDeficit ? 'text-red-600' : isBelowBuffer ? 'text-amber-600' : ''}`}>Rp {r.balance.toLocaleString('id-ID')}</div>
              <div className="flex items-center justify-end">
                {isDeficit ? (
                  <span className="rounded bg-red-600 px-2 py-0.5 text-xs text-white">Deficit</span>
                ) : isBelowBuffer ? (
                  <span className="rounded bg-amber-600 px-2 py-0.5 text-xs text-white">Below Buffer</span>
                ) : (
                  <span className="rounded bg-emerald-600 px-2 py-0.5 text-xs text-white">OK</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default PeriodTable