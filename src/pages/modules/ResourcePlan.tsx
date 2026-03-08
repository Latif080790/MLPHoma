/**
 * ResourcePlan.tsx
 * Resource Plan module â€” Volume kebutuhan resource dari AHSP Ã— volume RAP.
 *
 * Features:
 *  - Summary cards by resource type (toggle filter)
 *  - Rekap table with DRILL-DOWN: expand a resource row to see audit trail
 *    (which RAP items contribute, coefficient Ã— qty â†’ volume)
 *  - Jadwal Pendatangan: monthly stacked bar chart, click month to see
 *    per-WBS / per-resource breakdown (traceability)
 *  - JIT scheduling visual: shows estimated PO deadline (H-14 from arrival)
 *  - Export to Excel (full table + trace sheet)
 */

import React, { useState, useMemo, useEffect, useCallback } from 'react'
import {
  Wrench, Download, AlertCircle, CalendarDays,
  ChevronRight, ChevronDown, Info, X, Package, Clock,
} from 'lucide-react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import ModulePageState from '@/components/common/ModulePageState'
import { useProjectStore } from '@/store/projectStore'
import { useRapStore } from '@/store/rapStore'
import { useAHSPStore } from '@/store/ahspStore'
import { useTimelineStore } from '@/store/timelineStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatIDR } from '@/lib/utils'
import {
  computeResourceNeedsFromRAPWithTrace,
  computeResourceStatsFromRAP,
  computeArrivalScheduleWithTrace,
} from '@/services/resourcePlanService'
import type { ResourceNeedWithTrace } from '@/services/resourcePlanService'
import type { ResourceType } from '@/types/ahsp'
import type { RapItem } from '@/services/rapService'

// Stable fallback â€” never recreated, prevents Zustand infinite re-render
const EMPTY_RAP: RapItem[] = []

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const TYPE_LABEL: Record<ResourceType, string> = {
  material: 'Material',
  labor: 'Tenaga Kerja',
  equipment: 'Peralatan',
  subcontractor: 'Subkontraktor',
}

const TYPE_COLOR: Record<ResourceType, string> = {
  material: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  labor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  equipment: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  subcontractor: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
}

const TYPE_BAR_COLOR: Record<ResourceType, string> = {
  material: 'bg-blue-500',
  labor: 'bg-emerald-500',
  equipment: 'bg-amber-500',
  subcontractor: 'bg-purple-500',
}

const TYPE_ORDER: ResourceType[] = ['material', 'labor', 'equipment', 'subcontractor']

// JIT: days before work start that material should arrive; PO lead time
const JIT_BUFFER_DAYS = 2
const PO_LEAD_TIME_DAYS = 14

function subDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function ResourcePlan() {
  const project = useProjectStore(s => s.activeProjectId ? s.projects[s.activeProjectId] : null)
  const projectId = project?.id || ''

  const { items: allRapItems, fetchItems: fetchRapItems } = useRapStore()
  const rapItems = useMemo(
    () => (projectId ? allRapItems.filter(i => i.project_id === projectId) : EMPTY_RAP),
    [allRapItems, projectId],
  )
  const { componentsByAHSP, resources, fetchComponentsBatch, ahspItems } = useAHSPStore()
  const { getTasks } = useTimelineStore()

  // â”€â”€ Load data â”€â”€
  useEffect(() => {
    if (projectId) fetchRapItems(projectId)
  }, [projectId, fetchRapItems])

  useEffect(() => {
    if (!rapItems.length) return
    const missingIds = rapItems
      .map(r => r.ahsp_id)
      .filter((id): id is string => !!id && !(id in componentsByAHSP))
    if (missingIds.length) {
      fetchComponentsBatch(missingIds).catch(() => null)
    }
  }, [rapItems, componentsByAHSP, fetchComponentsBatch])

  // â”€â”€ UI state â”€â”€
  const [activeTypes, setActiveTypes] = useState<Set<ResourceType>>(
    new Set(['material', 'labor', 'equipment', 'subcontractor']),
  )
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null)

  const toggleType = (t: ResourceType) => {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) { next.delete(t) } else { next.add(t) }
      return next
    })
  }

  const toggleRow = useCallback((id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }, [])

  // â"€â"€ Maps for rich audit trail labels â"€â"€
  // ahsp_id -> code (for drill-down display)
  const ahspCodeMapForTrace = useMemo(() => {
    const m = new Map<string, string>()
    ahspItems.forEach(a => { if (a.id && a.code) m.set(a.id, a.code) })
    // Also infer from rapItem.ahsp_id + rab_items joined data if available
    return m
  }, [ahspItems])

  // wbs_id -> name (built from joined wbs_items on the rap rows themselves)
  const wbsNameMapForTrace = useMemo(() => {
    const m = new Map<string, string>()
    rapItems.forEach(r => {
      if (r.wbs_id && (r as RapItem & { wbs_items?: { name: string } }).wbs_items?.name) {
        m.set(r.wbs_id, (r as RapItem & { wbs_items?: { name: string } }).wbs_items!.name)
      }
    })
    return m
  }, [rapItems])

  // â"€â"€ Compute resource needs with full audit trail â"€â"€
  const resourceNeeds: ResourceNeedWithTrace[] = useMemo(
    () => computeResourceNeedsFromRAPWithTrace(
      rapItems, componentsByAHSP, resources,
      ahspCodeMapForTrace, wbsNameMapForTrace,
    ),
    [rapItems, componentsByAHSP, resources, ahspCodeMapForTrace, wbsNameMapForTrace],
  )

  const stats = useMemo(
    () => computeResourceStatsFromRAP(resourceNeeds, rapItems),
    [resourceNeeds, rapItems],
  )

  const filtered = useMemo(
    () => resourceNeeds.filter(r => activeTypes.has(r.resourceType)),
    [resourceNeeds, activeTypes],
  )

  // â”€â”€ Schedule Pendatangan with WBS traceability â”€â”€
  const taskByRabId = useMemo(() => {
    const tasks = getTasks(projectId)
    const map = new Map<string, { start: string; end: string; wbsName?: string }>()
    tasks.forEach(t => {
      if (t.rabId && t.startDate && t.endDate) {
        map.set(t.rabId, { start: t.startDate, end: t.endDate, wbsName: (t as { wbsName?: string }).wbsName || t.name })
      }
    })
    return map
  }, [getTasks, projectId])

  const arrivalSchedule = useMemo(
    () => computeArrivalScheduleWithTrace(rapItems, componentsByAHSP, resources, taskByRabId),
    [rapItems, componentsByAHSP, resources, taskByRabId],
  )

  /** Number of RAP items that have a linked timeline task with start/end dates */
  const linkedToTimeline = useMemo(
    () => rapItems.filter(r => r.rab_item_id && taskByRabId.has(r.rab_item_id)).length,
    [rapItems, taskByRabId],
  )

  const maxMonthly = Math.max(...arrivalSchedule.map(m => m.total), 1)

  const selectedMonthData = useMemo(
    () => arrivalSchedule.find(m => m.month === selectedMonth) ?? null,
    [arrivalSchedule, selectedMonth],
  )

  // â”€â”€ Export Excel (two sheets: summary + audit trail) â”€â”€
  const handleExport = async () => {
    const { utils, writeFile } = await import('xlsx')
    const rows = filtered.map(r => ({
      Kode: r.resourceCode,
      Nama: r.resourceName,
      Tipe: TYPE_LABEL[r.resourceType],
      Satuan: r.unit,
      'Harga Satuan (AHSP)': r.unitPrice,
      'Volume Total': r.totalVolume,
      'Total Biaya': r.totalCost,
    }))
    const traceRows: object[] = []
    filtered.forEach(r => {
      r.traceItems.forEach(t => {
        traceRows.push({
          Resource: r.resourceName,
          Tipe: TYPE_LABEL[r.resourceType],
          'Item RAP': t.rapItemName,
          WBS: t.wbsName || 'â€”',
          'AHSP Code': t.ahspCode || 'â€”',
          Koefisien: t.coefficient,
          'Volume RAP': t.qty,
          'Vol Kontribusi': t.volumeContrib,
          'Biaya Kontribusi': t.costContrib,
        })
      })
    })
    const wb = utils.book_new()
    utils.book_append_sheet(wb, utils.json_to_sheet(rows), 'Resource Plan')
    utils.book_append_sheet(wb, utils.json_to_sheet(traceRows), 'Audit Trail')
    writeFile(wb, `resource-plan-${projectId}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // â”€â”€ Guards â”€â”€
  if (!project || !projectId) {
    return (
      <ModulePageState
        icon={<Wrench size={18} />}
        title="Resource Plan"
        description="Rekap kebutuhan resource dari AHSP Ã— volume RAP."
        variant="empty"
        message="Pilih proyek aktif untuk melihat Resource Plan."
      />
    )
  }

  if (rapItems.length === 0) {
    return (
      <div className="space-y-4 density-compact">
        <ModuleHeader
          icon={<Wrench size={18} />}
          title="Resource Plan"
          description={`Kebutuhan resource â€” ${project.name}`}
          accent="indigo"
        />
        <ModulePageState
          icon={<Wrench size={18} />}
          title="Belum ada item RAP"
          variant="empty"
          message="Sync RAP dari RAB terlebih dahulu untuk melihat kebutuhan resource."
        />
      </div>
    )
  }

  const unlinkedCount = stats.totalRab - stats.linkedCount

  return (
    <div className="space-y-4 density-compact">
      <ModuleHeader
        icon={<Wrench size={18} />}
        title="Resource Plan"
        description={`Rekap volume & jadwal kebutuhan resource â€” ${project.name}`}
        accent="indigo"
        actions={
          <Button
            variant="outline" size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleExport}
            disabled={filtered.length === 0}
          >
            <Download size={13} />
            Export Excel
          </Button>
        }
      />

      {/* â”€â”€ Warning: unlinked RAP items â”€â”€ */}
      {unlinkedCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs dark:border-amber-800 dark:bg-amber-900/20">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-amber-700 dark:text-amber-300">
            <strong>{unlinkedCount} dari {stats.totalRab} item RAP</strong> belum terhubung ke AHSP.
            Link AHSP di modul RAP / RAB untuk menghitung kebutuhan resource item tersebut.
          </p>
        </div>
      )}
      {/* ─── Warning: no timeline dates → Jadwal Pendatangan will be empty ─── */}
      {rapItems.length > 0 && arrivalSchedule.length === 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-orange-200 bg-orange-50/60 p-3 text-xs dark:border-orange-800 dark:bg-orange-900/20">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-orange-600" />
          <p className="text-orange-700 dark:text-orange-300">
            <strong>Jadwal Pendatangan kosong</strong> —{' '}
            {linkedToTimeline === 0
              ? `${rapItems.length} item RAP belum memiliki tanggal di Timeline.`
              : `${rapItems.length - linkedToTimeline} dari ${rapItems.length} item RAP belum memiliki tanggal di Timeline.`}{' '}
            Buka modul <strong>Timeline</strong> dan gunakan <strong>Auto-Schedule</strong> agar jadwal kedatangan resource dapat dihitung.
          </p>
        </div>
      )}

      {/* ─── Info: partial timeline coverage ─── */}
      {arrivalSchedule.length > 0 && linkedToTimeline < rapItems.length && (
        <div className="flex items-start gap-2 rounded-lg border border-sky-200 bg-sky-50/60 p-3 text-xs dark:border-sky-800 dark:bg-sky-900/20">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-sky-500" />
          <p className="text-sky-700 dark:text-sky-300">
            <strong>{linkedToTimeline} dari {rapItems.length} item RAP</strong> terjadwal di Timeline.
            {' '}{rapItems.length - linkedToTimeline} item belum memiliki tanggal — jadwal ini belum mencerminkan seluruh kebutuhan resource.
          </p>
        </div>
      )}
      {/* â”€â”€ Summary cards â”€â”€ */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {TYPE_ORDER.map(type => (
          <Card
            key={type}
            className={`cursor-pointer transition-all hover:shadow-md ${!activeTypes.has(type) ? 'opacity-40' : ''}`}
            onClick={() => toggleType(type)}
          >
            <CardContent className="p-3">
              <Badge className={`mb-1 text-xs ${TYPE_COLOR[type]}`}>{TYPE_LABEL[type]}</Badge>
              <div className="text-base font-bold font-mono text-slate-800 dark:text-slate-100">
                {formatIDR(stats.byType[type])}
              </div>
              <div className="text-xs text-slate-400">
                {resourceNeeds.filter(r => r.resourceType === type).length} item
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* â”€â”€ Jadwal Pendatangan â€” stacked bar + click-to-trace â”€â”€ */}
      {arrivalSchedule.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-2 pt-4 dark:border-slate-700">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <CalendarDays size={15} className="text-indigo-500" />
              Jadwal Pendatangan Resource
              <span
                className={`text-xs font-semibold px-1.5 py-0 rounded leading-4 ${linkedToTimeline === rapItems.length
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                  }`}
                title={`${linkedToTimeline} dari ${rapItems.length} item RAP memiliki tanggal Timeline`}
              >
                {linkedToTimeline}/{rapItems.length} terjadwal
              </span>
            </CardTitle>
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 text-xs text-slate-400">
                <Clock size={11} />
                JIT H-{JIT_BUFFER_DAYS} buffer Â· klik bulan untuk rincian
              </span>
              <span className="text-xs text-slate-400">{arrivalSchedule.length} bln</span>
            </div>
          </CardHeader>
          <CardContent className="p-4">
            <div className="mt-4 px-2 pb-10 overflow-x-auto">
              <div className="flex items-end gap-1.5 h-48 border-b border-slate-200 dark:border-slate-800" style={{ minWidth: `${arrivalSchedule.length * 40}px` }}>
                {arrivalSchedule.map(m => {
                  const isSelected = selectedMonth === m.month
                  return (
                    <div
                      key={m.month}
                      className="flex-1 flex flex-col justify-end relative group cursor-pointer h-full hover:bg-slate-50 dark:hover:bg-slate-800/20"
                      onClick={() => setSelectedMonth(prev => prev === m.month ? null : m.month)}
                    >
                      {/* Hover Tooltip (Totals) */}
                      <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none bg-slate-800 text-white text-[10px] px-2 py-1 rounded shadow-lg">
                        <div className="font-bold">{m.label}</div>
                        <div>{formatIDR(m.total)}</div>
                      </div>

                      {/* Selection Outline */}
                      {isSelected && <div className="absolute inset-0 border-2 border-indigo-400 rounded-sm pointer-events-none z-10" />}

                      {/* Stacked Vertical Bars */}
                      <div className="w-full flex flex-col justify-end h-full">
                        {TYPE_ORDER.slice().reverse().map(type => { // Reverse so Material is at bottom (usually largest)
                          const val = (m as unknown as Record<string, number>)[type] || 0
                          if (val <= 0) return null
                          const pct = (val / maxMonthly) * 100
                          return (
                            <div
                              key={type}
                              className={`${TYPE_BAR_COLOR[type]} w-full transition-all duration-300 relative border-b border-white/20`}
                              style={{ height: `${pct}%` }}
                              title={`${TYPE_LABEL[type]}: ${formatIDR(val)}`}
                            />
                          )
                        })}
                      </div>

                      {/* X-axis Month Label */}
                      <div
                        className={`absolute top-full mt-2 left-1/2 text-[10px] font-mono whitespace-nowrap origin-top-left -rotate-45 ${isSelected ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}`}
                      >
                        {m.label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {/* Legend */}
            <div className="flex items-center gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
              {TYPE_ORDER.map(type => (
                <div key={type} className="flex items-center gap-1.5 text-xs text-slate-500">
                  <div className={`w-2.5 h-2.5 rounded-sm ${TYPE_BAR_COLOR[type]}`} />
                  {TYPE_LABEL[type]}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* â”€â”€ Month detail: per-WBS per-resource traceability panel â”€â”€ */}
      {selectedMonthData && (
        <Card className="shadow-sm border-indigo-200 dark:border-indigo-800">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-2 pt-3 dark:border-slate-700">
            <CardTitle className="text-sm font-bold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
              <Info size={14} />
              Detail {selectedMonthData.label} â€” Rincian Resource per Item Pekerjaan
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setSelectedMonth(null)}>
              <X size={13} />
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            {/* Sub-total by type */}
            <div className="flex flex-wrap gap-4 px-4 py-2 border-b border-slate-100 dark:border-slate-700">
              {TYPE_ORDER.map(type => {
                const val = (selectedMonthData as unknown as Record<string, number>)[type] || 0
                if (val <= 0) return null
                return (
                  <div key={type} className="flex items-center gap-1.5 text-xs">
                    <div className={`w-2 h-2 rounded-sm ${TYPE_BAR_COLOR[type]}`} />
                    <span className="text-slate-500">{TYPE_LABEL[type]}:</span>
                    <span className="font-mono font-semibold text-slate-700 dark:text-slate-200">{formatIDR(val)}</span>
                  </div>
                )
              })}
            </div>
            {/* Trace table */}
            <div className="max-h-[280px] overflow-auto">
              <Table>
                <TableHeader className="sticky-glass-tablehead">
                  <TableRow className="border-b border-slate-200 dark:border-slate-700 hover:bg-transparent">
                    <TableHead className="h-7 text-xs font-bold uppercase tracking-wider">Item Pekerjaan (RAP)</TableHead>
                    <TableHead className="h-7 text-xs font-bold uppercase tracking-wider">WBS</TableHead>
                    <TableHead className="h-7 text-xs font-bold uppercase tracking-wider">Resource</TableHead>
                    <TableHead className="h-7 text-xs font-bold uppercase tracking-wider">Tipe</TableHead>
                    <TableHead className="h-7 text-right text-xs font-bold uppercase tracking-wider">Volume / bln</TableHead>
                    <TableHead className="h-7 text-right text-xs font-bold uppercase tracking-wider">Biaya / bln</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedMonthData.traces.map((t, i) => (
                    <TableRow key={i} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40">
                      <TableCell className="py-1 text-xs font-medium max-w-[200px] truncate" title={t.rapItemName}>{t.rapItemName}</TableCell>
                      <TableCell className="py-1 text-xs text-slate-500">{t.wbsName || 'â€”'}</TableCell>
                      <TableCell className="py-1 text-xs">{t.resourceName}</TableCell>
                      <TableCell className="py-1">
                        <Badge variant="outline" className={`text-xs ${TYPE_COLOR[t.resourceType]}`}>
                          {TYPE_LABEL[t.resourceType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="py-1 text-right font-mono text-xs">
                        {t.volumeContrib.toFixed(3)} {t.unit}
                      </TableCell>
                      <TableCell className="py-1 text-right font-mono text-xs font-semibold">
                        {formatIDR(t.costContrib)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* JIT / PO deadline reminder */}
            <div className="px-4 py-2 border-t border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-900/10 flex items-start gap-2">
              <Package size={12} className="mt-0.5 shrink-0 text-amber-600" />
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>JIT:</strong> Material bulan {selectedMonthData.label} harus tiba paling lambat H-{JIT_BUFFER_DAYS} sebelum pekerjaan dimulai.{' '}
                <strong>Batas terbit PO:</strong>{' '}
                {new Date(subDays(selectedMonthData.month + '-01', PO_LEAD_TIME_DAYS)).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                {' '}(H-{PO_LEAD_TIME_DAYS} lead time pemesanan).
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* â”€â”€ Rekap resource table with drill-down audit trail â”€â”€ */}
      {filtered.length === 0 ? (
        <ModulePageState
          icon={<Wrench size={18} />}
          title="Tidak ada data resource"
          variant="empty"
          message="Tidak ada resource yang cocok dengan filter aktif, atau item RAP belum terhubung ke AHSP."
        />
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-2 pt-4 dark:border-slate-700">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              Rekap Kebutuhan Resource
              <span className="text-xs font-normal text-slate-400 normal-case tracking-normal">
                â€” klik baris â–¶ untuk audit trail kalkulasi
              </span>
            </CardTitle>
            <span className="text-xs text-slate-400">{filtered.length} item</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[650px] overflow-auto">
              <Table>
                <TableHeader className="sticky-glass-tablehead">
                  <TableRow className="border-b border-slate-200 dark:border-slate-700 hover:bg-transparent">
                    <TableHead className="h-8 w-6" />
                    <TableHead className="h-8 text-xs font-bold uppercase tracking-wider">Kode</TableHead>
                    <TableHead className="h-8 w-[220px] text-xs font-bold uppercase tracking-wider">Nama Resource</TableHead>
                    <TableHead className="h-8 text-xs font-bold uppercase tracking-wider">Tipe</TableHead>
                    <TableHead className="h-8 text-xs font-bold uppercase tracking-wider">Satuan</TableHead>
                    <TableHead className="h-8 text-right text-xs font-bold uppercase tracking-wider">Vol Total</TableHead>
                    <TableHead className="h-8 text-right text-xs font-bold uppercase tracking-wider">Harga Satuan</TableHead>
                    <TableHead className="h-8 text-right text-xs font-bold uppercase tracking-wider">Total Biaya</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {TYPE_ORDER.filter(t => activeTypes.has(t)).map(type => {
                    const rows = filtered.filter(r => r.resourceType === type)
                    if (rows.length === 0) return null
                    const subtotal = rows.reduce((s, r) => s + r.totalCost, 0)
                    return (
                      <React.Fragment key={type}>
                        {/* Group header row */}
                        <TableRow className="border-b border-slate-100 bg-slate-50/60 dark:bg-slate-800/30">
                          <TableCell colSpan={7} className="py-1.5 pl-3">
                            <Badge className={`text-xs ${TYPE_COLOR[type]}`}>{TYPE_LABEL[type]}</Badge>
                            <span className="ml-2 text-xs text-slate-400">{rows.length} item</span>
                          </TableCell>
                          <TableCell className="py-1.5 text-right text-xs font-bold font-mono text-slate-700 dark:text-slate-200">
                            {formatIDR(subtotal)}
                          </TableCell>
                        </TableRow>

                        {/* Resource rows (Level 1) */}
                        {rows.map(r => {
                          const isExpanded = expandedRows.has(r.resourceId)
                          return (
                            <React.Fragment key={r.resourceId}>
                              <TableRow
                                className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                                onClick={() => toggleRow(r.resourceId)}
                              >
                                <TableCell className="py-1.5 pl-2 w-6">
                                  {isExpanded
                                    ? <ChevronDown size={13} className="text-indigo-500" />
                                    : <ChevronRight size={13} className="text-slate-400" />}
                                </TableCell>
                                <TableCell className="py-1.5 font-mono text-xs text-slate-500">{r.resourceCode}</TableCell>
                                <TableCell className="py-1.5 text-xs font-medium">{r.resourceName}</TableCell>
                                <TableCell className="py-1.5">
                                  <Badge variant="outline" className="text-xs">{TYPE_LABEL[r.resourceType]}</Badge>
                                </TableCell>
                                <TableCell className="py-1.5 text-xs text-slate-500">{r.unit}</TableCell>
                                <TableCell className="py-1.5 text-right font-mono text-xs">
                                  {r.totalVolume % 1 === 0
                                    ? r.totalVolume.toLocaleString('id-ID')
                                    : r.totalVolume.toFixed(3)}
                                </TableCell>
                                <TableCell className="py-1.5 text-right font-mono text-xs text-slate-500">
                                  {formatIDR(r.unitPrice)}
                                </TableCell>
                                <TableCell className="py-1.5 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">
                                  {formatIDR(r.totalCost)}
                                </TableCell>
                              </TableRow>

                              {/* Audit trail rows (Level 2 drill-down) */}
                              {isExpanded && r.traceItems.map((t, i) => (
                                <TableRow
                                  key={`${r.resourceId}-t${i}`}
                                  className="border-b border-dashed border-slate-100 bg-indigo-50/30 dark:bg-indigo-900/10 dark:border-slate-800/60"
                                >
                                  <TableCell />
                                  <TableCell colSpan={2} className="py-1 pl-7">
                                    <div className="flex items-start gap-1.5">
                                      <span className="mt-0.5 text-indigo-400 select-none">â†³</span>
                                      <div>
                                        <div className="text-xs font-medium text-slate-700 dark:text-slate-200 leading-tight">
                                          {t.rapItemName}
                                        </div>
                                        <div className="flex gap-2 mt-0.5 flex-wrap">
                                          {t.wbsName && (
                                            <span className="text-xs text-slate-400">WBS: {t.wbsName}</span>
                                          )}
                                          {t.ahspCode && (
                                            <span className="text-xs text-slate-400">AHSP: {t.ahspCode}</span>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-1" colSpan={2}>
                                    <span className="text-xs text-slate-400 font-mono">
                                      koef {t.coefficient} Ã— vol {t.qty.toLocaleString('id-ID')} = {t.volumeContrib.toFixed(3)} {r.unit}
                                    </span>
                                  </TableCell>
                                  <TableCell className="py-1 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400">
                                    {t.volumeContrib.toFixed(3)}
                                  </TableCell>
                                  <TableCell />
                                  <TableCell className="py-1 text-right font-mono text-xs text-indigo-600 dark:text-indigo-400">
                                    {formatIDR(t.costContrib)}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          )
                        })}
                      </React.Fragment>
                    )
                  })}

                  {/* Grand total */}
                  <TableRow className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                    <TableCell colSpan={7} className="py-2 pl-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                      TOTAL
                    </TableCell>
                    <TableCell className="py-2 text-right font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                      {formatIDR(stats.totalCost)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}


