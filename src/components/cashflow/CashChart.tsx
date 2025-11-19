/**
 * CashChart.tsx
 *
 * Chart component using Recharts to display cumulative inflow/outflow and balance.
 */

import React from 'react'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Area } from 'recharts'

/**
 * ChartRow
 * Row provided to the chart.
 */
export interface ChartRow {
  period: string
  outflow: number
  inflow: number
  cumOutflow: number
  cumInflow: number
  balance: number
  balanceNeg?: number
  balanceA?: number | null
  balanceB?: number | null
  cumInA?: number | null
  cumOutA?: number | null
  cumInB?: number | null
  cumOutB?: number | null
}

/**
 * CashChartProps
 * Props for the chart component.
 */
export interface CashChartProps {
  rows: ChartRow[]
  bufferAmount?: number
  compareAName?: string | null
  compareBName?: string | null
  showCompareACumIn?: boolean
  showCompareACumOut?: boolean
  showCompareBCumIn?: boolean
  showCompareBCumOut?: boolean
}

/**
 * CashChart
 * Visualize cumulative in/out and balance with optional compare series overlays.
 */
export const CashChart: React.FC<CashChartProps> = ({ rows, bufferAmount = 0, compareAName, compareBName, showCompareACumIn, showCompareACumOut, showCompareBCumIn, showCompareBCumOut }) => {
  return (
    <ResponsiveContainer width="100%" height={360}>
      <LineChart data={rows}>
        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
        <YAxis tick={{ fontSize: 12 }} tickFormatter={(v: any) => (typeof v === 'number' ? v.toLocaleString('id-ID') : v)} />
        <Tooltip formatter={(v: any) => (typeof v === 'number' ? v.toLocaleString('id-ID') : String(v))} labelFormatter={(l: any) => `Period: ${l}`} />
        <Legend />
        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
        {bufferAmount > 0 && <ReferenceLine y={bufferAmount} stroke="#f59e0b" strokeDasharray="6 4" />}

        <Area type="monotone" dataKey="balanceNeg" name="Balance (Neg)" stroke="transparent" fill="#fecaca" fillOpacity={0.9} isAnimationActive={false} />

        <Line type="monotone" dataKey="cumOutflow" name="Cum Outflow" stroke="#ef4444" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="cumInflow" name="Cum Inflow" stroke="#10b981" strokeWidth={2} dot={false} />
        <Line type="monotone" dataKey="balance" name="Balance" stroke="#3b82f6" strokeWidth={2} dot={false} />

        {compareAName && <Line type="monotone" dataKey="balanceA" name={`Balance (A: ${compareAName})`} stroke="#a855f7" strokeDasharray="6 4" strokeWidth={2} dot={false} connectNulls />}
        {compareBName && <Line type="monotone" dataKey="balanceB" name={`Balance (B: ${compareBName})`} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} dot={false} connectNulls />}

        {compareAName && showCompareACumIn && <Line type="monotone" dataKey="cumInA" name={`Cum Inflow (A: ${compareAName})`} stroke="#8b5cf6" strokeDasharray="2 6" strokeWidth={1.5} dot={false} connectNulls />}
        {compareAName && showCompareACumOut && <Line type="monotone" dataKey="cumOutA" name={`Cum Outflow (A: ${compareAName})`} stroke="#d946ef" strokeDasharray="2 6" strokeWidth={1.5} dot={false} connectNulls />}

        {compareBName && showCompareBCumIn && <Line type="monotone" dataKey="cumInB" name={`Cum Inflow (B: ${compareBName})`} stroke="#fb923c" strokeDasharray="2 6" strokeWidth={1.5} dot={false} connectNulls />}
        {compareBName && showCompareBCumOut && <Line type="monotone" dataKey="cumOutB" name={`Cum Outflow (B: ${compareBName})`} stroke="#fbbf24" strokeDasharray="2 6" strokeWidth={1.5} dot={false} connectNulls />}
      </LineChart>
    </ResponsiveContainer>
  )
}

export default CashChart