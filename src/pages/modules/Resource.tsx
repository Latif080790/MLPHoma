/**
 * Resource.tsx
 * Resource Planning module: budget-based resource histogram (as proxy),
 * upcoming high-cost items, procurement hints using RAP schedule.
 * Added CSV/Excel export and PDF snapshot.
 */

import React, { useMemo, useRef, useCallback } from "react"
import { ModuleHeader } from "../../components/modules/ModuleHeader"
import { Boxes, CalendarDays, Package, Receipt, TrendingUp, Download, FileSpreadsheet, FileText, HardHat, Hammer, Truck } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { useProjectStore } from "../../store/projectStore"
import { useRapStore } from "../../store/rapStore"
import { useRabStore } from "../../store/rabStore"
import { useAHSPStore } from "../../store/ahspStore"
import { ResponsiveContainer, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar, Legend } from "recharts"
import { EmptyState } from "../../components/common/EmptyState"
import * as XLSX from "xlsx"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table"

import { calculateUnifiedSchedule } from "../../lib/unifiedSchedule"
import { useTimelineStore } from "../../store/timelineStore"

const EMPTY_ARRAY: any[] = []

/**
 * Export histogram rows to CSV
 */
function exportHistogramCSV(rows: any[]) {
  const headers = ["Period", "TotalCost", "Material", "Labor", "Equipment", "Other"]
  const lines = [headers.join(",")]
  rows.forEach((r) => lines.push([
    r.period,
    r.cost,
    r.material || 0,
    r.labor || 0,
    r.equipment || 0,
    r.other || 0
  ].join(",")))
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "resource_histogram.csv"
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export histogram + top items to Excel
 */
function exportResourceExcel(histogram: any[], top: { key: string; name: string; total: number }[]) {
  const ws1 = XLSX.utils.aoa_to_sheet([
    ["Resource Histogram (Cost Breakdown)"],
    ["GeneratedAt", new Date().toISOString()],
    [],
    ["Period", "TotalCost", "Material", "Labor", "Equipment", "Other"],
    ...histogram.map((h) => [h.period, h.cost, h.material, h.labor, h.equipment, h.other]),
  ])
  const ws2 = XLSX.utils.aoa_to_sheet([
    ["Top Items"],
    [],
    ["ItemKey", "Name", "TotalPlannedCost"],
    ...top.map((t) => [t.key, t.name, t.total]),
  ])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, "Histogram")
  XLSX.utils.book_append_sheet(wb, ws2, "TopItems")
  XLSX.writeFile(wb, "Resource.xlsx")
}

/**
 * Export a section to PDF
 */
async function exportPDF(element: HTMLElement | null, filename = "Resource.pdf") {
  if (!element) return
  const canvas = await html2canvas(element, { backgroundColor: "#ffffff", scale: 2 })
  const imgData = canvas.toDataURL("image/png")
  const pdf = new jsPDF("p", "mm", "a4")
  const pageWidth = pdf.internal.pageSize.getWidth()
  const imgWidth = pageWidth
  const imgHeight = (canvas.height * imgWidth) / canvas.width
  pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)
  pdf.save(filename)
}

/**
 * Resource Planning page
 */
export default function Resource() {
  const project = useProjectStore((s: any) => s.activeProjectId ? s.projects[s.activeProjectId] : null)
  const projectName = project?.name ?? "—"
  const projectId = project?.id ?? "demo"

  // Stable selectors
  const rabItemsSelector = useCallback((s: any) => s.getItems?.(projectId) ?? EMPTY_ARRAY, [projectId])
  const tasksSelector = useCallback((s: any) => s.getTasks(projectId), [projectId])

  const rabItems = useRabStore(rabItemsSelector)
  const tasks = useTimelineStore(tasksSelector)
  const ahspItems = useAHSPStore((s) => s.ahspItems)
  const componentsByAHSP = useAHSPStore((s) => s.componentsByAHSP)

  // Calculate Total Requirements
  const totalRequirements = useMemo(() => {
    const resources: Record<string, { name: string; unit: string; type: string; totalVolume: number; totalCost: number }> = {}

    // Index AHSP items by code
    const ahspMap = new Map(ahspItems.map((i) => [i.code, i]))

    rabItems.forEach((item: any) => {
      const rabVolume = item.volume || 0
      if (rabVolume <= 0) return

      // Find linked AHSP
      const ahspItem = ahspMap.get(item.item_code || item.code)

      if (ahspItem) {
        // Case 1: Has AHSP - breakdown into components
        const components = componentsByAHSP[ahspItem.id] || []
        components.forEach((comp) => {
          const resourceId = comp.resourceId
          const resourceName = comp.resource?.name || "Unknown"
          const resourceUnit = comp.unit || comp.resource?.unit || "unit"
          const resourceType = comp.resource?.type || comp.type || "material"

          // Coefficient * RAB Volume
          const requiredVolume = (comp.coefficient || 0) * rabVolume
          const cost = requiredVolume * (comp.unitPrice || 0)

          if (!resources[resourceId]) {
            resources[resourceId] = {
              name: resourceName,
              unit: resourceUnit,
              type: resourceType,
              totalVolume: 0,
              totalCost: 0
            }
          }

          resources[resourceId].totalVolume += requiredVolume
          resources[resourceId].totalCost += cost
        })
      } else {
        // Case 2: No AHSP - treat as a single resource (Lumpsum/Material)
        // Use item ID as resource ID to avoid collisions
        const resourceId = `manual-${item.id}`
        const cost = rabVolume * (item.unit_price || 0)

        if (!resources[resourceId]) {
          resources[resourceId] = {
            name: item.name || item.item_name || "Unnamed Item",
            unit: item.unit || "ls",
            type: "material", // Default to material for manual items
            totalVolume: 0,
            totalCost: 0
          }
        }

        resources[resourceId].totalVolume += rabVolume
        resources[resourceId].totalCost += cost
      }
    })

    return Object.values(resources).sort((a, b) => b.totalCost - a.totalCost)
  }, [rabItems, ahspItems, componentsByAHSP])

  // Calculate Histogram
  const histogram = useMemo(() => {
    if (!tasks || tasks.length === 0) return []
    if (!rabItems || rabItems.length === 0) return []

    // Index AHSP items by code
    const ahspMap = new Map(ahspItems.map((i) => [i.code, i]))

    const { costSchedule } = calculateUnifiedSchedule(
      rabItems,
      tasks,
      ahspMap,
      componentsByAHSP,
      'week'
    )

    // Filter out periods beyond reasonable project scope (e.g. > 5 years from start)
    const MAX_WEEKS = 52 * 5 // 5 years cap
    const limitedSchedule = costSchedule.length > MAX_WEEKS ? costSchedule.slice(0, MAX_WEEKS) : costSchedule

    return limitedSchedule.map(cs => ({
      period: cs.period,
      startDate: cs.period,
      cost: cs.totalCost,
      material: cs.materialCost,
      labor: cs.laborCost,
      equipment: cs.equipmentCost,
      other: cs.otherCost
    }))
  }, [tasks, rabItems, ahspItems, componentsByAHSP])

  // Calculate Top Items
  const topItems = useMemo(() => {
    // Filter items that have a taskId (are scheduled)
    const scheduledItems = rabItems.filter((i: any) => i.taskId)

    // Sort by total cost
    return scheduledItems
      .map((i: any) => ({
        key: i.id as string,
        name: (i.item_name || i.name || "Unknown") as string,
        total: (i.finalTotal || (i.volume * (i.unit_price || 0)) || 0) as number
      }))
      .sort((a: { total: number }, b: { total: number }) => b.total - a.total)
      .slice(0, 6)
  }, [rabItems])

  const total = histogram.reduce((s, p) => s + p.cost, 0)
  const exportRef = useRef<HTMLDivElement | null>(null)

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={<Boxes size={18} />}
        title="Resource Planning"
        description="Budget-weighted resource histogram and upcoming high-cost items (proxy via RAP)."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportHistogramCSV(histogram)}
            >
              <Download size={16} /> CSV
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportResourceExcel(histogram, topItems)}
            >
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportPDF(exportRef.current, "Resource.pdf")}
            >
              <FileText size={16} /> PDF
            </button>
          </div>
        }
      />

      <Tabs defaultValue="total" className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="total">Total Requirements (RAB)</TabsTrigger>
          <TabsTrigger value="histogram">Time-Phased (RAP)</TabsTrigger>
        </TabsList>

        <TabsContent value="total">
          {totalRequirements.length === 0 ? (
            <EmptyState
              title="No Resource Data"
              description="Add items to your RAB (Budget) using AHSP codes to see calculated resource requirements automatically. If you added items manually without AHSP, they won't appear here."
              imageKeyword="resources"
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Total Resource Requirements</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm bg-white dark:bg-slate-900">
                  <div className="max-h-[600px] overflow-auto relative">
                    <Table>
                      <TableHeader className="bg-slate-50 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                        <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                          <TableHead className="font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Resource Name</TableHead>
                          <TableHead className="w-[100px] font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Type</TableHead>
                          <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Total Volume</TableHead>
                          <TableHead className="w-[80px] text-center font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Unit</TableHead>
                          <TableHead className="text-right font-semibold text-slate-700 dark:text-slate-300 h-9 text-xs uppercase tracking-wider">Est. Cost</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {totalRequirements.map((res, idx) => (
                          <TableRow key={idx} className="group hover:bg-slate-50 dark:hover:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 transition-colors">
                            <TableCell className="py-2 text-sm font-medium text-slate-800 dark:text-slate-200">{res.name}</TableCell>
                            <TableCell className="py-2">
                              <Badge variant="outline" className="capitalize text-xs font-normal border-slate-200 text-slate-500">
                                {res.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 text-right font-mono text-xs text-slate-600 dark:text-slate-400">
                              {res.totalVolume.toLocaleString('id-ID', { maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className="py-2 text-center text-xs text-slate-400 font-mono bg-slate-50/50 dark:bg-slate-900/50">{res.unit}</TableCell>
                            <TableCell className="py-2 text-right font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                              Rp {res.totalCost.toLocaleString('id-ID')}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="histogram">
          {histogram.length === 0 ? (
            <EmptyState
              title="Belum ada data resource"
              description="Pastikan item RAB sudah di-link ke Task di Timeline, dan Task memiliki durasi yang valid."
              imageKeyword="resource histogram"
            />
          ) : (
            <div ref={exportRef} className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Resource Histogram (Cost Breakdown)</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={histogram}>
                        <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                        <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                        <YAxis
                          tick={{ fontSize: 12 }}
                          tickFormatter={(v) => v.toLocaleString("id-ID", { notation: "compact" })}
                        />
                        <Tooltip
                          formatter={(v: any) => v.toLocaleString("id-ID")}
                          labelFormatter={(l: any) => `Period: ${l}`}
                        />
                        <Legend />
                        <Bar dataKey="material" name="Material" stackId="a" fill="#3b82f6" />
                        <Bar dataKey="labor" name="Labor" stackId="a" fill="#f59e0b" />
                        <Bar dataKey="equipment" name="Equipment" stackId="a" fill="#ef4444" />
                        <Bar dataKey="other" name="Other/Overhead" stackId="a" fill="#94a3b8" />
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-3 text-sm text-neutral-500">
                      Catatan: Breakdown berdasarkan koefisien AHSP. Jika AHSP tidak ditemukan, biaya masuk ke "Other".
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Upcoming High-Cost Items</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topItems.map((it: { key: string; name: string; total: number }) => (
                      <div
                        key={it.key}
                        className="flex items-center justify-between rounded-md border p-3 text-sm dark:border-neutral-800"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-amber-600" />
                          <span className="font-medium">{it.name}</span>
                        </div>
                        <Badge variant="outline">
                          Rp {it.total.toLocaleString("id-ID")}
                        </Badge>
                      </div>
                    ))}
                    {topItems.length === 0 && (
                      <div className="text-sm text-neutral-500">Tidak ada item terjadwal.</div>
                    )}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Resource KPIs</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between rounded-md border p-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-blue-600" />
                        <span>Total Planned Cost</span>
                      </div>
                      <span className="font-semibold">Rp {total.toLocaleString("id-ID")}</span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-blue-500" />
                        <span>Material Cost</span>
                      </div>
                      <span className="font-semibold">
                        Rp {histogram.reduce((s, p) => s + (p.material || 0), 0).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <HardHat className="h-4 w-4 text-amber-500" />
                        <span>Labor Cost</span>
                      </div>
                      <span className="font-semibold">
                        Rp {histogram.reduce((s, p) => s + (p.labor || 0), 0).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <Truck className="h-4 w-4 text-red-500" />
                        <span>Equipment Cost</span>
                      </div>
                      <span className="font-semibold">
                        Rp {histogram.reduce((s, p) => s + (p.equipment || 0), 0).toLocaleString("id-ID")}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-md border p-3 dark:border-neutral-800">
                      <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-emerald-600" />
                        <span>Periods</span>
                      </div>
                      <span className="font-semibold">{histogram.length}</span>
                    </div>
                  </CardContent>
                </Card>

                <Card className="overflow-hidden">
                  <CardContent className="p-0">
                    <img
                      src="https://pub-cdn.sider.ai/u/U0W8H7R4X2W/web-coder/690b315461d18d657615a7d2/resource/71b5bb78-f6d2-4687-828f-870ecec5ba03.jpg"
                      className="h-40 w-full object-cover"
                      alt="Resource"
                    />
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
