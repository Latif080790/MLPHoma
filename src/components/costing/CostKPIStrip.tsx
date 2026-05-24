/**
 * CostKPIStrip.tsx
 * 6-card KPI surface for the Enterprise Cost Dashboard.
 * Shows: RAB Budget, RAP Planned, Actual Cost, Committed, CPI, SPI
 */

import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { formatIDR } from '@/lib/utils'
import type { CostDashboardSnapshot } from '@/services/costDashboardService'

interface CostKPIStripProps {
  snapshot: CostDashboardSnapshot | null
  loading: boolean
}

function performanceIndexColor(value: number): string {
  if (value < 0.9) return 'text-red-500'
  if (value < 0.95) return 'text-amber-500'
  return 'text-green-500'
}

export function CostKPIStrip({ snapshot, loading }: CostKPIStripProps) {
  if (loading || snapshot === null) {
    return (
      <div className="flex flex-row overflow-x-auto gap-3 flex-wrap">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            role="status"
            className="animate-pulse rounded-xl border bg-card h-24 min-w-[140px] flex-1"
          />
        ))}
      </div>
    )
  }

  const cpi = snapshot.latestCpi ?? 0
  const spi = snapshot.latestSpi ?? 0

  const cards = [
    {
      label: 'RAB Budget',
      value: formatIDR(snapshot.rabTotal),
      sub: 'Nilai Kontrak',
    },
    {
      label: 'RAP Planned',
      value: formatIDR(snapshot.rapPlanned),
      sub: 'Anggaran Pelaksanaan',
    },
    {
      label: 'Actual Cost',
      value: formatIDR(snapshot.actualCost),
      sub: `Burn Rate ${snapshot.burnRatePercent.toFixed(1)}%`,
    },
    {
      label: 'Committed',
      value: formatIDR(snapshot.committedCost),
      sub: 'Komitmen Belum Terealisasi',
    },
    {
      label: 'CPI',
      value: snapshot.latestCpi !== null ? cpi.toFixed(3) : '—',
      sub: 'Cost Performance Index',
      testId: 'kpi-cpi-value',
      colorClass: snapshot.latestCpi !== null ? performanceIndexColor(cpi) : 'text-muted-foreground',
    },
    {
      label: 'SPI',
      value: snapshot.latestSpi !== null ? spi.toFixed(3) : '—',
      sub: 'Schedule Performance Index',
      testId: 'kpi-spi-value',
      colorClass: snapshot.latestSpi !== null ? performanceIndexColor(spi) : 'text-muted-foreground',
    },
  ]

  return (
    <div className="flex flex-row overflow-x-auto gap-3 flex-wrap">
      {cards.map((card) => (
        <Card key={card.label} className="min-w-[140px] flex-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">{card.label}</p>
            <p
              className={`text-lg font-semibold leading-tight ${card.colorClass ?? ''}`}
              data-testid={card.testId}
            >
              {card.value}
            </p>
            {card.sub && (
              <p className="text-xs text-muted-foreground mt-1">{card.sub}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
