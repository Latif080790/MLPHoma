/**
 * AHSP.tsx
 * Page shell for AHSP (Analisis Harga Satuan Pekerjaan) module.
 * Composes: stats strip → catalog → analytics collapsible
 */

import React, { useState } from 'react'
import { Calculator, BarChart2, ChevronDown, ChevronUp } from 'lucide-react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { AHSPItemsTab } from '@/components/ahsp/AHSPItemsTab'
import { Button } from '@/components/ui/button'
import { useAHSPStore } from '@/store/ahspStore'
import { formatIDR } from '@/lib/utils'

// Lazy-load heavy analytics (recharts) only when expanded
const BenchmarkingDashboard = React.lazy(() =>
  import('@/components/ahsp/analytics').then(m => ({ default: m.BenchmarkingDashboard }))
)

export default function AHSP() {
  const [showAnalytics, setShowAnalytics] = useState(false)
  const { ahspItems, resources, totalAhspCount, totalResourceCount } = useAHSPStore()

  // Compact horizontal strip stats
  const totalAHSP = totalAhspCount || ahspItems.length
  const totalRes = totalResourceCount || resources.length
  const avgPrice = totalAHSP > 0
    ? ahspItems.reduce((acc, item) => acc + (item.finalPrice || 0), 0) / totalAHSP
    : 0
  const categories = new Set(ahspItems.map(item => item.category)).size

  return (
    <div className="space-y-4 density-compact">
      <ModuleHeader
        icon={<Calculator size={18} />}
        title="AHSP"
        description="Analisis Harga Satuan Pekerjaan — Katalog harga satuan pekerjaan & resource"
        accent="indigo"
      />

      {/* ── Compact horizontal stats strip ─────────────────────────── */}
      <div className="flex flex-wrap items-center gap-0 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white px-1 py-1 shadow-sm dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900">
        <StatPill label="Item AHSP" value={totalAHSP.toString()} sub={`${ahspItems.filter(i => i.isActive).length} aktif`} />
        <StatPill label="Resources" value={totalRes.toString()} sub={`${resources.filter(r => r.isActive).length} aktif`} />
        <StatPill label="Harga Rata-rata" value={formatIDR(avgPrice)} sub="per item" />
        <StatPill label="Kategori" value={categories.toString()} sub="kategori unik" />
        <div className="ml-auto px-3">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs text-slate-500 hover:text-slate-800"
            onClick={() => setShowAnalytics(v => !v)}
          >
            <BarChart2 size={14} />
            Analytics
            {showAnalytics ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </Button>
        </div>
      </div>

      {/* ── Analytics panel (collapsible) ──────────────────────────── */}
      {showAnalytics && (
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <React.Suspense fallback={
            <div className="flex items-center justify-center py-8 text-sm text-slate-400">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 mr-2" />
              Memuat analytics...
            </div>
          }>
            <BenchmarkingDashboard />
          </React.Suspense>
        </div>
      )}

      {/* ── Main AHSP catalog ──────────────────────────────────────── */}
      <AHSPItemsTab />
    </div>
  )
}

// ─── StatPill ───────────────────────────────────────────────────────────────
function StatPill({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="flex flex-col px-4 py-1.5 min-w-[120px]">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className="text-base font-bold text-slate-800 dark:text-slate-100 leading-tight">{value}</span>
      <span className="text-xs text-slate-400">{sub}</span>
    </div>
  )
}
