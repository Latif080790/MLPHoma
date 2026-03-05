import React, { useEffect, useState, useMemo } from 'react'
import { LayoutList, CalendarClock, Search, Info, ChevronDown, ChevronUp, Download, Plus, Link2, Link2Off } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { useRapStore } from '@/store/rapStore'
import { useRabStore } from '@/store/rabStore'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import ModulePageState from '@/components/common/ModulePageState'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { TrendingUp, Percent, ShieldCheck } from 'lucide-react'
import { rapProfitService } from '@/services/rapProfitService'
import { ProfitHealthWidget } from '@/components/modules/ProfitHealthWidget'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

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

// ── SummaryPill ───────────────────────────────────────────────
function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex flex-col px-3 py-1.5 min-w-[110px]">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</span>
      <span className={`text-sm font-bold font-mono leading-tight ${color}`}>{value}</span>
    </div>
  )
}

export default function RAP(): JSX.Element {
  const project = useProjectStore((s) => s.projects[s.activeProjectId || ''] || null)
  const projectId = project?.id || ''

  // New Store (RAP Items) — all hooks BEFORE any early return
  const { items, fetchItems, initFromRab, isLoading, updateItem } = useRapStore()
  const { getItems: getRabItems, getDraftCount } = useRabStore()

  // Local state
  const [plan, setPlan] = useState<RapPlanItem[]>([])
  const [monthsInput, setMonthsInput] = useState<number>(12)
  const [targetTotal, setTargetTotal] = useState<number>(5_000_000_000)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)
  const [targetProfit, setTargetProfit] = useState(15)
  const [isSimulating, setIsSimulating] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)

  const draftCount = getDraftCount(projectId)

  // Derived totals
  const totals = useMemo(() => {
    const totalBudget = items.reduce((s, i) => s + (i.total_budget || 0), 0)
    const totalCommitted = items.reduce((s, i) => s + (i.committed_cost || 0), 0)
    const totalActual = items.reduce((s, i) => s + (i.actual_cost || 0), 0)
    const totalRemaining = totalBudget - totalCommitted - totalActual
    const efficiency = totalBudget > 0 ? Math.round(((totalBudget - totalActual) / totalBudget) * 100) : 100
    return { totalBudget, totalCommitted, totalActual, totalRemaining, efficiency }
  }, [items])

  useEffect(() => {
    if (project?.meta?.targetProfitPercentage) {
      setTargetProfit(Number(project.meta.targetProfitPercentage))
    }
  }, [project?.meta?.targetProfitPercentage])

  useEffect(() => {
    if (projectId) {
      fetchItems(projectId)
    }
  }, [projectId, fetchItems])

  // ── Null-project guard (after ALL hooks) ─────────────────────────
  if (!project || !projectId) {
    return (
      <ModulePageState
        icon={<LayoutList size={18} />}
        title="RAP Budget Control"
        description="Rencana Anggaran Pelaksanaan — Track budget, committed, dan actual cost per item."
        variant="empty"
        message="Pilih proyek aktif untuk mengakses RAP Budget Control."
      />
    )
  }

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

  const handleApplyProfitSimulation = async () => {
    if (!projectId) return
    setIsSimulating(true)
    try {
      await rapProfitService.setTargetProfitPct(projectId, targetProfit)
      await rapProfitService.recalculateWithProfitFirst(projectId)
      await fetchItems(projectId)
      toast.success(`RAP recalculated with ${targetProfit}% Profit Target`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      toast.error('Failed to apply profit simulation: ' + message)
    } finally {
      setIsSimulating(false)
    }
  }

  // --- Scheduler Logic (Simplified for brevity, keeping core UI) ---
  const handleGenerate = () => {
    const keys = makeMonthKeys(monthsInput)
    const generated = planFromWeights(keys, targetTotal, weightsBell(monthsInput))
    setPlan(generated)
  }

  const filteredItems = items.filter(item => {
    if (!searchQuery) return true
    const name = item.name || item.ahsp_items?.name || item.rab_items?.name || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Items without ahsp_id won't feed Resource Plan — show warning
  const projectItems = items.filter(i => i.project_id === projectId)
  const unlinkedAHSPCount = projectItems.filter(i => !i.ahsp_id).length

  // Task 41: Export Excel
  const handleExportExcel = async () => {
    const { utils, writeFile } = await import('xlsx')
    const rows = items.map(i => ({
      'Item Name': i.name || i.ahsp_items?.name || i.rab_items?.name || '',
      'Total Budget': i.total_budget || 0,
      'Committed Cost': i.committed_cost || 0,
      'Actual Cost': i.actual_cost || 0,
      'Remaining': (i.total_budget || 0) - (i.committed_cost || 0) - (i.actual_cost || 0),
    }))
    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'RAP Budget')
    writeFile(wb, `rap-budget-${projectId}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // Task 35: Inline edit handler
  const handleInlineEdit = (itemId: string, field: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateItem({ id: itemId, [field]: num })
  }

  return (
    <div className="space-y-4 density-compact">
      <ModuleHeader
        icon={<LayoutList size={18} />}
        title="RAP Budget Control"
        description={`Rencana Anggaran Pelaksanaan — ${project.name}`}
        accent="emerald"
        actions={
          <div className="flex items-center gap-2">
            {projectId && <ProfitHealthWidget projectId={projectId} compact />}
            <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExportExcel} disabled={!items.length}>
              <Download size={13} />
              Export Excel
            </Button>
          </div>
        }
      />

      {/* Wrapper without nested tabs — just Budget Control + collapsible Scheduler */}
      <div className="space-y-4">

        {/* ── Budget Control section */}
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
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openImportConfirm}
                        disabled={isLoading || !projectId || draftCount > 0}
                        className={`control-compact ${draftCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {items.length > 0 ? 'Re-sync from RAB' : 'Import from RAB'}
                      </Button>
                    </div>
                  </TooltipTrigger>
                  {draftCount > 0 && (
                    <TooltipContent className="bg-amber-50 text-amber-700 border-amber-200 text-xs max-w-[240px]">
                      <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-900">
                        <Info size={14} />
                        Unpublished Changes
                      </p>
                      There are <strong>{draftCount}</strong> unpublished changes in RAB.
                      Please <strong>Publish</strong> your RAB baseline before syncing to RAP.
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </CardHeader>
            <CardContent className="pt-0 pb-3">
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div className="mt-2 flex items-baseline gap-2">
                  <div className="text-2xl font-bold font-mono text-slate-800 dark:text-slate-100">
                    Rp {Math.round(items.reduce((acc, item) => acc + (item.total_budget || 0), 0)).toLocaleString('id-ID')}
                  </div>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-wider">Total RAP Budget</p>
                </div>

                <div className="flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50 p-2 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div className="flex flex-col">
                    <span className="text-xs font-bold text-slate-500 uppercase tracking-tight flex items-center gap-1">
                      <TrendingUp size={10} className="text-emerald-500" />
                      Profit Simulation
                    </span>
                    <div className="flex items-center gap-2 mt-1">
                      <div className="relative">
                        <Input
                          type="number"
                          value={targetProfit}
                          onChange={(e) => setTargetProfit(Number(e.target.value))}
                          className="h-7 w-16 text-xs font-mono pr-5 py-0"
                        />
                        <Percent size={10} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs font-bold bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800"
                        onClick={handleApplyProfitSimulation}
                        disabled={isSimulating || !items.length}
                      >
                        <ShieldCheck size={12} className="mr-1" />
                        Apply Profit First
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
            {/* AHSP linkage warning — items without ahsp_id won't show in Resource Plan */}
            {unlinkedAHSPCount > 0 && (
              <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/70 px-4 py-2 text-xs dark:border-amber-800 dark:bg-amber-900/20">
                <Link2Off size={13} className="shrink-0 text-amber-600" />
                <span className="text-amber-700 dark:text-amber-300">
                  <strong>{unlinkedAHSPCount} dari {projectItems.length} item</strong> belum terhubung ke AHSP — item ini tidak akan dihitung di Resource Plan.
                  Re-sync dari RAB untuk mengisi link AHSP secara otomatis.
                </span>
              </div>
            )}
            <div className="max-h-[600px] overflow-auto relative">
              <Table>
                <TableHeader className="sticky-glass-tablehead">
                  <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
                    <TableHead className="h-8 w-[300px] bg-transparent text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Item Name</TableHead>
                    <TableHead className="h-8 w-[120px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Total Budget</TableHead>
                    <TableHead className="h-8 w-[120px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Committed</TableHead>
                    <TableHead className="h-8 w-[120px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Actual Cost</TableHead>
                    <TableHead className="h-8 w-[120px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Remaining</TableHead>
                    <TableHead className="h-8 w-[100px] bg-transparent text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredItems.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12 text-slate-400 bg-slate-50/20">
                        {/* Task 38: Enhanced import CTA */}
                        <div className="flex flex-col items-center gap-3">
                          <LayoutList className="h-10 w-10 text-emerald-400/50" />
                          <div>
                            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                              {items.length === 0 ? 'Belum ada item RAP' : 'Tidak ada item yang cocok'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {items.length === 0 ? 'Import dari RAB untuk mengisi daftar RAP budget.' : 'Ubah kata kunci pencarian Anda.'}
                            </p>
                          </div>
                          {items.length === 0 && (
                            <Button size="sm" variant="default" className="h-9 gap-2 text-xs mt-1" onClick={openImportConfirm} disabled={isLoading || draftCount > 0}>
                              <Plus size={14} />
                              Import dari RAB
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredItems.map((item) => {
                      // Traffic Light Logic (Budget Guard)
                      const totalBudget = item.total_budget || (item.qty_budget * item.unit_price_budget) || 0
                      const committedCost = item.committed_cost || 0
                      const actualCost = item.actual_cost || 0
                      const totalBurn = committedCost + actualCost

                      const burnRatio = totalBudget > 0 ? (totalBurn / totalBudget) : 0
                      const utilizationPct = Math.round(burnRatio * 100)

                      let statusColor = 'bg-emerald-500' // Safe (< 90%)
                      let statusText = 'Safe'
                      let rowClass = 'group hover:bg-slate-50 dark:hover:bg-slate-800/50'

                      if (burnRatio >= 1.0) {
                        statusColor = 'bg-red-500 animate-pulse' // Critical Overbudget (> 100%)
                        statusText = 'CRITICAL'
                        rowClass = 'group bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50/50 dark:hover:bg-red-900/20'
                      } else if (burnRatio >= 0.9) {
                        statusColor = 'bg-amber-500' // Danger Zone (90-100%)
                        statusText = 'Danger'
                        rowClass = 'group bg-amber-50/30 dark:bg-amber-900/10 hover:bg-amber-50/50 dark:hover:bg-amber-900/20'
                      } else if (burnRatio >= 0.75) {
                        statusColor = 'bg-yellow-400' // Warning (75-90%)
                        statusText = 'Warning'
                      }

                      // Calculated remaining (Total Budget - Committed - Actual)
                      const remaining = totalBudget - totalBurn

                      return (
                        <TableRow key={item.id} className={`${rowClass} border-b border-slate-100 dark:border-slate-800 transition-colors`}>
                          <TableCell className="py-2 font-medium">
                            <div className="flex flex-col">
                              <span className="text-xs font-semibold">{item.name || item.ahsp_items?.name || item.rab_items?.name || 'Unnamed Item'}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-slate-400 font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">Vol: {item.qty_budget}</span>
                                {item.ahsp_id ? (
                                  <span className="inline-flex items-center gap-0.5 text-xs text-emerald-600 dark:text-emerald-400">
                                    <Link2 size={10} />
                                    <span className="font-mono">{item.ahsp_items?.name || item.ahsp_id.slice(-6)}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-0.5 text-xs text-amber-500 dark:text-amber-400">
                                    <Link2Off size={10} />
                                    <span>No AHSP</span>
                                  </span>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-medium text-slate-700 dark:text-slate-300 font-mono text-xs py-2">
                            {Math.round(totalBudget).toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-blue-600 dark:text-blue-400 py-2">
                            {/* Task 35: Inline edit committed cost */}
                            <Input
                              type="number"
                              value={committedCost || ''}
                              onChange={e => handleInlineEdit(item.id, 'committed_cost', e.target.value)}
                              className="h-6 w-24 text-right font-mono text-xs border-transparent bg-transparent hover:bg-white focus:bg-white hover:border-blue-200 focus:border-blue-500 shadow-none text-blue-600 inline-flex ml-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs text-amber-600 dark:text-amber-400 py-2">
                            {/* Task 35: Inline edit actual cost */}
                            <Input
                              type="number"
                              value={actualCost || ''}
                              onChange={e => handleInlineEdit(item.id, 'actual_cost', e.target.value)}
                              className="h-6 w-24 text-right font-mono text-xs border-transparent bg-transparent hover:bg-white focus:bg-white hover:border-amber-200 focus:border-amber-500 shadow-none text-amber-600 inline-flex ml-auto"
                            />
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs font-mono py-2 text-slate-900 dark:text-slate-100">
                            {Math.round(remaining).toLocaleString('id-ID')}
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <div className="flex flex-col items-center justify-center gap-1">
                              <div className={`h-2 w-12 rounded-full ${statusColor}`} title={`${statusText}: ${utilizationPct}% used (Committed + Actual)`} />
                              <Badge
                                variant={statusText === 'CRITICAL' ? 'destructive' : statusText === 'Danger' ? 'secondary' : 'outline'}
                                className="h-4 px-1.5 text-xs font-semibold uppercase tracking-wider"
                              >
                                {statusText}
                              </Badge>
                              <span className="text-xs font-mono text-slate-400">{utilizationPct}%</span>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
                {/* Task 37: Sticky footer with totals */}
                {filteredItems.length > 0 && (
                  <TableFooter className="sticky bottom-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md z-20 border-t-2 border-slate-200 dark:border-slate-700">
                    <TableRow className="hover:bg-transparent">
                      <TableCell className="py-2 text-right font-bold text-xs text-slate-500 uppercase tracking-wider">Totals</TableCell>
                      <TableCell className="text-right font-bold font-mono text-xs text-slate-700 dark:text-slate-200 py-2">{Math.round(totals.totalBudget).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right font-bold font-mono text-xs text-blue-600 py-2">{Math.round(totals.totalCommitted).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="text-right font-bold font-mono text-xs text-amber-600 py-2">{Math.round(totals.totalActual).toLocaleString('id-ID')}</TableCell>
                      <TableCell className={`text-right font-bold font-mono text-xs py-2 ${totals.totalRemaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Math.round(totals.totalRemaining).toLocaleString('id-ID')}</TableCell>
                      <TableCell className="py-2" />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          </div>
        </div>

        {/* ── Summary totals bar ─────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-0 divide-x divide-slate-200 rounded-lg border border-slate-200 bg-slate-50/80 px-1 py-1 text-xs dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-800/50">
          <SummaryPill label="Total Budget" value={`Rp ${Math.round(totals.totalBudget).toLocaleString('id-ID')}`} color="text-slate-700" />
          <SummaryPill label="Committed" value={`Rp ${Math.round(totals.totalCommitted).toLocaleString('id-ID')}`} color="text-blue-600" />
          <SummaryPill label="Actual Cost" value={`Rp ${Math.round(totals.totalActual).toLocaleString('id-ID')}`} color="text-amber-600" />
          <SummaryPill
            label="Remaining"
            value={`Rp ${Math.round(totals.totalRemaining).toLocaleString('id-ID')}`}
            color={totals.totalRemaining < 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}
          />
          <SummaryPill label="Efisiensi" value={`${totals.efficiency}%`} color={totals.efficiency >= 90 ? 'text-emerald-600' : totals.efficiency >= 75 ? 'text-amber-600' : 'text-red-600'} />
        </div>

        {/* ── Collapsible Scheduler ──────────────────────────────── */}
        <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <button
            type="button"
            className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/50 transition-colors"
            onClick={() => setShowScheduler(v => !v)}
          >
            <span className="flex items-center gap-2">
              <CalendarClock size={15} />
              Scheduler S-Curve
              <span className="text-xs font-normal text-slate-400">(Rencana distribusi biaya per bulan)</span>
            </span>
            {showScheduler ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
          {showScheduler && (
            <div className="space-y-4 border-t border-slate-100 p-4 dark:border-slate-700">
              <RapToolbar
                months={monthsInput}
                setMonths={setMonthsInput}
                targetTotal={targetTotal}
                setTargetTotal={setTargetTotal}
                onGenerate={() => handleGenerate()}
                onGenerateFromSchedule={() => toast.message('WIP: Fitur ini akan segera tersedia')}
                onPreset={() => toast.message('Segera hadir')}
                onNormalize={() => toast.message('Segera hadir')}
                onSmooth={() => toast.message('Segera hadir')}
                onLockBaseline={() => toast.message('Segera hadir')}
                onExport={() => toast.message('Segera hadir')}
                onImport={() => toast.message('Segera hadir')}
              />
              <RapDistributionChart plan={plan} title="Planned Curve" />
              <RapMonthTable plan={plan} setPlan={setPlan} />
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirmImportOpen} onOpenChange={setConfirmImportOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Import RAP items from RAB?</AlertDialogTitle>
            <AlertDialogDescription>
              This action synchronizes your RAP budget with the current RAB estimate.
              <strong>Smart Sync:</strong> Existing items with committed or actual costs (like Purchase Orders) will be preserved. Newly added RAB items will be imported, and removed items will only be deleted if they have no costs.
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
