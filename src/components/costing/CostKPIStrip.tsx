import React from 'react'
import { formatIDR } from '@/lib/utils'
import type { CostDashboardSnapshot } from '@/services/costDashboardService'

interface CostKPIStripProps {
  snapshot: CostDashboardSnapshot | null
  loading: boolean
  error?: string | null
}

function performanceColor(v: number): string {
  if (v < 0.9) return 'text-red-500'
  if (v < 0.95) return 'text-amber-500'
  return 'text-emerald-600'
}

function Delta({ v }: { v: number }) {
  const d = (v - 1).toFixed(2)
  const pos = v >= 1
  return (
    <span className={`text-xs font-mono font-semibold ${pos ? 'text-emerald-500' : 'text-red-500'}`}>
      {pos ? '▲' : '▼'}{Math.abs(Number(d))}
    </span>
  )
}

export function CostKPIStrip({ snapshot, loading, error }: CostKPIStripProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 lg:grid-cols-6 rounded-lg border border-border overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} role="status"
            className={`animate-pulse bg-muted/30 h-[68px] ${i > 0 ? 'border-l border-border' : ''}`} />
        ))}
      </div>
    )
  }

  if (snapshot === null) {
    return (
      <div className="rounded-lg border border-border bg-muted/30 flex items-center gap-2 px-4 h-[68px] text-xs text-muted-foreground">
        {error
          ? <span className="text-red-500">Gagal memuat data: {error}</span>
          : <span>Tidak ada data snapshot tersedia.</span>
        }
      </div>
    )
  }

  const cpi = snapshot.latestCpi ?? 0
  const spi = snapshot.latestSpi ?? 0

  const cells = [
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
      sub: `Burn ${snapshot.burnRatePercent.toFixed(1)}%`,
      warn: snapshot.burnRatePercent > 90,
    },
    {
      label: 'Committed',
      value: formatIDR(snapshot.committedCost),
      sub: 'Belum Terealisasi',
    },
    {
      label: 'CPI',
      value: snapshot.latestCpi !== null ? cpi.toFixed(3) : '—',
      sub: 'Cost Performance',
      colorClass: snapshot.latestCpi !== null ? performanceColor(cpi) : undefined,
      delta: snapshot.latestCpi !== null ? <Delta v={cpi} /> : null,
      testId: 'kpi-cpi-value',
    },
    {
      label: 'SPI',
      value: snapshot.latestSpi !== null ? spi.toFixed(3) : '—',
      sub: 'Schedule Performance',
      colorClass: snapshot.latestSpi !== null ? performanceColor(spi) : undefined,
      delta: snapshot.latestSpi !== null ? <Delta v={spi} /> : null,
      testId: 'kpi-spi-value',
    },
  ]

  return (
    <div className="grid grid-cols-3 lg:grid-cols-6 rounded-lg border border-border overflow-hidden bg-card">
      {cells.map((cell, i) => (
        <div
          key={cell.label}
          className={`px-3 py-3 ${i > 0 ? 'border-l border-border' : ''}`}
        >
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1.5">
            {cell.label}
          </p>
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <p
              className={`text-sm font-bold font-mono leading-tight ${
                cell.colorClass ?? (cell.warn ? 'text-amber-600' : 'text-muted-foreground')
              }`}
              data-testid={cell.testId}
            >
              {cell.value}
            </p>
            {cell.delta}
          </div>
          <p className="text-xs text-muted-foreground mt-1 leading-none">{cell.sub}</p>
        </div>
      ))}
    </div>
  )
}
