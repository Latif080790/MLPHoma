/**
 * RAB.tsx
 * RAB (Budget Estimation) module shell page.
 * Provides a clean layout and ensures all JSX tags are properly closed.
 */

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Calculator, CloudUpload, MapPin } from 'lucide-react'
import { useRabStore } from '../../store/rabStore'
import { useProjectStore } from '../../store/projectStore'
import { useAHSPStore } from '../../store/ahspStore'
import { toast } from 'sonner'
import { RABTable } from '../../components/rab/RABTable'
import { formatIDR } from '../../lib/utils'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { CardSkeleton } from '../../components/common/LoadingSkeleton'
import type { RABItem } from '../../types/rab'

const EMPTY_ARRAY: RABItem[] = []

/** RAB module component */
export default function RAB() {
  const syncProjectToSupabase = useRabStore(s => s.syncProjectToSupabase)
  // Use direct state selection to ensure stability
  const currentProject = useProjectStore(s => s.activeProjectId ? s.projects[s.activeProjectId] : null)
  const items = useRabStore(s => currentProject ? s.getItems(currentProject.id) : EMPTY_ARRAY)
  const { zones, loading } = useAHSPStore()
  const [syncing, setSyncing] = React.useState(false)

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
    // Simple overhead/profit/tax logic for now - can be enhanced later
    const overhead = subtotal * 0.0 // 0% default
    const tax = (subtotal + overhead) * 0.11 // 11% PPN
    const total = subtotal + overhead + tax
    return { subtotal, overhead, tax, total }
  }, [items])

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
        showBackButton={false}
        actions={
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="h-8 gap-2 text-xs">
            <CloudUpload className="h-4 w-4" />
            {syncing ? 'Syncing...' : 'Sync to Supabase'}
          </Button>
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
              <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tax (11%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(summary.tax)}</div>
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
