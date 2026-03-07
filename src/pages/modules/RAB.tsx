/**
 * RAB.tsx
 * RAB (Budget Estimation) module shell page.
 * Provides a clean layout and ensures all JSX tags are properly closed.
 */

import React, { useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Calculator, CloudUpload, Lock, MapPin, Settings2 } from 'lucide-react'
import { useRabStore } from '@/store/rabStore'
import { useProjectStore } from '@/store/projectStore'
import { useAHSPStore } from '@/store/ahspStore'
import { toast } from 'sonner'
import { RABTable } from '@/components/rab/RABTable'
import { formatIDR } from '@/lib/utils'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { CardSkeleton } from '@/components/common/LoadingSkeleton'
import type { RABItem } from '@/types/rab'

const EMPTY_ARRAY: RABItem[] = []

/** RAB module component */
export default function RAB() {
  const syncProjectToSupabase = useRabStore(s => s.syncProjectToSupabase)
  // Use direct state selection to ensure stability
  const currentProject = useProjectStore(s => s.activeProjectId ? s.projects[s.activeProjectId] : null)
  const updateProject   = useProjectStore(s => s.updateProject)
  const items = useRabStore(s => currentProject ? s.getItems(currentProject.id) : EMPTY_ARRAY)
  const isLocked = useRabStore(s => currentProject ? s.isLocked(currentProject.id) : false)
  const { zones, loading } = useAHSPStore()
  const [syncing, setSyncing] = React.useState(false)
  const [showSettings, setShowSettings] = React.useState(false)

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
    const profit   = subtotal * (profitPct / 100)
    const taxBase  = subtotal + overhead + profit
    const tax      = taxBase * (taxRate / 100)
    const total    = taxBase + tax
    return { subtotal, overhead, profit, tax, total }
  }, [items, overheadPct, profitPct, taxRate])

  if (!currentProject) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon={<Calculator size={18} />}
          title="RAB Builder"
          description="Manage budget items and calculations"
          showBackButton={false}
        />
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold">No Project Selected</h2>
          <p className="text-muted-foreground">Please select a project to view RAB.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 density-compact">
      <ModuleHeader
        icon={<Calculator size={18} />}
        title="RAB Builder"
        description="Manage budget items and calculations"
        accent="emerald"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowSettings(s => !s)}
            >
              <Settings2 className="h-3.5 w-3.5" />
              Rates
              {(overheadPct > 0 || profitPct > 0 || taxRate !== 11) && (
                <span className="ml-0.5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 text-xs font-bold">
                  OH {overheadPct}% · P {profitPct}% · T {taxRate}%
                </span>
              )}
            </Button>
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="h-8 gap-2 text-xs">
              <CloudUpload className="h-4 w-4" />
              {syncing ? 'Syncing...' : 'Sync to Supabase'}
            </Button>
          </div>
        }
      />

      {/* Rates config — inline panel, no overflow/z-index issues */}
      {showSettings && (
        <div className="rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900 p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">RAB Rate Configuration</span>
            <button
              type="button"
              onClick={() => setShowSettings(false)}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              ✕ Tutup
            </button>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="block min-w-[140px]">
              <span className="mb-1 block text-xs text-slate-500">Overhead (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={overheadPct}
                onChange={e => {
                  const v = Math.max(0, Math.min(100, Number(e.target.value)))
                  setOverheadPct(v)
                  persistRates(v, profitPct, taxRate)
                }}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block min-w-[140px]">
              <span className="mb-1 block text-xs text-slate-500">Profit (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={profitPct}
                onChange={e => {
                  const v = Math.max(0, Math.min(100, Number(e.target.value)))
                  setProfitPct(v)
                  persistRates(overheadPct, v, taxRate)
                }}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <label className="block min-w-[140px]">
              <span className="mb-1 block text-xs text-slate-500">PPN / Tax (%)</span>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxRate}
                onChange={e => {
                  const v = Math.max(0, Math.min(100, Number(e.target.value)))
                  setTaxRate(v)
                  persistRates(overheadPct, profitPct, v)
                }}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800"
              />
            </label>
            <div className="flex items-end">
              <Button size="sm" className="h-8 text-xs" onClick={() => setShowSettings(false)}>
                Apply
              </Button>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Tersimpan otomatis · Digunakan oleh Budget Health Panel untuk menghitung RAB Final Total (harga kontrak).
          </p>
        </div>
      )}

      <div className="space-y-4">
        {/* G4 Fix: Lock banner — shown when RAB baseline has been snapshotted */}
        {isLocked && (
          <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/60 px-4 py-3 text-sm dark:border-red-800 dark:bg-red-900/20">
            <Lock size={15} className="shrink-0 text-red-600 dark:text-red-400" />
            <span className="font-semibold text-red-700 dark:text-red-300">Baseline RAB Terkunci</span>
            <span className="text-red-600 dark:text-red-400">
              — RAB bersifat read-only. Import item dan publikasi draft dinonaktifkan.
            </span>
          </div>
        )}

        {/* Zone Badge */}
        {currentZone && (
          <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
            <MapPin className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-blue-900 dark:text-blue-100">Zone Pricing Active:</span>
            <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
              {currentZone.name}
            </Badge>
            <span className="text-xs text-blue-600 dark:text-blue-400">Prices adjusted for this zone</span>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="hover-interactive">
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.length}</div>
            </CardContent>
          </Card>
          <Card className="hover-interactive">
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subtotal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(summary.subtotal)}</div>
            </CardContent>
          </Card>
          <Card className="hover-interactive">
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                OH + Profit + Tax
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(summary.overhead + summary.profit + summary.tax)}</div>
              <p className="mt-0.5 text-xs text-neutral-400">
                OH {formatIDR(summary.overhead)} · P {formatIDR(summary.profit)} · PPN {formatIDR(summary.tax)}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20 hover-interactive">
            <CardHeader className="pb-1 pt-4">
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-primary">Final Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatIDR(summary.total)}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="panel-compact">
          <CardContent className="p-0">
            {loading.ahspItems ? (
              <CardSkeleton />
            ) : (
              <RABTable projectId={currentProject.id} />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
