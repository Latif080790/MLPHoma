/**
 * RapDistributionChart.tsx
 * Chart to visualize monthly RAP distribution with baseline overlay.
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import {
  ResponsiveContainer,
  ComposedChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  Line,
} from 'recharts'
import { RapPlanItem } from './RapUtils'

/** Props for RapDistributionChart */
export interface RapDistributionChartProps {
  plan: RapPlanItem[]
  baseline?: RapPlanItem[] | null
  title?: string
}

/** Transform plan to chart data sorted by period */
function toChartRows(plan: RapPlanItem[], baseline?: RapPlanItem[] | null) {
  const sorted = [...plan].sort((a, b) => String(a.period).localeCompare(String(b.period)))
  const baseMap = new Map((baseline || []).map((p) => [String(p.period), p.planned]))
  return sorted.map((p) => ({
    period: p.period,
    planned: p.planned,
    baseline: baseMap.get(String(p.period)),
  }))
}

/** RapDistributionChart component */
export const RapDistributionChart: React.FC<RapDistributionChartProps> = ({ plan, baseline, title }) => {
  const rows = toChartRows(plan, baseline)
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title || 'RAP Distribution'}</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={360}>
          <ComposedChart data={rows}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis dataKey="period" tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => Number(v).toLocaleString('id-ID')} />
            <Tooltip
              formatter={(v: unknown) => (typeof v === 'number' ? v.toLocaleString('id-ID') : String(v))}
              labelFormatter={(l: unknown) => `Period: ${l}`}
            />
            <Legend />
            <Bar dataKey="planned" name="Planned" fill="#3b82f6" />
            {baseline && baseline.length > 0 && (
              <Line
                type="monotone"
                dataKey="baseline"
                name="Baseline"
                stroke="#f59e0b"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}