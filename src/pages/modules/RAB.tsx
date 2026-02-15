/**
 * RAB.tsx
 * RAB (Budget Estimation) module shell page.
 * Provides a clean layout and ensures all JSX tags are properly closed.
 */

import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Calculator, CloudUpload } from 'lucide-react'
import { useRabStore } from '../../store/rabStore'
import { useProjectStore } from '../../store/projectStore'
import { toast } from 'sonner'
import { RABTable } from '../../components/rab/RABTable'
import { formatIDR } from '../../lib/utils'
import { ModuleHeader } from '../../components/modules/ModuleHeader'

const EMPTY_ARRAY: any[] = []

/** RAB module component */
export default function RAB() {
  const syncProjectToSupabase = useRabStore(s => s.syncProjectToSupabase)
  // Use direct state selection to ensure stability
  const currentProject = useProjectStore(s => s.activeProjectId ? s.projects[s.activeProjectId] : null)
  const items = useRabStore(s => currentProject ? s.getItems(currentProject.id) : EMPTY_ARRAY)
  const [syncing, setSyncing] = React.useState(false)

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
    } catch (err: any) {
      toast.error(err?.message || 'Sync failed')
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
        />
        <div className="p-8 text-center">
          <h2 className="text-lg font-semibold">No Project Selected</h2>
          <p className="text-muted-foreground">Please select a project to view RAB.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={<Calculator size={18} />}
        title="RAB Builder"
        description="Manage budget items and calculations"
        actions={
          <Button onClick={handleSync} disabled={syncing} variant="outline" className="gap-2">
            <CloudUpload className="h-4 w-4" />
            {syncing ? 'Syncing...' : 'Sync to Supabase'}
          </Button>
        }
      />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{items.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Subtotal</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(summary.subtotal)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tax (11%)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatIDR(summary.tax)}</div>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-primary">Final Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{formatIDR(summary.total)}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="p-6">
            <RABTable projectId={currentProject.id} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
