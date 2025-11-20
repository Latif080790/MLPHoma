/**
 * Resource.tsx
 * Resource Planning module: budget-based resource histogram (as proxy),
 * upcoming high-cost items, procurement hints using RAP schedule.
 * Added CSV/Excel export and PDF snapshot.
 */

import React, { useMemo, useRef } from "react"
import { AppShell } from "../../components/layout/AppShell"
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

const EMPTY_ARRAY: any[] = []

/**
 * Merge RAP schedule to a per-period histogram with Resource Type breakdown
 */
function useHistogram(projectId: string) {
  const rap = useRapStore((s: any) => s.getPlan?.(projectId) ?? EMPTY_ARRAY)
  const rabItems = useRabStore((s: any) => s.getItems?.(projectId) ?? EMPTY_ARRAY)
  const ahspItems = useAHSPStore((s) => s.ahspItems)
  const componentsByAHSP = useAHSPStore((s) => s.componentsByAHSP)

  const points = useMemo(() => {
    if (!rap || rap.length === 0) return []

    // Index RAB items for quick lookup
    const rabMap = new Map(rabItems.map((i: any) => [i.id, i]))
    
    // Index AHSP items by code (assuming RAB item_code matches AHSP code)
    const ahspMap = new Map(ahspItems.map((i) => [i.code, i]))

    return rap.map((p: any) => {
      let totalCost = 0
      let materialCost = 0
      let laborCost = 0
      let equipmentCost = 0
      let otherCost = 0

      const items = p.items || []
      items.forEach((it: any) => {
        const plannedCost = it.plannedCost || 0
        totalCost += plannedCost

        // Try to find linked RAB item
        const rabItem = rabMap.get(it.rabId)
        if (rabItem) {
          // Try to find linked AHSP item
          const ahspItem = ahspMap.get(rabItem.item_code || rabItem.code)
          if (ahspItem) {
            const components = componentsByAHSP[ahspItem.id] || []
            if (components.length > 0) {
              // Calculate breakdown ratios
              const basePrice = components.reduce((sum, c) => sum + c.subtotal, 0)
              if (basePrice > 0) {
                const matRatio = components.filter(c => c.type === 'material').reduce((sum, c) => sum + c.subtotal, 0) / basePrice
                const labRatio = components.filter(c => c.type === 'labor').reduce((sum, c) => sum + c.subtotal, 0) / basePrice
                const eqRatio = components.filter(c => c.type === 'equipment').reduce((sum, c) => sum + c.subtotal, 0) / basePrice
                
                materialCost += plannedCost * matRatio
                laborCost += plannedCost * labRatio
                equipmentCost += plannedCost * eqRatio
                // Remaining goes to overhead/profit/others implicitly or we can track it
                otherCost += plannedCost * (1 - matRatio - labRatio - eqRatio)
                return // Done with this item
              }
            }
          }
        }
        
        // Fallback if no AHSP data: Assign to "Other" or guess based on name?
        // For now, assign to "Other" to highlight missing data
        otherCost += plannedCost
      })

      return {
        period: p.period ?? p.startDate ?? "—",
        startDate: p.startDate,
        cost: totalCost,
        material: materialCost,
        labor: laborCost,
        equipment: equipmentCost,
        other: otherCost
      }
    })
  }, [rap, rabItems, ahspItems, componentsByAHSP])
  
  return points
}

/**
 * Top consuming items across all schedule
 */
function useTopItems(projectId: string) {
  const rap = useRapStore((s: any) => s.getPlan?.(projectId) ?? EMPTY_ARRAY)
  const rabItems = useRabStore((s: any) => s.getItems?.(projectId) ?? EMPTY_ARRAY)
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
    </AppShell>
  )
}
