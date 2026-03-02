/**
 * src/components/charts/CurvaSChartSimple.tsx
 *
 * Simple Curva-S (S-Curve) prototype using Recharts.
 * Expects planned (period, cumulative) and actual (period, cumulative) series.
 */

import React from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts'

interface SeriesPoint {
  period: string
  cumulative: number
}

/**
 * Props for CurvaSChartSimple
 */
export interface CurvaSChartProps {
  planned: SeriesPoint[]
  actual?: SeriesPoint[]
}

/**
 * CurvaSChartSimple component
 */
export default function CurvaSChartSimple({ planned, actual = [] }: CurvaSChartProps) {
  // Merge series by period
  const map: Record<string, Record<string, unknown>> = {}
  ;(planned || []).forEach((p) => {
    map[p.period] = { period: p.period, planned: p.cumulative }
  })
  ;(actual || []).forEach((a) => {
    if (!map[a.period]) map[a.period] = { period: a.period }
    map[a.period].actual = a.cumulative
  })
  const data = Object.values(map).sort((a, b) => a.period.localeCompare(b.period))

  return (
    <div className="rounded-md border p-2 bg-white">
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="period" />
          <YAxis tickFormatter={(v) => `${Math.round(v).toLocaleString('id-ID')}`} />
          <Tooltip formatter={(v: unknown) => (typeof v === 'number' ? v.toLocaleString('id-ID') : String(v))} />
          <Legend />
          <Line type="monotone" dataKey="planned" stroke="#2563EB" strokeWidth={2} dot />
          <Line type="monotone" dataKey="actual" stroke="#F97316" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}