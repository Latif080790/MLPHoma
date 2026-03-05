/**
 * RAB.tsx
 * RAB (Budget Estimation) module shell page.
 * Provides a clean layout and ensures all JSX tags are properly closed.
 */

import React, { useMemo, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Calculator, CloudUpload, MapPin, Settings2 } from 'lucide-react'
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
  const items = useRabStore(s => currentProject ? s.getItems(currentProject.id) : EMPTY_ARRAY)
  const { zones, loading } = useAHSPStore()
  const [syncing, setSyncing] = React.useState(false)
  const [showSettings, setShowSettings] = React.useState(false)

  // Configurable rates — persisted per-project in localStorage
  const storageKey = `rab:rates:${currentProject?.id ?? '_'}`
  const [overheadPct, setOverheadPct] = React.useState<number>(() => {
    try { return Number(JSON.parse(localStorage.getItem(storageKey) ?? '{}').overhead ?? 0) } catch { return 0 }
  })
  const [taxRate, setTaxRate] = React.useState<number>(() => {
    try { return Number(JSON.parse(localStorage.getItem(storageKey) ?? '{}').tax ?? 11) } catch { return 11 }
  })

  const persistRates = useCallback((oh: number, tx: number) => {
    localStorage.setItem(storageKey, JSON.stringify({ overhead: oh, tax: tx }))
  }, [storageKey])

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
    const tax = (subtotal + overhead) * (taxRate / 100)
    const total = subtotal + overhead + tax
    return { subtotal, overhead, tax, total }
  }, [items, overheadPct, taxRate])

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
            <div className="relative">
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-1.5 text-xs"
                onClick={() => setShowSettings(s => !s)}
              >
                <Settings2 className="h-3.5 w-3.5" />
                Rates
              </Button>
              {showSettings && (
                <div className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border bg-white p-4 shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                  <h4 className="mb-3 text-xs font-semibold text-neutral-700 dark:text-neutral-300">RAB Rate Configuration</h4>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="mb-1 block text-xs text-neutral-500">Overhead / Profit (%)</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={overheadPct}
                        onChange={e => {
                          const v = Math.max(0, Math.min(100, Number(e.target.value)))
                          setOverheadPct(v)
                          persistRates(v, taxRate)
                        }}
                        className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-xs text-neutral-500">PPN / Tax (%)</span>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={taxRate}
                        onChange={e => {
                          const v = Math.max(0, Math.min(100, Number(e.target.value)))
                          setTaxRate(v)
                          persistRates(overheadPct, v)
                        }}
                        className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none dark:border-neutral-700 dark:bg-neutral-800"
                      />
                    </label>
                    <Button
                      size="sm"
                      className="h-7 w-full text-xs"
                      onClick={() => setShowSettings(false)}
                    >
                      Apply
                    </Button>
                  </div>
                </div>
              )}
            </div>
            <Button onClick={handleSync} disabled={syncing} variant="outline" className="h-8 gap-2 text-xs">
              <CloudUpload className="h-4 w-4" />
              {syncing ? 'Syncing...' : 'Sync to Supabase'}
            </Button>
          </div>
        }
      />

      <div className="space-y-4">
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
                Overhead {overheadPct > 0 ? `(${overheadPct}%)` : ''} + Tax ({taxRate}%)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(summary.overhead + summary.tax)}</div>
              {overheadPct > 0 && (
                <p className="mt-0.5 text-xs text-neutral-400">
                  OH {formatIDR(summary.overhead)} + PPN {formatIDR(summary.tax)}
                </p>
              )}
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
