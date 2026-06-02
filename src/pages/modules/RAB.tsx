/**
 * RAB.tsx
 * RAB (Budget Estimation) module shell page.
 * Provides a clean layout and ensures all JSX tags are properly closed.
 */

import React, { useMemo, useCallback, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { AlertTriangle, Calculator, CloudUpload, Lock, MapPin, Settings2, TrendingUp } from 'lucide-react'
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
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable'
import { sellingFromBase, kontribusi } from '@/lib/costingMargin'
import { readMarginSettings, effectiveMarginPct } from '@/lib/marginSettings'

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
        // Skip re-fetch when user has unsaved local edits — fetchItems merge strategy
        // already preserves local data for newer items, but skipping avoids the round-trip
        // and the brief re-render flicker. Lock state (snapshotPrice) updates will still
        // arrive on the next fetch after the user publishes their changes.
        if (!useRabStore.getState().hasUnsavedChanges[currentProject.id]) {
          fetchRabFromSupabase(currentProject.id)
        }
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
  const marginSettings = useMemo(() => readMarginSettings(currentProject?.meta), [currentProject?.meta])
  const setMarginMeta = useCallback((patch: Partial<ReturnType<typeof readMarginSettings>>) => {
    if (!currentProject?.id) return
    const next = { ...readMarginSettings(currentProject.meta), ...patch }
    updateProject(currentProject.id, { meta: { ...currentProject.meta, ...next } })
  }, [currentProject, updateProject])

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
    // Margin-on-revenue: ex-tax selling per item = base / (1 - margin%).
    const sellingExTax = items.reduce((sum, item) => {
      const base = (item.volume || 0) * (item.unit_price || 0)
      return sum + sellingFromBase(base, effectiveMarginPct(marginSettings, item.id))
    }, 0)
    const kontribusiRp = kontribusi(sellingExTax, subtotal)
    const taxBase = sellingExTax
    const tax = taxBase * (taxRate / 100)
    const total = taxBase + tax
    const overhead = 0
    const profit = kontribusiRp
    const projectBudget = currentProject?.budget ?? 0
    const budgetUtilization = projectBudget > 0 ? (total / projectBudget) * 100 : 0
    const budgetOverrun = projectBudget > 0 && total > projectBudget
    const budgetOverrunAmount = total - projectBudget
    return {
      subtotal,
      sellingExTax,
      kontribusiRp,
      overhead,
      profit,
      tax,
      total,
      budgetUtilization,
      budgetOverrun,
      budgetOverrunAmount,
    }
  }, [items, marginSettings, taxRate, currentProject?.budget])

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
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Margin</span>
                  <div className="flex rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setMarginMeta({ marginMode: 'fixed' })}
                      className={`px-2 py-1 ${marginSettings.marginMode === 'fixed' ? 'bg-blue-600 text-white' : 'text-slate-500 bg-white'}`}
                    >
                      Fixed All
                    </button>
                    <button
                      type="button"
                      onClick={() => setMarginMeta({ marginMode: 'per_item' })}
                      className={`px-2 py-1 ${marginSettings.marginMode === 'per_item' ? 'bg-blue-600 text-white' : 'text-slate-500 bg-white'}`}
                    >
                      Per item
                    </button>
                  </div>
                  {marginSettings.marginMode === 'fixed' && (
                    <div className="relative">
                      <Input
                        type="number"
                        min="0"
                        max="99.99"
                        step="0.1"
                        value={marginSettings.defaultMarginPct}
                        onChange={(e) => setMarginMeta({ defaultMarginPct: Math.max(0, Math.min(99.99, Number(e.target.value) || 0)) })}
                        className="h-8 w-20 pr-5 text-xs font-mono"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                    </div>
                  )}
                </div>
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
              <button type="button" onClick={() => setShowSettings(false)} className="text-xs text-slate-400 hover:text-slate-600">✕ Close</button>
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
                <span className="mb-1 block text-xs text-slate-500">Tax (%)</span>
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
          {summary.budgetOverrun && (
            <div className="flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50/60 px-4 py-3 text-sm">
              <AlertTriangle size={15} className="shrink-0 text-rose-600" />
              <span className="font-semibold text-rose-700">RAB Exceeds Project Budget</span>
              <span className="text-rose-600">by <strong>{formatIDR(summary.budgetOverrunAmount)}</strong> ({summary.budgetUtilization.toFixed(1)}% of budget)</span>
            </div>
          )}
          {!summary.budgetOverrun && summary.budgetUtilization > 90 && (
            <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm">
              <TrendingUp size={15} className="shrink-0 text-amber-600" />
              <span className="font-semibold text-amber-700">RAB reached {summary.budgetUtilization.toFixed(1)}% of project budget</span>
              <span className="text-amber-600">- approaching budget threshold.</span>
            </div>
          )}
          <PriceDriftBanner projectId={currentProject.id} isLocked={isLocked} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card className="hover-interactive">
              <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Items</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{items.length}</div></CardContent>
            </Card>
            <Card className="hover-interactive">
              <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Cost</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{formatIDR(summary.subtotal)}</div></CardContent>
            </Card>
            <Card className="hover-interactive">
              <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Selling Price (Ex Tax)</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-blue-600">{formatIDR(summary.sellingExTax)}</div></CardContent>
            </Card>
            <Card className="hover-interactive">
              <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contribution</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-violet-600">{formatIDR(summary.kontribusiRp)}</div></CardContent>
            </Card>
            <Card className="bg-primary/5 border-primary/20 hover-interactive">
              <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-semibold uppercase tracking-wide text-primary">Total Selling (Incl Tax)</CardTitle></CardHeader>
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
      style={{ height: 'calc(100vh - 180px)', minHeight: '480px' }}
    >
      {/* ── Top action bar ─────────────────────────────────────── */}
      <div className="px-3 py-1.5 bg-white border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {currentZone && (
            <span className="flex items-center gap-1 text-xs text-slate-400">
              <MapPin size={10} /> {currentZone.name}
            </span>
          )}
          {isLocked && (
            <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
              <Lock size={10} /> Locked
            </span>
          )}
          {(overheadPct > 0 || profitPct > 0 || taxRate !== 11) && (
            <span className="text-xs text-slate-400 font-mono">
              OH {overheadPct}% · P {profitPct}% · Tax {taxRate}%
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {otherPeers.length > 0 && <PresenceAvatars users={otherPeers} />}
          <div className="flex rounded border border-slate-200 overflow-hidden">
            <button
              type="button"
              onClick={() => setMarginMeta({ marginMode: 'fixed' })}
              className={`px-1.5 py-1 text-xs ${marginSettings.marginMode === 'fixed' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}
            >
              Fixed
            </button>
            <button
              type="button"
              onClick={() => setMarginMeta({ marginMode: 'per_item' })}
              className={`px-1.5 py-1 text-xs ${marginSettings.marginMode === 'per_item' ? 'bg-blue-600 text-white' : 'bg-white text-slate-500'}`}
            >
              Item
            </button>
          </div>
          {marginSettings.marginMode === 'fixed' && (
            <div className="relative">
              <Input
                type="number"
                min="0"
                max="99.99"
                step="0.1"
                value={marginSettings.defaultMarginPct}
                onChange={(e) => setMarginMeta({ defaultMarginPct: Math.max(0, Math.min(99.99, Number(e.target.value) || 0)) })}
                className="h-7 w-16 pr-4 text-xs font-mono"
              />
              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
            </div>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-1 text-xs text-slate-500 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-all disabled:opacity-50"
          >
            <CloudUpload size={11} />
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <button
            onClick={() => setShowSettings(s => !s)}
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded border transition-all ${
              showSettings
                ? 'bg-slate-100 border-slate-300 text-slate-700'
                : 'text-slate-500 border-slate-200 hover:border-slate-300'
            }`}
          >
            <Settings2 size={11} /> Rates
          </button>
        </div>
      </div>

      {/* ── Rates config (collapsible) ──────────────────────────── */}
      {showSettings && (
        <div className="px-4 py-3 bg-slate-50/80 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Rate Configuration</span>
            <button type="button" onClick={() => setShowSettings(false)} className="text-xs text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="flex flex-wrap gap-3">
            {[
              { label: 'Overhead (%)', value: overheadPct, setter: (v: number) => { setOverheadPct(v); persistRates(v, profitPct, taxRate) } },
              { label: 'Profit (%)', value: profitPct, setter: (v: number) => { setProfitPct(v); persistRates(overheadPct, v, taxRate) } },
              { label: 'Tax (%)', value: taxRate, setter: (v: number) => { setTaxRate(v); persistRates(overheadPct, profitPct, v) } },
            ].map(({ label, value, setter }) => (
              <div key={label} className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
                <Input
                  type="number" min="0" max="100" step="0.1" value={value}
                  onChange={e => setter(Math.max(0, Math.min(100, Number(e.target.value))))}
                  className="h-8 w-24 text-sm font-mono"
                />
              </div>
            ))}
            <div className="flex items-end">
              <Button size="sm" className="h-7 text-xs" onClick={() => setShowSettings(false)}>Apply</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── KPI strip ──────────────────────────────────────────── */}
      <div className="grid grid-cols-5 divide-x divide-slate-200 border-b border-slate-200 flex-shrink-0">
        {([
          { label: 'Items', value: items.length.toString(), cls: 'text-slate-800' },
          { label: 'Total Cost', value: formatIDR(summary.subtotal), cls: 'text-slate-800' },
          { label: 'Selling Price', value: formatIDR(summary.sellingExTax), cls: 'text-blue-600' },
          { label: 'Contribution', value: formatIDR(summary.kontribusiRp), cls: summary.kontribusiRp >= 0 ? 'text-violet-600' : 'text-rose-600' },
          { label: 'Total Selling', value: formatIDR(summary.total), cls: 'text-amber-600' },
        ] as const).map(({ label, value, cls }) => (
          <div key={label} className="bg-white px-3 py-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 leading-none mb-0.5">{label}</div>
            <div className={`font-bold text-sm font-mono leading-tight ${cls}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* ── Banners ────────────────────────────────────────────── */}
      <PriceDriftBanner projectId={currentProject.id} isLocked={isLocked} />
      {summary.budgetOverrun && (
        <div className="flex items-center gap-2 border-b border-rose-200 bg-rose-50/80 px-4 py-2 text-xs text-rose-800 flex-shrink-0">
          <AlertTriangle size={12} className="shrink-0 text-rose-600" />
          <span className="font-semibold">RAB exceeds project budget by {formatIDR(summary.budgetOverrunAmount)}</span>
          <span className="ml-1 text-rose-600">({summary.budgetUtilization.toFixed(1)}%)</span>
        </div>
      )}
      {!summary.budgetOverrun && summary.budgetUtilization > 90 && (
        <div className="flex items-center gap-2 border-b border-amber-200 bg-amber-50/80 px-4 py-2 text-xs text-amber-800 flex-shrink-0">
          <TrendingUp size={12} className="shrink-0 text-amber-600" />
          <span className="font-semibold">RAB reached {summary.budgetUtilization.toFixed(1)}% of project budget</span>
        </div>
      )}

      {/* ── Main: RABTable + EVM Guard (resizable) ─────────── */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        <ResizablePanel defaultSize={75} minSize={50}>
          <div className="flex flex-col bg-white overflow-hidden h-full">
            {loading.ahspItems ? (
              <div className="p-4 space-y-3">{[1, 2, 3, 4].map(i => <CardSkeleton key={i} />)}</div>
            ) : (
              <>
                {(() => {
                  const noPriceCount = items.filter(i => !i.unit_price || i.unit_price === 0).length
                  return noPriceCount > 0 ? (
                    <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50/80 px-4 py-2 text-xs text-amber-800 flex-shrink-0">
                      <span className="font-medium">⚠ {noPriceCount} items do not have unit cost yet.</span>
                      <span className="ml-auto text-amber-600">Import from AHSP to fill pricing automatically.</span>
                    </div>
                  ) : null
                })()}
                <RABTable projectId={currentProject.id} />
              </>
            )}
          </div>
        </ResizablePanel>
        <ResizableHandle withHandle className="bg-slate-100 hover:bg-blue-100 data-[resize-handle-active]:bg-blue-200 transition-colors" />
        <ResizablePanel defaultSize={25} minSize={18} maxSize={35}>
          <EVMGuardPanel projectId={currentProject.id ?? null} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )

}
