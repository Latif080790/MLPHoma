/**
 * ModulePreview.tsx
 *
 * Small preview panel that provides quick insights for each module.
 * - Uses Recharts for simple visualizations where appropriate.
 * - Reads module-specific configuration and renders key metrics.
 */

import React from 'react'
import type { FC } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, BarChart, Bar, CartesianGrid } from 'recharts'

/**
 * Props for ModulePreview
 */
interface ModulePreviewProps {
  /** Module key (e.g. 'rab', 'rap', 'curvas') */
  moduleKey: string
  /** The module-specific configuration object */
  config: unknown
  /** Full feature config (optional) */
  fullConfig?: unknown
}

/**
 * makeMockSeries
 *
 * Generate a small mock series for charts based on numeric seeds.
 *
 * @param seed - numeric seed to vary series
 * @returns array of {name, value}
 */
function makeMockSeries(seed = 5) {
  const len = 6
  const out: Array<{ name: string; value: number }> = []
  for (let i = 0; i < len; i++) {
    const base = Math.max(1, seed * (1 + i / 6))
    out.push({ name: `P${i + 1}`, value: Math.round(base * (i + 1) * (0.8 + (seed % 3) * 0.1)) })
  }
  return out
}

/**
 * ModulePreview
 *
 * Presents a small, fast visualization & stats for the given module config.
 */
const ModulePreview: FC<ModulePreviewProps> = ({ moduleKey, config, fullConfig: _fullConfig }) => {
  if (!config) {
    return <div className="text-sm text-neutral-500">No configuration available for this module.</div>
  }

  // Cast config to a record for safe property access
  const cfg = config as Record<string, unknown>

  // Helpers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const numberOr = (v: any, fallback = 0) => (typeof v === 'number' ? v : fallback)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const percentOr = (v: any, fallback = 0) => (typeof v === 'number' ? `${v}%` : `${fallback}%`)

  switch (moduleKey) {
    case 'projectManagement':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Project Management</div>
          <div className="grid grid-cols-1 gap-2">
            <div className="text-sm"><strong>Name:</strong> {(cfg as any)?.meta?.name ?? '—'}</div>
            <div className="text-sm"><strong>Stages:</strong> {((cfg as any)?.workflow?.stages || []).join(' › ') || '—'}</div>
            <div className="text-sm"><strong>KPIs:</strong> Budget Var {numberOr((cfg as any)?.kpis?.budgetVarianceTolerancePct, 5)}%</div>
          </div>
        </div>
      )

    case 'wbs':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">WBS Settings</div>
          <div className="text-sm"><strong>Max Levels:</strong> {(cfg as any)?.codeRules?.maxLevels ?? '—'}</div>
          <div className="text-sm"><strong>Auto-number:</strong> {(cfg as any)?.codeRules?.autoNumbering ? 'Yes' : 'No'}</div>
          <div className="text-sm"><strong>Show Est. Hours:</strong> {(cfg as any)?.tree?.showEstimatedHours ? 'Yes' : 'No'}</div>
        </div>
      )

    case 'ahsp':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">AHSP (Unit Price)</div>
          <div className="text-sm"><strong>Currency:</strong> {(cfg as any)?.pricing?.currency ?? 'IDR'}</div>
          <div className="text-sm"><strong>Include equipment:</strong> {(cfg as any)?.pricing?.includeEquipmentCost ? 'Yes' : 'No'}</div>
          <div className="text-sm"><strong>Rounding:</strong> {(cfg as any)?.pricing?.rounding?.enabled ? `to ${(cfg as any)?.pricing?.rounding?.toNearest}` : 'No'}</div>
        </div>
      )

    case 'rab':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">RAB (Estimation)</div>
          <div className="text-sm"><strong>Overhead:</strong> {percentOr((cfg as any)?.calculation?.includeOverheadPct, 10)}</div>
          <div className="text-sm"><strong>Profit:</strong> {percentOr((cfg as any)?.calculation?.includeProfitPct, 8)}</div>
          <div className="text-sm"><strong>Tax:</strong> {percentOr((cfg as any)?.calculation?.includeTaxPct, 11)}</div>
        </div>
      )

    case 'timeline':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Timeline / Gantt</div>
          <div className="text-sm"><strong>Calendar:</strong> {(cfg as any)?.scheduling?.workCalendar ?? '5day'}</div>
          <div className="text-sm"><strong>Auto CPM:</strong> {(cfg as any)?.scheduling?.autoCalculateCriticalPath ? 'Yes' : 'No'}</div>
        </div>
      )

    case 'rap': {
      const pts = makeMockSeries((cfg as any)?.distribution?.minPeriodAllocationPct ?? 5)
      return (
        <div style={{ height: 160 }}>
          <div className="mb-2 text-xs text-neutral-600">RAP Distribution (preview)</div>
          <ResponsiveContainer width="100%" height={110}>
            <BarChart data={pts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#60a5fa" />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs mt-2 text-neutral-600">Default: {(cfg as any)?.distribution?.defaultPeriod ?? 'monthly'}</div>
        </div>
      )
    }

    case 'curvas': {
      const series = makeMockSeries(Math.round(((cfg as any)?.metrics?.performanceWindowDays ?? 30) / 10))
      return (
        <div style={{ height: 160 }}>
          <div className="mb-2 text-xs text-neutral-600">Curva-S (sample)</div>
          <ResponsiveContainer width="100%" height={110}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#34d399" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#34d399" stopOpacity={0.2} />
                </linearGradient>
              </defs>
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke="#10b981" fill="url(#grad)" />
            </AreaChart>
          </ResponsiveContainer>
          <div className="text-xs mt-2 text-neutral-600">SPI tol: {(cfg as any)?.metrics?.spiTolerance ?? 0.95}</div>
        </div>
      )
    }

    case 'resources':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Resource Planning</div>
          <div className="text-sm"><strong>Bucket days:</strong> {(cfg as any)?.histogram?.bucketSizeDays ?? 7}</div>
          <div className="text-sm"><strong>Lead time:</strong> {(cfg as any)?.procurement?.leadTimeDaysDefault ?? 14} days</div>
        </div>
      )

    case 'cashflow':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Cash Flow</div>
          <div className="text-sm"><strong>Period:</strong> {(cfg as any)?.projection?.cashflowPeriod ?? 'monthly'}</div>
          <div className="text-sm"><strong>Retention:</strong> {percentOr((cfg as any)?.projection?.includeRetentionPct, 5)}</div>
          <div className="text-sm"><strong>Payment terms:</strong> {(cfg as any)?.projection?.paymentTermsDays ?? 30} days</div>
        </div>
      )

    case 'progress':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Progress Tracking</div>
          <div className="text-sm"><strong>Photo upload:</strong> {(cfg as any)?.capture?.allowPhotoUpload ? 'Enabled' : 'Disabled'}</div>
          <div className="text-sm"><strong>Auto sync (mins):</strong> {(cfg as any)?.autoUpdate?.syncIntervalMinutes ?? 60}</div>
        </div>
      )

    case 'reporting':
      return (
        <div>
          <div className="mb-2 text-xs text-neutral-600">Reporting</div>
          <div className="text-sm"><strong>Widgets:</strong> {((cfg as any)?.dashboard?.widgets || []).length || 0}</div>
          <div className="text-sm"><strong>Excel export:</strong> {(cfg as any)?.exports?.enableExcelExport ? 'Yes' : 'No'}</div>
          <div className="text-sm"><strong>PDF export:</strong> {(cfg as any)?.exports?.enablePdfExport ? 'Yes' : 'No'}</div>
        </div>
      )

    default:
      return <div className="text-sm text-neutral-600">No preview available for this module.</div>
  }
}

export default ModulePreview
