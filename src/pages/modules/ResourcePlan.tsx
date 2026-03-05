/**
 * ResourcePlan.tsx
 * Resource Plan module — Volume kebutuhan resource dari AHSP × volume RAB.
 * Panel 1: Rekap total per resource (material/labor/equipment/subkon)
 * Panel 2: Jadwal pendatangan berbasis periode WBS timeline (bar chart)
 *
 * Task 43: uses resourcePlanService for computation
 * Task 44: Adds Jadwal Pendatangan bar chart
 */

import React, { useState, useMemo } from 'react'
import { Wrench, Download, AlertCircle, CalendarDays } from 'lucide-react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import ModulePageState from '@/components/common/ModulePageState'
import { useProjectStore } from '@/store/projectStore'
import { useRabStore } from '@/store/rabStore'
import { useAHSPStore } from '@/store/ahspStore'
import { useTimelineStore } from '@/store/timelineStore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { formatIDR } from '@/lib/utils'
import { computeResourceNeeds, computeResourceStats } from '@/services/resourcePlanService'
import type { ResourceType } from '@/types/ahsp'
import type { RABItem } from '@/types/rab'

// Stable fallback — never recreated, prevents Zustand infinite re-render
const EMPTY_RAB: RABItem[] = []

// ─── Helpers ─────────────────────────────────────────────────────────────────
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

export default function ResourcePlan() {
  const project = useProjectStore(s => s.activeProjectId ? s.projects[s.activeProjectId] : null)
  const projectId = project?.id || ''

  // Must select from itemsByProject (stable ref), NOT getItems() which may create new arrays
  const rabItems = useRabStore(s => s.itemsByProject[projectId] ?? EMPTY_RAB)
  const { ahspItems: _ahspItems, componentsByAHSP, resources } = useAHSPStore()
  const { getTasks } = useTimelineStore()

  const [activeTypes, setActiveTypes] = useState<Set<ResourceType>>(
    new Set(['material', 'labor', 'equipment', 'subcontractor'])
  )

  // ── Compute resource needs using service (Task 43) ──────────
  const resourceNeeds = useMemo(
    () => computeResourceNeeds(rabItems, componentsByAHSP, resources),
    [rabItems, componentsByAHSP, resources]
  )

  // ── Stats ──────────────────────────────────────────────────────
  const stats = useMemo(
    () => computeResourceStats(resourceNeeds, rabItems),
    [resourceNeeds, rabItems]
  )

  // ── Filtered rows ──────────────────────────────────────────────
  const filtered = useMemo(
    () => resourceNeeds.filter(r => activeTypes.has(r.resourceType)),
    [resourceNeeds, activeTypes]
  )

  // ── Task 44: Jadwal Pendatangan data ───────────────────────────
  /**
   * Compute monthly resource cost distribution from WBS timeline tasks.
   * For each RAB item that has a linked task with start/end dates,
   * distribute the resource cost linearly across the months.
   */
  const arrivalSchedule = useMemo(() => {
    const tasks = getTasks(projectId)
    if (!tasks.length || !resourceNeeds.length) return []

    // Build task map by RAB item
    const taskByRabId = new Map<string, { start: string; end: string }>()
    tasks.forEach(t => {
      if (t.rabId && t.startDate && t.endDate) {
        taskByRabId.set(t.rabId, { start: t.startDate, end: t.endDate })
      }
    })

    // Monthly buckets per resource type
    const buckets = new Map<string, Record<ResourceType, number>>()

    for (const rabItem of rabItems) {
      const volume = rabItem.volume || 0
      if (volume === 0) continue

      const task = taskByRabId.get(rabItem.id)
      if (!task) continue

      const ahspItemId = rabItem.ahspItemId || rabItem.ahsp_item_id
      if (!ahspItemId) continue

      const components = componentsByAHSP[ahspItemId] || []
      for (const comp of components) {
        if (!comp.resource && !comp.resourceId) continue
        const resource = comp.resource || resources.find(r => r.id === comp.resourceId)
        if (!resource) continue

        const totalCost = comp.coefficient * volume * (resource.unitPrice || comp.unitPrice || 0)

        // Distribute across months
        const startDate = new Date(task.start)
        const endDate = new Date(task.end)
        const diffMs = endDate.getTime() - startDate.getTime()
        const totalMonths = Math.max(1, Math.ceil(diffMs / (30 * 86400000)))

        const costPerMonth = totalCost / totalMonths

        for (let i = 0; i < totalMonths; i++) {
          const d = new Date(startDate)
          d.setMonth(d.getMonth() + i)
          const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

          if (!buckets.has(key)) {
            buckets.set(key, { material: 0, labor: 0, equipment: 0, subcontractor: 0 })
          }
          const bucket = buckets.get(key)!
          bucket[resource.type] = (bucket[resource.type] || 0) + costPerMonth
        }
      }
    }

    // Sort by month and return
    return Array.from(buckets.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, costs]) => ({
        month,
        label: new Date(month + '-01').toLocaleDateString('id-ID', { year: '2-digit', month: 'short' }),
        ...costs,
        total: costs.material + costs.labor + costs.equipment + costs.subcontractor,
      }))
  }, [rabItems, componentsByAHSP, resources, projectId, getTasks, resourceNeeds.length])

  const toggleType = (t: ResourceType) => {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) { next.delete(t) } else { next.add(t) }
      return next
    })
  }

  const handleExport = async () => {
    const { utils, writeFile } = await import('xlsx')
    const rows = filtered.map(r => ({
      Kode: r.resourceCode,
      Nama: r.resourceName,
      Tipe: TYPE_LABEL[r.resourceType],
      Satuan: r.unit,
      'Harga Satuan': r.unitPrice,
      'Volume Total': r.totalVolume,
      'Total Biaya': r.totalCost,
    }))
    const ws = utils.json_to_sheet(rows)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, 'Resource Plan')
    writeFile(wb, `resource-plan-${projectId}-${new Date().toISOString().split('T')[0]}.xlsx`)
  }

  // ── Guards ─────────────────────────────────────────────────────
  if (!project || !projectId) {
    return (
      <ModulePageState
        icon={<Wrench size={18} />}
        title="Resource Plan"
        description="Rekap kebutuhan resource dari AHSP × volume RAB."
        variant="empty"
        message="Pilih proyek aktif untuk melihat Resource Plan."
      />
    )
  }

  if (rabItems.length === 0) {
    return (
      <div className="space-y-4 density-compact">
        <ModuleHeader
          icon={<Wrench size={18} />}
          title="Resource Plan"
          description={`Kebutuhan resource — ${project.name}`}
          accent="indigo"
        />
        <ModulePageState
          icon={<Wrench size={18} />}
          title="Belum ada item RAB"
          variant="empty"
          message="Tambahkan item RAB terlebih dahulu untuk melihat kebutuhan resource."
        />
      </div>
    )
  }

  const unlinkedCount = stats.totalRab - stats.linkedCount
  const maxMonthly = Math.max(...arrivalSchedule.map(m => m.total), 1)

  return (
    <div className="space-y-4 density-compact">
      <ModuleHeader
        icon={<Wrench size={18} />}
        title="Resource Plan"
        description={`Rekap volume & jadwal kebutuhan resource — ${project.name}`}
        accent="indigo"
        actions={
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={handleExport} disabled={filtered.length === 0}>
            <Download size={13} />
            Export Excel
          </Button>
        }
      />

      {/* ── Warning: unlinked RAB items ─────────────────────────────── */}
      {unlinkedCount > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs dark:border-amber-800 dark:bg-amber-900/20">
          <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-amber-700 dark:text-amber-300">
            <strong>{unlinkedCount} dari {stats.totalRab} item RAB</strong> belum terhubung ke AHSP.
            Link AHSP di tab RAB untuk menghitung kebutuhan resource item tersebut.
          </p>
        </div>
      )}

      {/* ── Summary by type ────────────────────────────────────────── */}
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

      {/* ── Task 44: Jadwal Pendatangan Bar Chart ───────────────────── */}
      {arrivalSchedule.length > 0 && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-2 pt-4 dark:border-slate-700">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
              <CalendarDays size={15} className="text-indigo-500" />
              Jadwal Pendatangan Resource
            </CardTitle>
            <span className="text-xs text-slate-400">{arrivalSchedule.length} bulan</span>
          </CardHeader>
          <CardContent className="p-4">
            <div className="space-y-2">
              {arrivalSchedule.map(m => (
                <div key={m.month} className="flex items-center gap-3">
                  {/* Month label */}
                  <div className="w-16 shrink-0 text-right text-xs font-mono text-slate-500">
                    {m.label}
                  </div>
                  {/* Stacked bar */}
                  <div className="flex-1 h-6 bg-slate-100 dark:bg-slate-800 rounded-md overflow-hidden flex">
                    {TYPE_ORDER.map(type => {
                      const val = m[type] || 0
                      if (val <= 0) return null
                      const pct = (val / maxMonthly) * 100
                      return (
                        <div
                          key={type}
                          className={`${TYPE_BAR_COLOR[type]} transition-all duration-300 h-full`}
                          style={{ width: `${pct}%` }}
                          title={`${TYPE_LABEL[type]}: ${formatIDR(val)}`}
                        />
                      )
                    })}
                  </div>
                  {/* Total cost */}
                  <div className="w-28 shrink-0 text-right text-xs font-mono font-semibold text-slate-700 dark:text-slate-200">
                    {formatIDR(m.total)}
                  </div>
                </div>
              ))}
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

      {/* ── Resource needs table ────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <ModulePageState
          icon={<Wrench size={18} />}
          title="Tidak ada data resource"
          variant="empty"
          message="Tidak ada resource yang cocok dengan filter aktif, atau item RAB belum terhubung ke AHSP."
        />
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-100 pb-2 pt-4 dark:border-slate-700">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-slate-500">
              Rekap Kebutuhan Resource
            </CardTitle>
            <span className="text-xs text-slate-400">{filtered.length} item ditampilkan</span>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[550px] overflow-auto">
              <Table>
                <TableHeader className="sticky-glass-tablehead">
                  <TableRow className="border-b border-slate-200 dark:border-slate-700 hover:bg-transparent">
                    <TableHead className="h-8 text-xs font-bold uppercase tracking-wider">Kode</TableHead>
                    <TableHead className="h-8 w-[250px] text-xs font-bold uppercase tracking-wider">Nama Resource</TableHead>
                    <TableHead className="h-8 text-xs font-bold uppercase tracking-wider">Tipe</TableHead>
                    <TableHead className="h-8 text-xs font-bold uppercase tracking-wider">Satuan</TableHead>
                    <TableHead className="h-8 text-right text-xs font-bold uppercase tracking-wider">Volume Total</TableHead>
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
                        {/* Group header */}
                        <TableRow className="border-b border-slate-100 bg-slate-50/60 dark:bg-slate-800/30">
                          <TableCell colSpan={6} className="py-1.5 pl-3">
                            <Badge className={`text-xs ${TYPE_COLOR[type]}`}>{TYPE_LABEL[type]}</Badge>
                            <span className="ml-2 text-xs text-slate-400">{rows.length} item</span>
                          </TableCell>
                          <TableCell className="py-1.5 text-right text-xs font-bold font-mono text-slate-700 dark:text-slate-200">
                            {formatIDR(subtotal)}
                          </TableCell>
                        </TableRow>
                        {/* Item rows */}
                        {rows.map(r => (
                          <TableRow key={r.resourceId} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/40 transition-colors">
                            <TableCell className="py-1.5 font-mono text-xs text-slate-500">{r.resourceCode}</TableCell>
                            <TableCell className="py-1.5 text-xs font-medium">{r.resourceName}</TableCell>
                            <TableCell className="py-1.5">
                              <Badge variant="outline" className="text-xs">{TYPE_LABEL[r.resourceType]}</Badge>
                            </TableCell>
                            <TableCell className="py-1.5 text-xs text-slate-500">{r.unit}</TableCell>
                            <TableCell className="py-1.5 text-right font-mono text-xs">
                              {r.totalVolume % 1 === 0 ? r.totalVolume.toLocaleString('id-ID') : r.totalVolume.toFixed(3)}
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-mono text-xs text-slate-500">
                              {formatIDR(r.unitPrice)}
                            </TableCell>
                            <TableCell className="py-1.5 text-right font-mono text-xs font-semibold text-slate-800 dark:text-slate-100">
                              {formatIDR(r.totalCost)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    )
                  })}
                  {/* Grand total */}
                  <TableRow className="border-t-2 border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50">
                    <TableCell colSpan={6} className="py-2 pl-3 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
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
