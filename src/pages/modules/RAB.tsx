/**
 * RAB.tsx
 * RAB (Budget Estimation) module shell page.
 * Provides a clean layout and ensures all JSX tags are properly closed.
 */

import React, { useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Calculator, CloudUpload, Lock, MapPin, Settings2 } from 'lucide-react'
import { useRabStore } from '@/store/rabStore'
import { useProjectStore } from '@/store/projectStore'
import { useAHSPStore } from '@/store/ahspStore'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { RABTable } from '@/components/rab/RABTable'
import { formatIDR } from '@/lib/utils'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { CardSkeleton } from '@/components/common/LoadingSkeleton'
import type { RABItem } from '@/types/rab'
import { PriceDriftBanner } from '@/components/rab/PriceDriftBanner'
import { usePresence } from '@/hooks/usePresence'
import { PresenceAvatars } from '@/components/common/PresenceAvatars'
import { assertSupabase } from '@/lib/supabaseClient'
import { EVMGuardPanel } from '@/components/costing'

const EMPTY_ARRAY: RABItem[] = []

/** RAB module component */
export default function RAB({ embedded = false }: { embedded?: boolean }) {
  const syncProjectToSupabase = useRabStore(s => s.syncProjectToSupabase)
  const fetchRabFromSupabase = useRabStore(s => s.fetchItems)
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const currentProject = useProjectStore(s => activeProjectId ? s.projects[activeProjectId] : null)
  
  // Real-time Presence for this module
  const { peers } = usePresence(activeProjectId ?? null, 'RAB Estimator')
  const otherPeers = peers.filter(p => p.user_id !== useAuthStore.getState().user?.id)

  const updateProject = useProjectStore(s => s.updateProject)
  const items = useRabStore(s => currentProject ? s.getItems(currentProject.id) : EMPTY_ARRAY)
  const isLocked = useRabStore(s => currentProject ? s.isLocked(currentProject.id) : false)
  const { zones, loading } = useAHSPStore()
  const [syncing, setSyncing] = React.useState(false)
  const [showSettings, setShowSettings] = React.useState(false)


  // Fetch RAB items from Supabase on mount / project change
  useEffect(() => {
    if (currentProject?.id) {
      fetchRabFromSupabase(currentProject.id)
    }
  }, [currentProject?.id, fetchRabFromSupabase])

  // Real-time listener for lock states (S5-05)
  useEffect(() => {
    if (!currentProject?.id) return
    const client = assertSupabase()
    const channel = client.channel(`rab_lock_monitor_${currentProject.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'rab_items',
        filter: `project_id=eq.${currentProject.id}`
      }, () => {
        // Automatically fetch to update lock state derived from snapshot_price
        fetchRabFromSupabase(currentProject.id)
      })
      .subscribe()

    return () => {
      client.removeChannel(channel)
    }
  }, [currentProject?.id, fetchRabFromSupabase])

  // Configurable rates — read from projectStore.meta.rabRates (reactive),
  // fallback to legacy localStorage key for backward compat.
  const storageKey = `rab:rates:${currentProject?.id ?? '_'}`
  const metaRates = currentProject?.meta?.rabRates as { overhead?: number; profit?: number; tax?: number } | undefined
  const [overheadPct, setOverheadPct] = React.useState<number>(() => {
    if (metaRates?.overhead != null) return Number(metaRates.overhead)
    try { return Number(JSON.parse(localStorage.getItem(storageKey) ?? '{}').overhead ?? 0) } catch { return 0 }
  })
  const [profitPct, setProfitPct] = React.useState<number>(() => {
    if (metaRates?.profit != null) return Number(metaRates.profit)
    try { return Number(JSON.parse(localStorage.getItem(storageKey) ?? '{}').profit ?? 0) } catch { return 0 }
  })
  const [taxRate, setTaxRate] = React.useState<number>(() => {
    if (metaRates?.tax != null) return Number(metaRates.tax)
    try { return Number(JSON.parse(localStorage.getItem(storageKey) ?? '{}').tax ?? 11) } catch { return 11 }
  })

  const persistRates = useCallback((oh: number, pr: number, tx: number) => {
    // Write to both localStorage (legacy) AND projectStore.meta.rabRates (reactive)
    localStorage.setItem(storageKey, JSON.stringify({ overhead: oh, profit: pr, tax: tx }))
    if (currentProject?.id) {
      updateProject(currentProject.id, {
        meta: { ...currentProject.meta, rabRates: { overhead: oh, profit: pr, tax: tx } },
      })
    }
  }, [storageKey, currentProject, updateProject])

  // Get zone name if project has zoneId
  const currentZone = currentProject?.zoneId ? zones.find(z => z.id === currentProject.zoneId) : null

  const handleSync = async () => {
    if (!currentProject?.id) {
      toast.error('No project selected')
      return
    }
    if (!syncProjectToSupabase) {
      toast.error('Supabase sync not configured')
      return
    }
    setSyncing(true)
    try {
      await syncProjectToSupabase(currentProject.id)
      toast.success('RAB items synced to Supabase')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Sync failed'
      toast.error(message)
    } finally {
      setSyncing(false)
    }
  }

  const summary = useMemo(() => {
    const subtotal = items.reduce((sum, item) => sum + ((item.volume || 0) * (item.unit_price || 0)), 0)
    const overhead = subtotal * (overheadPct / 100)
    const profit = subtotal * (profitPct / 100)
    const taxBase = subtotal + overhead + profit
    const tax = taxBase * (taxRate / 100)
    const total = taxBase + tax
    return { subtotal, overhead, profit, tax, total }
  }, [items, overheadPct, profitPct, taxRate])

  if (!currentProject) {
    return (
      <div className="space-y-6">
        {!embedded && (
          <ModuleHeader
            icon={<Calculator size={18} />}
            title="RAB Builder"
            description="Manage budget items and calculations"
            showBackButton={false}
          />
        )}
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold">No Project Selected</h2>
          <p className="text-muted-foreground">Please select a project to view RAB.</p>
        </div>
      </div>
    )
  }

  if (!embedded) {
    // ── Standalone (non-embedded) layout — unchanged ──────────────
    return (
      <div className="space-y-4 density-compact">
        <ModuleHeader
          icon={<Calculator size={18} />}
          title="RAB Builder"
          description="Manage budget items and calculations"
          accent="emerald"
          actions={
            <div className="flex flex-wrap items-center gap-4">
              {otherPeers.length > 0 && (
                <div className="flex items-center gap-2 pr-2 border-r border-slate-200 dark:border-slate-800 animate-in fade-in slide-in-from-right-2 duration-300">
                  <span className="text-xs uppercase font-bold text-slate-400 tracking-wider hidden lg:block">Active Peers:</span>
                  <PresenceAvatars users={otherPeers} />
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setShowSettings(s => !s)}>
                  <Settings2 className="h-3.5 w-3.5" />
                  Rates
                </Button>
                <Button onClick={handleSync} disabled={syncing} variant="outline" className="h-8 gap-2 text-xs">
                  <CloudUpload className="h-4 w-4" />
                  {syncing ? 'Syncing...' : 'Sync'}
                </Button>
              </div>
            </div>
          }
        />
        {showSettings && (
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">RAB Rate Configuration</span>
              <button type="button" onClick={() => setShowSettings(false)} className="text-xs text-slate-400 hover:text-slate-600">✕ Tutup</button>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="block min-w-[140px]">
                <span className="mb-1 block text-xs text-slate-500">Overhead (%)</span>
                <input type="number" min="0" max="100" step="0.1" value={overheadPct} onChange={e => { const v = Math.max(0, Math.min(100, Number(e.target.value))); setOverheadPct(v); persistRates(v, profitPct, taxRate) }} className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none" />
              </label>
              <label className="block min-w-[140px]">
                <span className="mb-1 block text-xs text-slate-500">Profit (%)</span>
                <input type="number" min="0" max="100" step="0.1" value={profitPct} onChange={e => { const v = Math.max(0, Math.min(100, Number(e.target.value))); setProfitPct(v); persistRates(overheadPct, v, taxRate) }} className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none" />
              </label>
              <label className="block min-w-[140px]">
                <span className="mb-1 block text-xs text-slate-500">PPN / Tax (%)</span>
                <input type="number" min="0" max="100" step="0.1" value={taxRate} onChange={e => { const v = Math.max(0, Math.min(100, Number(e.target.value))); setTaxRate(v); persistRates(overheadPct, profitPct, v) }} className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none" />
              </label>
              <div className="flex items-end"><Button size="sm" className="h-8 text-xs" onClick={() => setShowSettings(false)}>Apply</Button></div>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {isLocked && (
            <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3 text-sm">
              <Lock size={15} className="shrink-0 text-red-600" />
              <span className="font-semibold text-red-700">Baseline RAB Terkunci</span>
              <span className="text-red-600">— RAB bersifat read-only.</span>
            </div>
          )}
          <PriceDriftBanner projectId={currentProject.id} isLocked={isLocked} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card className="hover-interactive">
              <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Items</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{items.length}</div></CardContent>
            </Card>
            <Card className="hover-interactive">
              <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subtotal</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatIDR(summary.subtotal)}</div></CardContent>
            </Card>
            <Card className="hover-interactive">
              <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">OH + Profit + Tax</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatIDR(summary.overhead + summary.profit + summary.tax)}</div></CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20 hover-interactive">
              <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-primary">Final Total</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-primary">{formatIDR(summary.total)}</div></CardContent>
            </Card>
          </div>
          <Card className="panel-compact">
            <CardContent className="p-0 overflow-x-auto">
              {loading.ahspItems ? <CardSkeleton /> : <RABTable projectId={currentProject.id} />}
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  // ── Embedded: Variant D layout ────────────────────────────────
  return (
    <div
      className="flex flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm"
      style={{ height: 'calc(100vh - 340px)', minHeight: '480px' }}
    >
      {/* ── Top action bar ─────────────────────────────────────── */}
      <div className="px-4 py-2 bg-white border-b border-slate-200 flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          {currentZone && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <MapPin size={11} />
              {currentZone.name}
            </span>
          )}
          {isLocked && (
            <span className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
              <Lock size={11} /> Locked
            </span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {otherPeers.length > 0 && <PresenceAvatars users={otherPeers} />}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1.5 text-xs text-slate-600 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all disabled:opacity-50"
          >
            <CloudUpload size={13} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <button
            onClick={() => setShowSettings(s => !s)}
            className="flex items-center gap-1.5 text-xs text-slate-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-slate-300 transition-all"
          >
            <Settings2 size={13} />
            {(overheadPct > 0 || profitPct > 0 || taxRate !== 11) && (
              <span className="text-xs font-bold text-slate-500">OH {overheadPct}%</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Rates config (collapsible) ──────────────────────────── */}
      {showSettings && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Rate Configuration</span>
            <button type="button" onClick={() => setShowSettings(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Overhead (%)', value: overheadPct, setter: (v: number) => { setOverheadPct(v); persistRates(v, profitPct, taxRate) } },
              { label: 'Profit (%)', value: profitPct, setter: (v: number) => { setProfitPct(v); persistRates(overheadPct, v, taxRate) } },
              { label: 'PPN (%)', value: taxRate, setter: (v: number) => { setTaxRate(v); persistRates(overheadPct, profitPct, v) } },
            ].map(({ label, value, setter }) => (
              <label key={label} className="block">
                <span className="mb-1 block text-xs text-slate-500">{label}</span>
                <input
                  type="number" min="0" max="100" step="0.1" value={value}
                  onChange={e => setter(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="w-24 rounded border border-slate-200 bg-white px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                />
              </label>
            ))}
            <div className="flex items-end">
              <Button size="sm" className="h-7 text-xs" onClick={() => setShowSettings(false)}>Apply</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-px bg-slate-200 border-b border-slate-200 flex-shrink-0">
        {([
          { label: 'TOTAL ITEMS', value: items.length.toString(), cls: 'text-slate-900' },
          { label: 'SUBTOTAL', value: formatIDR(summary.subtotal), cls: 'text-slate-900' },
          { label: 'OH + PROFIT + TAX', value: formatIDR(summary.overhead + summary.profit + summary.tax), cls: summary.subtotal > 0 ? 'text-slate-900' : 'text-slate-400' },
          { label: 'FINAL TOTAL', value: formatIDR(summary.total), cls: 'text-blue-600' },
        ] as const).map(({ label, value, cls }) => (
          <div key={label} className="bg-white px-4 py-3">
            <div className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</div>
            <div className={`font-bold text-xl font-mono mt-0.5 ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Banners ────────────────────────────────────────────── */}
      <PriceDriftBanner projectId={currentProject.id} isLocked={isLocked} />

      {/* ── Main: RABTable + EVM Guard ─────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white overflow-hidden">
          {loading.ahspItems ? (
            <div className="p-4 space-y-3">{[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}</div>
          ) : (
            <>
              {items.length > 0 && summary.subtotal === 0 && (
                <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 flex-shrink-0">
                  <span className="font-medium">⚠ {items.length} item belum memiliki unit price — Grand Total = Rp 0.</span>
                  <span className="ml-auto text-amber-600">Import dari AHSP untuk mengisi harga satuan otomatis.</span>
                </div>
              )}
              <RABTable projectId={currentProject.id} />
            </>
          )}
        </div>
        <EVMGuardPanel projectId={currentProject.id ?? null} />
      </div>
    </div>
  )

}