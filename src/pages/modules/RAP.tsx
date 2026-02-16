import React, { useEffect, useState } from 'react'
import { Gauge, LayoutList, CalendarClock, Search } from 'lucide-react'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { useProjectStore } from '../../store/projectStore'
import { useRapStore } from '../../store/rapStore'
import { useRabStore } from '../../store/rabStore'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../../components/ui/table'
import { ProfitHealthWidget } from '../../components/modules/ProfitHealthWidget'
import { Input } from '../../components/ui/input' // Ensure Input is imported
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../components/ui/alert-dialog'

// Existing Scheduler Components (Keeping them for the "Scheduler" tab)
import { RapToolbar } from '../../components/rap/RapToolbar'
import { RapDistributionChart } from '../../components/rap/RapDistributionChart'
import { RapMonthTable } from '../../components/rap/RapMonthTable'
import {
  RapPlanItem,
  planFromWeights,
  weightsBell,
  makeMonthKeys,
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
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)

  useEffect(() => {
    if (projectId) {
      fetchItems(projectId)
    }
  }, [projectId, fetchItems])

  const openImportConfirm = () => {
    const rabItems = getRabItems(projectId)
    if (!rabItems.length) {
      toast.error('No RAB items found to import')
      return
    }
    setConfirmImportOpen(true)
  }

  const handleInitFromRab = async () => {
    const rabItems = getRabItems(projectId)
    if (!rabItems.length) {
      setConfirmImportOpen(false)
      toast.error('No RAB items found to import')
      return
    }
    await initFromRab(projectId, rabItems)
    setConfirmImportOpen(false)
    toast.success('RAB items imported to RAP')
  }

  // --- Scheduler Logic (Simplified for brevity, keeping core UI) ---
  const handleGenerate = (opts?: any) => {
    const keys = makeMonthKeys(monthsInput)
    const generated = planFromWeights(keys, targetTotal, weightsBell(monthsInput))
    setPlan(generated)
  }

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true
    const name = (item as any).name || item.ahsp_items?.name || item.rab_items?.name || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  return (
    <div className="space-y-4 density-compact">
      <div className="panel-compact flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800 dark:text-slate-200 md:text-lg">
            <LayoutList size={18} />
            RAP Budget Control
          </h3>
          <p className="text-xs text-slate-500">Track total budget, actual burn, and time-phased execution plan.</p>
        </div>
        {projectId && <ProfitHealthWidget projectId={projectId} compact />}
      </div>

      <Tabs defaultValue="control" className="w-full">
        <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-slate-50/70 p-1 lg:w-[430px] dark:bg-slate-950/40">
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
            <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
              <CardHeader className="sticky top-0 z-10 flex flex-row items-center justify-between border-b border-slate-100 bg-white/95 pb-2 pt-4 backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/95">
                <div className="flex items-center gap-4">
                  <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-wider">Budget Summary</CardTitle>
                  <div className="relative w-64">
                    <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-slate-400" />
                    <Input
                      placeholder="Search items..."
                      className="control-compact bg-slate-50 border-slate-200 pl-8"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>
                <Button variant="outline" size="sm" onClick={openImportConfirm} disabled={isLoading || items.length > 0 || !projectId} className="control-compact">
                  {items.length > 0 ? 'Synced with RAB' : 'Import from RAB'}
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                    Rp {Math.round(items.reduce((acc, item) => acc + (item.total_budget || 0), 0)).toLocaleString('id-ID')}
                  </div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total RAP Budget</p>
                </div>
              </CardContent>
            </Card>

            <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
              <div className="max-h-[600px] overflow-auto relative">
                <Table>
                  <TableHeader className="sticky-glass-tablehead">
                    <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                      <TableHead className="h-8 w-[300px] bg-transparent text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Item Name</TableHead>
                      <TableHead className="h-8 w-[120px] bg-transparent text-right text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Total Budget</TableHead>
                      <TableHead className="h-8 w-[120px] bg-transparent text-right text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Risk Fund</TableHead>
                      <TableHead className="h-8 w-[120px] bg-transparent text-right text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Actual Cost</TableHead>
                      <TableHead className="h-8 w-[120px] bg-transparent text-right text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Remaining</TableHead>
                      <TableHead className="h-8 w-[100px] bg-transparent text-center text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-12 text-slate-400 bg-slate-50/20">
                          <div className="flex flex-col items-center gap-2">
                            <Search className="h-8 w-8 opacity-20" />
                            <p>{items.length === 0 ? 'No RAP items found. Import from RAB to start.' : 'No items match your search.'}</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredItems.map((item, idx) => {
                        // Traffic Light Logic
                        const progress = item.total_budget > 0 ? (item.actual_cost / item.total_budget) : 0
                        const utilizationPct = Math.max(0, Math.round(progress * 100))
                        let statusColor = 'bg-emerald-500' // Safe
                        let statusText = 'Safe'
                        let rowClass = 'group hover:bg-slate-50 dark:hover:bg-slate-800/50'

                        if (progress > 1.0) {
                          statusColor = 'bg-red-500 animate-pulse' // Critical Overbudget
                          statusText = 'CRITICAL'
                          rowClass = 'group bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50/50 dark:hover:bg-red-900/20'
                        } else if (progress > 0.9) {
                          statusColor = 'bg-amber-500' // Danger Zone
                          statusText = 'Danger'
                          rowClass = 'group bg-amber-50/30 dark:bg-amber-900/10 hover:bg-amber-50/50 dark:hover:bg-amber-900/20'
                        } else if (progress > 0.75) {
                          statusColor = 'bg-yellow-400' // Warning
                          statusText = 'Warning'
                        }

                        // Dummy Risk Fund calc if 0 (Simulated for v3 Demo)
                        const riskFund = item.risk_buffer_amount || (item.total_budget * 0.05)

                        return (
                          <TableRow key={item.id} className={`${rowClass} border-b border-slate-100 dark:border-slate-800 transition-colors`}>
                            <TableCell className="py-2 font-medium">
                              <div className="flex flex-col">
                                <span className="text-xs font-semibold">{(item as any).name || item.ahsp_items?.name || item.rab_items?.name || 'Unnamed Item'}</span>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">Vol: {item.qty_budget}</span>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium text-slate-700 dark:text-slate-300 font-mono text-xs py-2">
                              {Math.round(item.total_budget ?? (item.qty_budget * item.unit_price_budget)).toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-purple-600 dark:text-purple-400 py-2">
                              {Math.round(riskFund).toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs text-red-600 dark:text-red-400 py-2">
                              {Math.round(item.actual_cost).toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="text-right font-bold text-xs font-mono py-2">
                              {Math.round(item.remaining_budget ?? (item.total_budget - item.actual_cost)).toLocaleString('id-ID')}
                            </TableCell>
                            <TableCell className="text-center py-2">
                              <div className="flex flex-col items-center justify-center gap-1">
                                <div className={`h-2 w-12 rounded-full ${statusColor}`} title={statusText} />
                                <Badge
                                  variant={statusText === 'CRITICAL' ? 'destructive' : statusText === 'Danger' ? 'secondary' : 'outline'}
                                  className="h-4 px-1.5 text-[9px] font-semibold uppercase tracking-wider"
                                >
                                  {statusText}
                                </Badge>
                                <span className="text-[10px] font-mono text-slate-400">{utilizationPct}%</span>
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
              onGenerateFromSchedule={() => toast.message('WIP: Link to new items')}
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

      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import RAP items from RAB?</AlertDialogTitle>
            <AlertDialogDescription>
              This action imports all available RAB items into RAP budget control for this project.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleInitFromRab}>Continue Import</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
