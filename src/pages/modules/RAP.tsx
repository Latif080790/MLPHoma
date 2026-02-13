import React, { useEffect, useState } from 'react'
import { Gauge, LayoutList, CalendarClock } from 'lucide-react'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { useProjectStore } from '../../store/projectStore'
import { useRapStore } from '../../store/rapStore'
import { useRabStore } from '../../store/rabStore'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'

// Existing Scheduler Components (Keeping them for the "Scheduler" tab)
import { RapToolbar, PresetKind } from '../../components/rap/RapToolbar'
import { RapDistributionChart } from '../../components/rap/RapDistributionChart'
import { RapMonthTable } from '../../components/rap/RapMonthTable'
import {
  RapPlanItem,
  planFromWeights,
  weightsBell,
  makeMonthKeys,
  clonePlan,
  sumPlan
} from '../../components/rap/RapUtils'

export default function RAP(): JSX.Element {
  const project = useProjectStore((s) => s.projects[s.activeProjectId || ''] || null)
  const projectId = project?.id || ''

  // New Store (RAP Items)
  const { items, fetchItems, initFromRab, isLoading } = useRapStore()
  const { getItems: getRabItems } = useRabStore()

  // Local State for Scheduler (Legacy)
  const [plan, setPlan] = useState<RapPlanItem[]>([])
  const [monthsInput, setMonthsInput] = useState<number>(12)
  const [targetTotal, setTargetTotal] = useState<number>(5_000_000_000)

  useEffect(() => {
    if (projectId) {
      fetchItems(projectId)
    }
  }, [projectId, fetchItems])

  const handleInitFromRab = async () => {
    if (!confirm('This will import all items from RAB. Continue?')) return
    const rabItems = getRabItems(projectId)
    if (!rabItems.length) {
      alert('No RAB items found to import.')
      return
    }
    await initFromRab(projectId, rabItems)
  }

  // --- Scheduler Logic (Simplified for brevity, keeping core UI) ---
  const handleGenerate = (opts?: any) => {
    const keys = makeMonthKeys(monthsInput)
    const generated = planFromWeights(keys, targetTotal, weightsBell(monthsInput))
    setPlan(generated)
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={<Gauge size={18} />}
        title="RAP & Budget Control"
        description="Real-time Budget Control (RAP) and Cash Flow Planning."
        actions={<div className="hidden md:block text-xs text-neutral-500">Project: {project?.name}</div>}
      />

      <Tabs defaultValue="control" className="w-full">
        <TabsList className="grid w-full grid-cols-2 lg:w-[400px]">
          <TabsTrigger value="control">
            <LayoutList className="mr-2 h-4 w-4" />
            Budget Control
          </TabsTrigger>
          <TabsTrigger value="schedule">
            <CalendarClock className="mr-2 h-4 w-4" />
            Scheduler
          </TabsTrigger>
        </TabsList>

        {/* --- TAB 1: BUDGET CONTROL (New SQL-based) --- */}
        <TabsContent value="control">
          <div className="space-y-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Budget Summary</CardTitle>
                <Button variant="outline" size="sm" onClick={handleInitFromRab} disabled={isLoading || items.length > 0}>
                  {items.length > 0 ? 'Synced with RAB' : 'Import from RAB'}
                </Button>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  Rp {Math.round(items.reduce((acc, item) => acc + (item.total_budget || 0), 0)).toLocaleString('id-ID')}
                </div>
                <p className="text-xs text-muted-foreground">Total Budget Limit</p>
              </CardContent>
            </Card>

            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item Name</TableHead>
                    <TableHead className="text-right">Total Budget</TableHead>
                    <TableHead className="text-right">Risk Fund</TableHead>
                    <TableHead className="text-right">Actual Cost</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-center">Traffic Light</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No RAP items found. Click "Import from RAB" to start.
                      </TableCell>
                    </TableRow>
                  ) : (
                    items.map((item) => {
                      // Traffic Light Logic
                      const progress = item.total_budget > 0 ? (item.actual_cost / item.total_budget) : 0
                      let statusColor = 'bg-green-500' // Safe
                      let statusText = 'Safe'

                      if (progress > 1.0) {
                        statusColor = 'bg-red-600 animate-pulse' // Critical Overbudget
                        statusText = 'CRITICAL'
                      } else if (progress > 0.9) {
                        statusColor = 'bg-red-500' // Danger Zone
                        statusText = 'Danger'
                      } else if (progress > 0.75) {
                        statusColor = 'bg-yellow-500' // Warning
                        statusText = 'Warning'
                      }

                      // Dummy Risk Fund calc if 0 (Simulated for v3 Demo)
                      const riskFund = item.risk_buffer_amount || (item.total_budget * 0.05)

                      return (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">
                            <div className="flex flex-col">
                              <span>{/* @ts-ignore */ item.ahsp_items?.name || item.rab_items?.name || 'Unnamed Item'}</span>
                              <span className="text-xs text-muted-foreground">Vol: {item.qty_budget}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-bold text-blue-600">
                            {Math.round(item.total_budget ?? (item.qty_budget * item.unit_price_budget)).toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-purple-600">
                            {Math.round(riskFund).toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {Math.round(item.actual_cost).toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-bold">
                            {Math.round(item.remaining_budget ?? (item.total_budget - item.actual_cost)).toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className={`h-3 w-3 rounded-full ${statusColor}`} title={statusText} />
                              <span className="text-xs font-medium text-muted-foreground">{statusText}</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </TabsContent>

        {/* --- TAB 2: SCHEDULER (Legacy / Time-Phased) --- */}
        <TabsContent value="schedule">
          <div className="space-y-6">
            <RapToolbar
              months={monthsInput}
              setMonths={setMonthsInput}
              targetTotal={targetTotal}
              setTargetTotal={setTargetTotal}
              onGenerate={() => handleGenerate()}
              onGenerateFromSchedule={() => alert('WIP: Link to new items')}
              onPreset={() => { }}
              onNormalize={() => { }}
              onSmooth={() => { }}
              onLockBaseline={() => { }}
              onExport={() => { }}
              onImport={() => { }}
            />
            <RapDistributionChart plan={plan} title="Planned Curve" />
            <RapMonthTable plan={plan} setPlan={setPlan} />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
