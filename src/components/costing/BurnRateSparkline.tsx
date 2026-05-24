/**
 * BurnRateSparkline.tsx
 * Mini area chart (sparkline) showing AC and EV over time.
 */

import React from 'react'
import {
  AreaChart,
  Area,
  XAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatIDR } from '@/lib/utils'

interface SparklineItem {
  snapshot_date: string
  ac: number
  ev: number
}

interface BurnRateSparklineProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  history: any[]
  limit?: number
}

function formatDateLabel(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    const dd = String(d.getDate()).padStart(2, '0')
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    return `${dd}/${mm}`
  } catch {
    return dateStr
  }
}

export function BurnRateSparkline({ history, limit = 12 }: BurnRateSparklineProps) {
  const data = (history || []).slice(-limit).map((m: SparklineItem) => ({
    date: formatDateLabel(m.snapshot_date),
    AC: Number(m.ac),
    EV: Number(m.ev),
  }))

  if (data.length < 2) {
    return (
      <div className="flex items-center justify-center h-16 text-xs text-muted-foreground">
        Data tidak cukup untuk sparkline
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={64}>
      <AreaChart data={data} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
        <defs>
          {/* Note: gradient ids are page-scoped; uniquify if multiple instances render simultaneously */}
          <linearGradient id="sparkAC" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="sparkEV" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="date" hide />
        <Tooltip
          contentStyle={{ fontSize: '11px' }}
          formatter={(value: number) => formatIDR(value)}
        />
        <Area
          type="monotone"
          dataKey="AC"
          stroke="#ef4444"
          strokeWidth={1.5}
          fill="url(#sparkAC)"
          dot={false}
        />
        <Area
          type="monotone"
          dataKey="EV"
          stroke="#10b981"
          strokeWidth={1.5}
          fill="url(#sparkEV)"
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
