/**
 * Resource.tsx
 * Resource Planning module: budget-based resource histogram (as proxy),
 * upcoming high-cost items, procurement hints using RAP schedule.
 * Added CSV/Excel export and PDF snapshot.
 */

import React, { useMemo, useRef } from "react"
import { AppShell } from "../../components/layout/AppShell"
import { ModuleHeader } from "../../components/modules/ModuleHeader"
import { Boxes, CalendarDays, Package, Receipt, TrendingUp, Download, FileSpreadsheet, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Badge } from "../../components/ui/badge"
import { useProjectStore } from "../../store/projectStore"
import { useRapStore } from "../../store/rapStore"
import { useRabStore } from "../../store/rabStore"
import { ResponsiveContainer, BarChart, XAxis, YAxis, CartesianGrid, Tooltip, Bar } from "recharts"
import { EmptyState } from "../../components/common/EmptyState"
import * as XLSX from "xlsx"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

/**
 * Merge RAP schedule to a per-period histogram
 */
function useHistogram(projectId: string) {
  const rap = useRapStore((s: any) => s.getSchedule?.(projectId) ?? [])
  const points = useMemo(() => {
    if (!rap || rap.length === 0) return []
    return rap.map((p: any) => {
      const cost = (p.items || []).reduce((sum: number, it: any) => sum + (it.plannedCost || 0), 0)
      return {
        period: p.period ?? p.startDate ?? "—",
        startDate: p.startDate,
        cost,
      }
    })
  }, [rap])
  return points
}

/**
 * Top consuming items across all schedule
 */
function useTopItems(projectId: string) {
  const rap = useRapStore((s: any) => s.getSchedule?.(projectId) ?? [])
  const rabItems = useRabStore((s: any) => s.getItems?.(projectId) ?? [])
  const byId: Record<string, any> = {}
  rabItems.forEach((ri: any) => (byId[ri.id ?? ri.rab_id ?? ri.rabId ?? ri.item_code] = ri))

  const items = useMemo(() => {
    const map: Record<string, { key: string; name: string; total: number }> = {}
    rap.forEach((p: any) =>
      (p.items || []).forEach((it: any) => {
        const key = it.rabId ?? it.rab_id ?? it.item_code
        const ref = byId[key]
        const name = ref?.item_name ?? ref?.name ?? key
        map[key] = map[key]
          ? { ...map[key], total: map[key].total + (it.plannedCost || 0) }
          : { key, name, total: it.plannedCost || 0 }
      })
    )
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 6)
  }, [rap, rabItems])

  return items
}

/**
 * Export histogram rows to CSV
 */
function exportHistogramCSV(rows: { period: string; cost: number }[]) {
  const headers = ["Period", "PlannedCost"]
  const lines = [headers.join(",")]
  rows.forEach((r) => lines.push([r.period, r.cost].join(",")))
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
function exportResourceExcel(histogram: { period: string; cost: number }[], top: { key: string; name: string; total: number }[]) {
  const ws1 = XLSX.utils.aoa_to_sheet([
    ["Resource Histogram (Cost Proxy)"],
    ["GeneratedAt", new Date().toISOString()],
    [],
    ["Period", "PlannedCost"],
    ...histogram.map((h) => [h.period, h.cost]),
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
  const project = useProjectStore((s: any) => s.getActiveProject?.() ?? null)
  const projectName = project?.name ?? "—"
  const projectId = project?.id ?? "demo"

  const histogram = useHistogram(projectId)
  const topItems = useTopItems(projectId)
  const total = histogram.reduce((s, p) => s + p.cost, 0)

  const exportRef = useRef<HTMLDivElement | null>(null)

  return (
    <AppShell projectName={projectName}>
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

      {histogram.length === 0 ? (
        <EmptyState
          title="Belum ada data resource"
          description="Generate RAP terlebih dahulu untuk melihat histogram beban biaya per periode."
          imageKeyword="resource histogram"
        />
      ) : (
        <div ref={exportRef} className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Resource Histogram (Cost Proxy)</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={histogram}>
                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                    <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => v.toLocaleString("id-ID")}
                    />
                    <Tooltip
                      formatter={(v: any) => v.toLocaleString("id-ID")}
                      labelFormatter={(l: any) => `Period: ${l}`}
                    />
                    <Bar dataKey="cost" name="Planned Cost" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-3 text-sm text-neutral-500">
                  Catatan: Histogram menggunakan biaya terencana sebagai proksi kebutuhan resource.
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Upcoming High-Cost Items</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {topItems.map((it) => (
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
                    <CalendarDays className="h-4 w-4 text-emerald-600" />
                    <span>Periods</span>
                  </div>
                  <span className="font-semibold">{histogram.length}</span>
                </div>
                <div className="flex items-center justify-between rounded-md border p-3 dark:border-neutral-800">
                  <div className="flex items-center gap-2">
                    <Receipt className="h-4 w-4 text-rose-600" />
                    <span>Top Items Tracked</span>
                  </div>
                  <span className="font-semibold">{topItems.length}</span>
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
    </AppShell>
  )
}
