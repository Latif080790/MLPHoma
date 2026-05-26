import { useMemo } from 'react'
import { Shield, TrendingUp, AlertTriangle, Info } from 'lucide-react'
import { formatIDR } from '@/lib/utils'
import { useForecastStore } from '@/store/costForecastStore'
import { useProjectStore } from '@/store/projectStore'

interface EVMGuardPanelProps {
  projectId: string | null
  className?: string
}

export function EVMGuardPanel({ projectId, className }: EVMGuardPanelProps) {
  const snapshot = useForecastStore(s => s.snapshot)
  const project = useProjectStore(s => (projectId ? s.projects[projectId] : null))

  const evm = useMemo(() => {
    if (!snapshot) return null
    const cpi = snapshot.latestCpi ?? null
    const spi = snapshot.latestSpi ?? null
    const budget = project?.budget ?? 0
    // EAC = AC / CPI when both are available
    const eac =
      snapshot.latestAc !== null && cpi !== null && cpi > 0
        ? snapshot.latestAc / cpi
        : null
    return { cpi, spi, eac, budget }
  }, [snapshot, project])

  const alerts = useMemo(() => {
    if (!evm) return []
    const list: { sev: 'warning' | 'info'; msg: string; detail: string }[] = []
    if (evm.cpi !== null && evm.cpi < 1) {
      list.push({
        sev: 'warning',
        msg: `CPI ${evm.cpi.toFixed(2)} — Over Budget`,
        detail: 'Cost lebih tinggi dari nilai kerja yang dihasilkan.',
      })
    }
    if (evm.spi !== null && evm.spi < 0.9) {
      list.push({
        sev: 'warning',
        msg: `SPI ${evm.spi.toFixed(2)} — Schedule Slip`,
        detail: 'Progress lebih lambat dari rencana.',
      })
    }
    if (evm.eac !== null && evm.budget > 0 && evm.eac > evm.budget) {
      list.push({
        sev: 'warning',
        msg: 'EAC melebihi Budget',
        detail: `Estimasi akhir ${formatIDR(evm.eac)} > Budget ${formatIDR(evm.budget)}`,
      })
    }
    if (list.length === 0) {
      list.push({ sev: 'info', msg: 'Semua indikator normal', detail: 'CPI & SPI dalam batas aman.' })
    }
    return list
  }, [evm])

  return (
    <div className={`bg-white border-l border-slate-200 flex flex-col overflow-hidden h-full ${className ?? ''}`}>
      {/* Header */}
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center gap-1.5 flex-shrink-0">
        <Shield size={12} className="text-blue-500" />
        <span className="text-xs font-bold uppercase tracking-wider text-slate-600">
          EVM &amp; Budget Guard
        </span>
      </div>

      <div className="overflow-y-auto flex-1 p-4 space-y-4">
        {/* EVM Metrics */}
        {evm ? (
          <div className="space-y-0">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
              EVM Dashboard
            </div>
            {[
              {
                label: 'CPI',
                value: evm.cpi?.toFixed(2) ?? '—',
                sub: 'Cost Performance',
                good: evm.cpi === null || evm.cpi >= 1,
              },
              {
                label: 'SPI',
                value: evm.spi?.toFixed(2) ?? '—',
                sub: 'Schedule Performance',
                good: evm.spi === null || evm.spi >= 1,
              },
              {
                label: 'EAC',
                value: evm.eac ? formatIDR(evm.eac) : '—',
                sub: 'Estimate at Completion',
                good: evm.eac === null || evm.eac <= evm.budget,
              },
            ].map(({ label, value, sub, good }) => (
              <div
                key={label}
                className="flex items-center justify-between py-2 border-b border-slate-100"
              >
                <div>
                  <div className="text-xs font-bold text-slate-700">{label}</div>
                  <div className="text-xs text-slate-400">{sub}</div>
                </div>
                <div
                  className={`font-mono font-bold text-sm ${good ? 'text-emerald-600' : 'text-red-500'}`}
                >
                  {value}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-400">
            <TrendingUp size={24} className="mx-auto mb-2 opacity-30" />
            <div className="text-xs">Belum ada data EVM</div>
            <div className="text-xs mt-1 text-slate-300">Isi RAP untuk melihat EVM</div>
          </div>
        )}

        {/* Alert Center */}
        <div className="pt-2">
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
            Alert Center
          </div>
          {alerts.map((a, i) => (
            <div
              key={i}
              className={`rounded-lg p-3 mb-2 border text-xs ${
                a.sev === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div
                className={`font-semibold flex items-center gap-1.5 ${
                  a.sev === 'warning' ? 'text-amber-800' : 'text-blue-800'
                }`}
              >
                {a.sev === 'warning' ? <AlertTriangle size={11} /> : <Info size={11} />}
                {a.msg}
              </div>
              <div
                className={`mt-0.5 ${a.sev === 'warning' ? 'text-amber-600' : 'text-blue-600'}`}
              >
                {a.detail}
              </div>
            </div>
          ))}
        </div>

        {/* Budget utilization bar */}
        {evm && evm.budget > 0 && snapshot && (
          <div className="pt-2">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2">
              Budget Utilization
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200 space-y-2">
              {(
                [
                  {
                    label: 'RAB vs Budget',
                    pct: Math.round((snapshot.rabTotal / evm.budget) * 100),
                    color: 'bg-blue-500',
                  },
                  {
                    label: 'Actual Spent',
                    pct: Math.round((snapshot.actualCost / evm.budget) * 100),
                    color: 'bg-emerald-500',
                  },
                ] as const
              ).map(g => (
                <div key={g.label}>
                  <div className="flex justify-between text-xs text-slate-500 mb-1">
                    <span>{g.label}</span>
                    <span className="font-mono font-bold">{g.pct}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${g.color}`}
                      style={{ width: `${Math.min(g.pct, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
