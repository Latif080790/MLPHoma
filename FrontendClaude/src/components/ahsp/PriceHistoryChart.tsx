/**
 * PriceHistoryChart.tsx
 * Chart component for displaying AHSP price history over time.
 * Stub implementation — replace with a full chart when needed.
 */

import React from 'react'
import type { PriceHistory } from '@/types/ahsp'

interface PriceHistoryChartProps {
  data: PriceHistory[]
  height?: number
}

/**
 * PriceHistoryChart
 * Renders a simple visual representation of price history.
 * Replace with Recharts or similar library for production use.
 */
export function PriceHistoryChart({ data, height = 200 }: PriceHistoryChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground"
        style={{ height }}
      >
        No price history data available
      </div>
    )
  }

  const maxPrice = Math.max(...data.map((d) => d.newPrice || 0))

  return (
    <div className="space-y-2" style={{ minHeight: height }}>
      <div className="flex items-end gap-1" style={{ height: height - 40 }}>
        {data.map((entry, idx) => {
          const barHeight = maxPrice > 0 ? ((entry.newPrice || 0) / maxPrice) * 100 : 0
          return (
            <div
              key={entry.id || idx}
              className="flex-1 bg-blue-500/80 dark:bg-blue-400/80 rounded-t transition-all hover:bg-blue-600 dark:hover:bg-blue-500"
              style={{ height: `${barHeight}%`, minWidth: 8 }}
              title={`${entry.changeType}: Rp ${(entry.newPrice || 0).toLocaleString('id-ID')}`}
            />
          )
        })}
      </div>
      <div className="text-xs text-center text-muted-foreground">
        {data.length} price change{data.length !== 1 ? 's' : ''} recorded
      </div>
    </div>
  )
}
