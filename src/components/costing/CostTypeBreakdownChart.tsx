/**
 * CostTypeBreakdownChart.tsx
 * Recharts donut chart + legend table for cost type breakdown.
 */

import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Label } from 'recharts'
import { formatIDR } from '@/lib/utils'
import type { CostTypeBreakdown } from '@/services/costDashboardService'

interface CostTypeBreakdownChartProps {
  breakdown: CostTypeBreakdown
  totalRab: number
}

const COLORS: Record<string, string> = {
  material:  '#3b82f6',
  labor:     '#10b981',
  equipment: '#f59e0b',
  subcon:    '#8b5cf6',
  overhead:  '#6b7280',
}

const LABELS: Record<string, string> = {
  material:  'Material',
  labor:     'Tenaga Kerja',
  equipment: 'Peralatan',
  subcon:    'Subkontraktor',
  overhead:  'Overhead',
}

export function CostTypeBreakdownChart({ breakdown, totalRab }: CostTypeBreakdownChartProps) {
  const allSlices = (Object.keys(LABELS) as Array<keyof CostTypeBreakdown>).map((key) => ({
    key,
    name: LABELS[key],
    value: breakdown[key] ?? 0,
    color: COLORS[key],
  }))

  const slices = allSlices.filter((s) => s.value > 0)

  if (slices.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Belum ada data breakdown biaya
      </div>
    )
  }

  const total = slices.reduce((s, x) => s + x.value, 0) || 1

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={180}>
        <PieChart>
          <Pie
            data={slices}
            dataKey="value"
            nameKey="name"
            innerRadius={52}
            outerRadius={78}
            paddingAngle={2}
          >
            <Label
              value={formatIDR(total)}
              position="center"
              style={{ fontSize: '11px', fontWeight: 700, fill: '#1e293b', fontFamily: 'monospace' }}
            />
            {slices.map((entry) => (
              <Cell key={entry.key} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => formatIDR(value)}
          />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend table */}
      <div className="space-y-1">
        {slices.map((entry) => {
          const pct = ((entry.value / total) * 100).toFixed(1)
          return (
            <div key={entry.key} className="flex items-center gap-2 text-sm">
              <span
                className="inline-block w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: entry.color }}
              />
              <span className="flex-1 text-muted-foreground">{entry.name}</span>
              <span className="text-xs text-muted-foreground w-12 text-right">{pct}%</span>
              <span className="text-xs font-medium w-32 text-right">{formatIDR(entry.value)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
