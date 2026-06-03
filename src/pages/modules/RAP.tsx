import React, { useEffect, useState, useMemo, useRef } from 'react'
import { LayoutList, CalendarClock, Search, Info, ChevronDown, ChevronUp, Plus, Link2, Link2Off, Loader2 } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { useRapStore } from '@/store/rapStore'
import { useRabStore } from '@/store/rabStore'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import ModulePageState from '@/components/common/ModulePageState'
import { TableSkeleton } from '@/components/common/LoadingSkeleton'
import { EVMGuardPanel } from '@/components/costing'
import { formatIDR } from '@/lib/utils'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { TrendingUp, Percent, ShieldCheck } from 'lucide-react'
import { rapProfitService } from '@/services/rapProfitService'
import { rabService } from '@/services/rabService'
import type { RABItem } from '@/types/rab'
import { sellingFromBase, kontribusi, bonus } from '@/lib/costingMargin'
import { readMarginSettings, effectiveMarginPct } from '@/lib/marginSettings'
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
import { ExportMenu } from '@/components/shared/ExportMenu'

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

// Stable empty fallback — prevents Zustand selector from returning a new array each render
const EMPTY_RAB_ITEMS: RABItem[] = []

/** RAB contract value with cross-naming fallbacks (mirrors WBS budget linkage) */
function rabContractValue(r: RABItem): number {
  return (
    r.finalTotal ??
    r.final_total ??
    r.finalPrice ??
    (r.volume ?? 0) * (r.unit_price ?? r.unitPrice ?? 0)
  )
}

// ── KPICard ─────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, colorClass }: { label: string; value: string; sub?: string; colorClass: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-4 py-3 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-1">{label}</div>
      <div className={`text-base font-bold font-mono leading-tight truncate ${colorClass}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-400">{sub}</div>}
    </div>
  )
}

export default function RAP({ embedded = false }: { embedded?: boolean }): JSX.Element {
  const project = useProjectStore((s) => s.projects[s.activeProjectId || ''] || null)
  const projectId = project?.id || ''

  // New Store (RAP Items) — all hooks BEFORE any early return
  const { items, fetchItems, initFromRab, loading: isLoading, updateItem } = useRapStore()
  const { getDraftCount, fetchItems: fetchRabItems } = useRabStore()
  // RAB contract values (with overhead+profit) — RAP total_budget is execution cost (AHSP base),
  // so RAB − RAP per linked item is the planned gross margin.
  const rabItemsForMargin = useRabStore((s) => (projectId ? s.getItems(projectId) : EMPTY_RAB_ITEMS))

  // Local state
  const [plan, setPlan] = useState<RapPlanItem[]>([])
  const [monthsInput, setMonthsInput] = useState<number>(12)
  const [targetTotal, setTargetTotal] = useState<number>(5_000_000_000)
  const [searchQuery, setSearchQuery] = useState('')
  const [confirmImportOpen, setConfirmImportOpen] = useState(false)
  const [isRabLoading, setIsRabLoading] = useState(false)
  const [pendingRabItems, setPendingRabItems] = useState<any[]>([])
  const [targetProfit, setTargetProfit] = useState(15)
  const [isSimulating, setIsSimulating] = useState(false)
  const [showScheduler, setShowScheduler] = useState(false)

  // Inline-edit local buffer so inputs don't snap while Supabase call is debounced
  const [localEdits, setLocalEdits] = useState<Record<string, string>>({})
  const editTimers = useRef(new Map<string, ReturnType<typeof setTimeout>>())

  const draftCount = getDraftCount(projectId)

  // Derived totals
  const totals = useMemo(() => {
    // Filter by projectId so multi-project store contamination doesn't inflate totals
    const pItems = items.filter(i => i.project_id === projectId)
    const totalBudget = pItems.reduce((s, i) => s + (i.total_budget || 0), 0)
    const totalCommitted = pItems.reduce((s, i) => s + (i.committed_cost || 0), 0)
    const totalActual = pItems.reduce((s, i) => s + (i.actual_cost || 0), 0)
    const totalRemaining = totalBudget - totalCommitted - totalActual
    const efficiency = totalBudget > 0 ? Math.round(((totalBudget - totalActual) / totalBudget) * 100) : 100
    return { totalBudget, totalCommitted, totalActual, totalRemaining, efficiency }
  }, [items, projectId])

  // Margin settings (mode + default% + per-item overrides) from project.meta.
  const marginSettings = useMemo(() => readMarginSettings(project?.meta), [project?.meta])

  // RAB CONTRACT (selling, ex-PPN) per source RAB item id, margin-on-revenue: base / (1 - m%).
  const rabSellingById = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rabItemsForMargin) {
      if (!r.id) continue
      const base = rabContractValue(r)
      m.set(r.id, sellingFromBase(base, effectiveMarginPct(marginSettings, r.id)))
    }
    return m
  }, [rabItemsForMargin, marginSettings])

  // RAP Kontribusi (plafon) per source RAB item id = AHSP base cost = RAB base (pre-margin).
  const rapKontribusiById = useMemo(() => {
    const m = new Map<string, number>()
    for (const r of rabItemsForMargin) {
      if (!r.id) continue
      m.set(r.id, rabContractValue(r))
    }
    return m
  }, [rabItemsForMargin])

  // Project waterfall totals.
  const waterfall = useMemo(() => {
    const pItems = items.filter((i) => i.project_id === projectId)
    // RAB selling & RAP kontribusi are per-RAB-item figures, so sum them over the
    // set of UNIQUE linked rab_item_ids — multiple RAP items may reference the same
    // RAB item and must not double-count the contract value. RAPP (total_budget) is a
    // per-RAP-item figure and is summed across every RAP item.
    const linkedRabIds = new Set<string>()
    let rapp = 0
    for (const it of pItems) {
      if (it.rab_item_id) linkedRabIds.add(it.rab_item_id)
      rapp += it.total_budget || 0
    }
    let rabSelling = 0
    let rapKontribusi = 0
    for (const rabId of linkedRabIds) {
      rabSelling += rabSellingById.get(rabId) ?? 0
      rapKontribusi += rapKontribusiById.get(rabId) ?? 0
    }
    const kontribusiRp = kontribusi(rabSelling, rapKontribusi)
    const bonusRp = bonus(rapKontribusi, rapp)
    return {
      rabSelling,
      rapKontribusi,
      rapp,
      kontribusiRp,
      kontribusiPct: rabSelling > 0 ? (kontribusiRp / rabSelling) * 100 : 0,
      bonusRp,
      bonusPct: rapKontribusi > 0 ? (bonusRp / rapKontribusi) * 100 : 0,
    }
  }, [items, projectId, rabSellingById, rapKontribusiById])

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

  useEffect(() => {
    if (projectId) {
      fetchRabItems(projectId)
    }
  }, [projectId, fetchRabItems])

  // Cancel any pending debounce timers on unmount (prevents setState on unmounted component)
  useEffect(() => {
    const timers = editTimers.current
    return () => {
      timers.forEach(t => clearTimeout(t))
      timers.clear()
    }
  }, [])

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

  const openImportConfirm = async () => {
    setIsRabLoading(true)
    try {
      // Fetch directly from Supabase — bypasses the store's localOnlyItems
      // so we only import items that actually exist in the rab_items table.
      // Using the store's getRabItems would include local-only drafts whose IDs
      // don't exist in DB, causing FK constraint error 23503 in rap_items.
      const dbItems = await rabService.fetchRabItems(projectId)
      if (!dbItems.length) {
        toast.error('Belum ada item RAB yang dipublish. Publish item RAB terlebih dahulu di modul RAB.')
        return
      }
      setPendingRabItems(dbItems)
      setConfirmImportOpen(true)
    } catch (err) {
      toast.error('Gagal memuat item RAB: ' + (err as Error).message)
    } finally {
      setIsRabLoading(false)
    }
  }

  const handleInitFromRab = async () => {
    if (!pendingRabItems.length) return
    try {
      await initFromRab(projectId, pendingRabItems)
      setConfirmImportOpen(false)
      setPendingRabItems([])
    } catch (error) {
      console.error('Import failed', error)
    }
  }

  const handleApplyProfitSimulation = async () => {
    if (!projectId) return
    setIsSimulating(true)
    try {
      await rapProfitService.setTargetProfitPct(projectId, targetProfit)
      await rapProfitService.recalculateWithProfitFirst(projectId)
      await fetchItems(projectId)
      toast.success(`RAP dihitung ulang dengan Target Efisiensi ${targetProfit}%`)
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

  // Filter by projectId first to prevent multi-project store data contamination
  const projectItems = items.filter(i => i.project_id === projectId)
  const filteredItems = projectItems.filter(item => {
    if (!searchQuery) return true
    const name = item.name || item.ahsp_items?.name || item.rab_items?.name || ''
    return name.toLowerCase().includes(searchQuery.toLowerCase())
  })

  // Items without ahsp_id won't feed Resource Plan — show warning
  const unlinkedAHSPCount = projectItems.filter(i => !i.ahsp_id).length

  const handleInlineEdit = (itemId: string, field: string, val: string) => {
    const key = `${itemId}:${field}`
    setLocalEdits(prev => ({ ...prev, [key]: val }))

    // Clear any pending save for this field (handles backspace/clear mid-type)
    const existing = editTimers.current.get(key)
    if (existing) clearTimeout(existing)

    const num = parseFloat(val)
    if (isNaN(num)) return

    editTimers.current.set(key, setTimeout(() => {
      updateItem({ id: itemId, [field]: num })
      editTimers.current.delete(key)
      setLocalEdits(prev => { const n = { ...prev }; delete n[key]; return n })
    }, 400))
  }

  // ── Shared table block (used in both layouts) ───────────────────
  const rapTableBlock = (
    <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
      {unlinkedAHSPCount > 0 && (
        <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/70 px-4 py-2 text-xs dark:border-amber-800 dark:bg-amber-900/20">
          <Link2Off size={13} className="shrink-0 text-amber-600" />
          <span className="text-amber-700 dark:text-amber-300">
            <strong>{unlinkedAHSPCount} dari {projectItems.length} item</strong> belum terhubung ke AHSP — item ini tidak akan dihitung di Resource Plan.
            Re-sync dari RAB untuk mengisi link AHSP secara otomatis.
          </span>
        </div>
      )}
      <div className="max-h-full overflow-auto relative">
        <Table>
          <TableHeader className="sticky-glass-tablehead">
            <TableRow className="border-b border-slate-200 dark:border-slate-800 hover:bg-transparent">
              <TableHead className="h-8 w-[300px] bg-transparent text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Item Name</TableHead>
              <TableHead className="h-8 w-[120px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Total Budget</TableHead>
              <TableHead className="h-8 w-[120px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Committed</TableHead>
              <TableHead className="h-8 w-[120px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Actual Cost</TableHead>
              <TableHead className="h-8 w-[120px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Remaining</TableHead>
              <TableHead className="h-8 w-[130px] bg-transparent text-right text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300" title="Plafon RAP − RAPP = efisiensi bila PM menekan biaya pelaksanaan">Efisiensi (RAP−RAPP)</TableHead>
              <TableHead className="h-8 w-[100px] bg-transparent text-center text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && projectItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-4">
                  <TableSkeleton rows={6} columns={6} />
                </TableCell>
              </TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-slate-400 bg-slate-50/20">
                  <div className="flex flex-col items-center gap-3">
                    <LayoutList className="h-10 w-10 text-emerald-400/50" />
                    <div>
                      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                        {projectItems.length === 0 ? 'Belum ada item RAP' : 'Tidak ada item yang cocok'}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">
                        {projectItems.length === 0 ? 'Import dari RAB untuk mengisi daftar RAP budget.' : 'Ubah kata kunci pencarian Anda.'}
                      </p>
                    </div>
                    {projectItems.length === 0 && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div>
                              <Button size="sm" variant="default" className="h-9 gap-2 text-xs mt-1" onClick={openImportConfirm} disabled={isLoading || isRabLoading}>
                                {isRabLoading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                {isRabLoading ? 'Memuat RAB...' : 'Import dari RAB'}
                              </Button>
                            </div>
                          </TooltipTrigger>
                          {draftCount > 0 && (
                            <TooltipContent className="bg-amber-50 text-amber-700 border-amber-200 text-xs max-w-[240px]">
                              <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-900">
                                <Info size={14} />
                                Ada Draft Belum Dipublish
                              </p>
                              <strong>{draftCount}</strong> item RAB masih draft lokal dan tidak akan diimport. Hanya item yang sudah dipublish di modul RAB yang akan diimport ke RAP.
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => {
                const totalBudget = item.total_budget || (item.qty_budget * item.unit_price_budget) || 0
                // Waterfall per item: RAP Kontribusi (plafon = base) − RAPP (total_budget) = Bonus.
                const rapKontribusi = item.rab_item_id ? rapKontribusiById.get(item.rab_item_id) ?? 0 : 0
                const itemBonusRp = bonus(rapKontribusi, totalBudget)
                const itemBonusPct = rapKontribusi > 0 ? (itemBonusRp / rapKontribusi) * 100 : null
                const committedCost = item.committed_cost || 0
                const actualCost = item.actual_cost || 0
                const totalBurn = committedCost + actualCost
                const burnRatio = totalBudget > 0 ? (totalBurn / totalBudget) : 0
                const utilizationPct = Math.round(burnRatio * 100)
                let statusColor = 'bg-emerald-500'
                let statusText = 'Safe'
                let rowClass = 'group hover:bg-slate-50 dark:hover:bg-slate-800/50'
                if (burnRatio >= 1.0) {
                  statusColor = 'bg-red-500 animate-pulse'
                  statusText = 'CRITICAL'
                  rowClass = 'group bg-red-50/30 dark:bg-red-900/10 hover:bg-red-50/50 dark:hover:bg-red-900/20'
                } else if (burnRatio >= 0.9) {
                  statusColor = 'bg-amber-500'
                  statusText = 'Danger'
                  rowClass = 'group bg-amber-50/30 dark:bg-amber-900/10 hover:bg-amber-50/50 dark:hover:bg-amber-900/20'
                } else if (burnRatio >= 0.75) {
                  statusColor = 'bg-yellow-400'
                  statusText = 'Warning'
                }
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
                    <TableCell className="text-right py-1.5 px-2">
                      <Input
                        type="number"
                        value={localEdits[`${item.id}:committed_cost`] ?? (committedCost || '')}
                        onChange={e => handleInlineEdit(item.id, 'committed_cost', e.target.value)}
                        className="h-8 w-full text-right font-mono text-xs border-slate-200 bg-slate-50/60 hover:bg-white focus:bg-white focus:border-blue-500 shadow-none text-blue-700"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-right py-1.5 px-2">
                      <Input
                        type="number"
                        value={localEdits[`${item.id}:actual_cost`] ?? (actualCost || '')}
                        onChange={e => handleInlineEdit(item.id, 'actual_cost', e.target.value)}
                        className="h-8 w-full text-right font-mono text-xs border-slate-200 bg-slate-50/60 hover:bg-white focus:bg-white focus:border-amber-500 shadow-none text-amber-700"
                        placeholder="0"
                      />
                    </TableCell>
                    <TableCell className="text-right font-bold text-xs font-mono py-2 text-slate-900 dark:text-slate-100">
                      {Math.round(remaining).toLocaleString('id-ID')}
                    </TableCell>
                    <TableCell className="text-right py-2 font-mono text-xs">
                      {itemBonusPct === null ? (
                        <span className="text-slate-300" title="Item belum terhubung ke RAB">—</span>
                      ) : (
                        <div className="flex flex-col items-end leading-tight" title={`Plafon RAP ${Math.round(rapKontribusi).toLocaleString('id-ID')} − RAPP ${Math.round(totalBudget).toLocaleString('id-ID')}`}>
                          <span className={`font-bold ${itemBonusRp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            {itemBonusPct >= 0 ? '+' : ''}{itemBonusPct.toFixed(1)}%
                          </span>
                          <span className="text-slate-400">{Math.round(itemBonusRp).toLocaleString('id-ID')}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-2">
                      <div className="flex flex-col items-center justify-center gap-1">
                        <div className={`h-2 w-12 rounded-full ${statusColor}`} title={`${statusText}: ${utilizationPct}% used`} />
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
          {filteredItems.length > 0 && (
            <TableFooter className="sticky bottom-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-md z-20 border-t-2 border-slate-200 dark:border-slate-700">
              <TableRow className="hover:bg-transparent">
                <TableCell className="py-2 text-right font-bold text-xs text-slate-500 uppercase tracking-wider">Totals</TableCell>
                <TableCell className="text-right font-bold font-mono text-xs text-slate-700 dark:text-slate-200 py-2">{Math.round(totals.totalBudget).toLocaleString('id-ID')}</TableCell>
                <TableCell className="text-right font-bold font-mono text-xs text-blue-600 py-2">{Math.round(totals.totalCommitted).toLocaleString('id-ID')}</TableCell>
                <TableCell className="text-right font-bold font-mono text-xs text-amber-600 py-2">{Math.round(totals.totalActual).toLocaleString('id-ID')}</TableCell>
                <TableCell className={`text-right font-bold font-mono text-xs py-2 ${totals.totalRemaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Math.round(totals.totalRemaining).toLocaleString('id-ID')}</TableCell>
                <TableCell className={`text-right font-bold font-mono text-xs py-2 ${waterfall.bonusRp >= 0 ? 'text-emerald-600' : 'text-rose-600'}`} title={`Efisiensi ${Math.round(waterfall.bonusRp).toLocaleString('id-ID')}`}>
                  {waterfall.rapKontribusi === 0 ? '—' : `${waterfall.bonusRp >= 0 ? '+' : ''}${waterfall.bonusPct.toFixed(1)}%`}
                </TableCell>
                <TableCell className="py-2" />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )

  // ── Embedded: Variant D layout ────────────────────────────────
  if (embedded) {
    return (
      <>
      <div
        className="flex flex-col overflow-hidden rounded-xl border border-slate-200 shadow-sm"
        style={{ height: 'calc(100vh - 180px)', minHeight: '480px' }}
      >
        {/* ── Row 1: Profit health + budget util (left) | Target Efisiensi (right) ── */}
        <div className="px-4 py-1.5 bg-white border-b border-slate-200 flex items-center gap-4 flex-shrink-0">
          {/* Left: Profit Margin widget */}
          <div className="flex items-center gap-2 flex-shrink-0">
            {projectId && <ProfitHealthWidget projectId={projectId} compact />}
          </div>
          {/* Center: Budget utilization bar */}
          {totals.totalBudget > 0 && (() => {
            const burnPct = Math.min((totals.totalCommitted + totals.totalActual) / totals.totalBudget, 1) * 100
            const isOverrun = totals.totalRemaining < 0
            return (
              <div className="flex-1 min-w-[140px] max-w-xs">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Budget Utilization</span>
                  <span className={`text-xs font-bold font-mono ${isOverrun ? 'text-rose-600' : burnPct > 90 ? 'text-amber-600' : 'text-emerald-600'}`}>
                    {burnPct.toFixed(1)}% terpakai
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isOverrun ? 'bg-rose-500' : burnPct > 90 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(burnPct, 100)}%` }}
                  />
                </div>
              </div>
            )
          })()}
          {/* Right: Target Efisiensi input + Apply */}
          <div className="ml-auto flex items-center gap-2 flex-shrink-0">
            <TrendingUp size={12} className="text-emerald-600 flex-shrink-0" />
            <span className="text-xs font-bold text-emerald-700 uppercase tracking-wider whitespace-nowrap">Target Efisiensi</span>
            <div className="relative">
              <Input
                type="number"
                value={targetProfit}
                onChange={e => setTargetProfit(Number(e.target.value))}
                className="h-6 w-14 text-xs font-mono pr-4 py-0"
              />
              <Percent size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
            <Button
              size="sm"
              className="h-6 px-2 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 border-0"
              onClick={handleApplyProfitSimulation}
              disabled={isSimulating || !items.length}
            >
              <ShieldCheck size={11} className="mr-1" />
              Apply
            </Button>
            {draftCount > 0 && (
              <span className="text-xs text-amber-600">{draftCount} draft</span>
            )}
          </div>
        </div>

        {/* ── Row 2: KPI strip (7 cells) + search + Re-sync at far right ── */}
        <div className="flex items-stretch border-b border-slate-200 bg-slate-200 gap-px flex-shrink-0">
          {([
            { label: 'TOTAL BUDGET',     value: formatIDR(totals.totalBudget),       cls: 'text-slate-900' },
            { label: 'COMMITTED',        value: formatIDR(totals.totalCommitted),    cls: 'text-blue-600' },
            { label: 'ACTUAL COST',      value: formatIDR(totals.totalActual),       cls: 'text-amber-600' },
            { label: 'REMAINING',        value: formatIDR(totals.totalRemaining),    cls: totals.totalRemaining < 0 ? 'text-red-600' : 'text-emerald-600' },
            {
              label: 'SISA BUDGET',
              value: totals.totalBudget === 0 ? '—' : `${totals.efficiency}%`,
              cls: totals.efficiency >= 90 ? 'text-emerald-600' : totals.efficiency >= 75 ? 'text-amber-600' : 'text-red-600',
            },
            {
              label: 'KONTRIBUSI KANTOR',
              value: waterfall.rabSelling === 0 ? '—' : formatIDR(waterfall.kontribusiRp),
              cls: waterfall.kontribusiRp >= 0 ? 'text-violet-600' : 'text-rose-600',
            },
            {
              label: 'EFISIENSI PROYEK',
              value: waterfall.rapKontribusi === 0 ? '—' : formatIDR(waterfall.bonusRp),
              cls: waterfall.bonusRp >= 0 ? 'text-emerald-600' : 'text-rose-600',
            },
          ] as const).map(({ label, value, cls }) => (
            <div key={label} className="flex-1 bg-white px-3 py-2.5 min-w-0">
              <div className="text-xs font-bold uppercase tracking-widest text-slate-400 truncate">{label}</div>
              <div className={`font-bold text-sm font-mono mt-0.5 truncate ${cls}`}>{value}</div>
            </div>
          ))}
          {/* Far right: search + Re-sync RAB */}
          <div className="bg-white flex items-center gap-1.5 px-3 flex-shrink-0">
            <div className="relative">
              <Search size={11} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari item..."
                className="w-32 pl-6 pr-2 py-1 text-xs border border-slate-200 rounded bg-slate-50 focus:outline-none focus:border-blue-400 focus:bg-white transition-colors placeholder:text-slate-300"
              />
            </div>
            <button
              onClick={openImportConfirm}
              disabled={isLoading || isRabLoading}
              className="flex items-center gap-1.5 text-xs text-slate-600 px-2 py-1 rounded border border-slate-200 hover:border-slate-300 transition-all disabled:opacity-50 whitespace-nowrap"
            >
              {isRabLoading ? <Loader2 size={11} className="animate-spin" /> : <Plus size={11} />}
              {isRabLoading ? 'Memuat...' : items.length > 0 ? 'Re-sync RAB' : 'Import RAB'}
            </button>
          </div>
        </div>

        {/* ── Main: table + EVM guard ─────────────────────────── */}
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col bg-white overflow-auto">
            {rapTableBlock}
          </div>
          <EVMGuardPanel projectId={projectId} />
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
      </>
    )
  }

  return (
    <div className="space-y-4 density-compact">
      {!embedded && (<ModuleHeader
        icon={<LayoutList size={18} />}
        title="RAP Budget Control"
        description={`Rencana Anggaran Pelaksanaan — ${project.name}`}
        accent="emerald"
        actions={
          <div className="flex items-center gap-2">
            {projectId && <ProfitHealthWidget projectId={projectId} compact />}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 gap-1.5 text-xs"
                      onClick={openImportConfirm}
                      disabled={isLoading || isRabLoading || !projectId}
                    >
                      {isRabLoading ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      {isRabLoading ? 'Memuat RAB...' : items.length > 0 ? 'Re-sync from RAB' : 'Import from RAB'}
                    </Button>
                  </div>
                </TooltipTrigger>
                {draftCount > 0 && (
                  <TooltipContent className="bg-amber-50 text-amber-700 border-amber-200 text-xs max-w-[240px]">
                    <p className="font-bold flex items-center gap-1.5 mb-1 text-amber-900">
                      <Info size={14} />
                      Ada Draft Belum Dipublish
                    </p>
                    <strong>{draftCount}</strong> item RAB masih draft lokal dan tidak akan diimport. Hanya item yang sudah dipublish yang akan diimport ke RAP.
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
            <ExportMenu
              data={projectItems as unknown as Record<string, unknown>[]}
              columns={[
                { header: 'Item Name',      accessor: (r: Record<string, unknown>) => String(r.name ?? (r.ahsp_items as {name?: string})?.name ?? (r.rab_items as {name?: string})?.name ?? '') },
                { header: 'Total Budget',   accessor: (r: Record<string, unknown>) => (r.total_budget    as number) || 0 },
                { header: 'Committed Cost', accessor: (r: Record<string, unknown>) => (r.committed_cost  as number) || 0 },
                { header: 'Actual Cost',    accessor: (r: Record<string, unknown>) => (r.actual_cost     as number) || 0 },
                { header: 'Remaining',      accessor: (r: Record<string, unknown>) => ((r.total_budget as number) || 0) - ((r.committed_cost as number) || 0) - ((r.actual_cost as number) || 0) },
              ]}
              filename={`RAP_Budget_${projectId}`}
              size="sm"
            />
          </div>
        }
      />)}

      {/* Wrapper without nested tabs — just Budget Control + collapsible Scheduler */}
      <div className="space-y-4">

        {/* ── Budget Control section */}
        <div className="space-y-4">
          {/* ── KPI Cards ───────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            <KPICard label="Total Budget" value={`Rp ${Math.round(totals.totalBudget).toLocaleString('id-ID')}`} colorClass="text-slate-800 dark:text-slate-100" />
            <KPICard label="Committed" value={`Rp ${Math.round(totals.totalCommitted).toLocaleString('id-ID')}`} colorClass="text-blue-600 dark:text-blue-400" />
            <KPICard label="Actual Cost" value={`Rp ${Math.round(totals.totalActual).toLocaleString('id-ID')}`} colorClass="text-amber-600 dark:text-amber-400" />
            <KPICard
              label="Remaining"
              value={`Rp ${Math.round(totals.totalRemaining).toLocaleString('id-ID')}`}
              colorClass={totals.totalRemaining < 0 ? 'text-red-600 font-bold' : 'text-emerald-600'}
            />
            <KPICard
              label="Sisa Budget"
              value={totals.totalBudget === 0 ? '—' : `${totals.efficiency}%`}
              colorClass={totals.totalBudget === 0 ? 'text-slate-400' : totals.efficiency >= 90 ? 'text-emerald-600' : totals.efficiency >= 75 ? 'text-amber-600' : 'text-red-600'}
              sub={totals.totalBudget === 0 ? 'Belum ada budget' : '% Anggaran Tersisa'}
            />
            <KPICard
              label="Kontribusi Kantor"
              value={waterfall.rabSelling === 0 ? '—' : `Rp ${Math.round(waterfall.kontribusiRp).toLocaleString('id-ID')}`}
              colorClass={waterfall.rabSelling === 0 ? 'text-slate-400' : 'text-violet-600 dark:text-violet-400'}
              sub={waterfall.rabSelling === 0 ? 'Belum link RAB' : `${waterfall.kontribusiPct.toFixed(1)}% dari harga jual`}
            />
            <KPICard
              label="Efisiensi Proyek"
              value={waterfall.rapKontribusi === 0 ? '—' : `Rp ${Math.round(waterfall.bonusRp).toLocaleString('id-ID')}`}
              colorClass={waterfall.rapKontribusi === 0 ? 'text-slate-400' : waterfall.bonusRp >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}
              sub={waterfall.rapKontribusi === 0 ? 'Belum ada plafon' : `${waterfall.bonusPct.toFixed(1)}% dari plafon`}
            />
          </div>

          {/* ── Margin Health Bar: RAP Kontribusi / RAB Selling ─── */}
          {waterfall.rabSelling > 0 && (() => {
            const rapPct = (waterfall.rapKontribusi / waterfall.rabSelling) * 100
            return (
              <div className="flex items-center gap-3 text-xs rounded-lg border border-slate-100 bg-slate-50/60 px-4 py-2.5">
                <span className="w-28 shrink-0 font-semibold text-slate-500 uppercase tracking-wider">RAP / RAB</span>
                <div className="flex-1 h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      rapPct <= 70 ? 'bg-emerald-500' : rapPct <= 90 ? 'bg-amber-400' : 'bg-rose-500'
                    }`}
                    style={{ width: `${Math.min(rapPct, 100)}%` }}
                  />
                </div>
                <span className="w-14 text-right font-mono font-bold">{rapPct.toFixed(1)}%</span>
                <span className="text-slate-400">plafon vs harga jual</span>
              </div>
            )
          })()}

          {/* ── Efisiensi simulation bar ────────────────────────── */}
          <div className="flex flex-wrap items-center gap-4 rounded-lg border border-emerald-100 bg-emerald-50/50 px-4 py-3 dark:border-emerald-900 dark:bg-emerald-950/30">
            <div className="flex items-center gap-1.5">
              <TrendingUp size={13} className="text-emerald-600" />
              <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Target Efisiensi</span>
            </div>
            <div className="flex items-center gap-2">
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
                className="h-7 px-3 text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 border-0"
                onClick={handleApplyProfitSimulation}
                disabled={isSimulating || !items.length}
              >
                <ShieldCheck size={12} className="mr-1" />
                Apply Profit First
              </Button>
            </div>
            <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-auto hidden md:inline">
              Recalculate RAP budget items to achieve target profit margin
            </span>
          </div>

          {/* ── Search toolbar ───────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search items..."
                className="h-8 bg-white border-slate-200 pl-8 text-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            {filteredItems.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {filteredItems.length} item{filteredItems.length !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {rapTableBlock}


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
