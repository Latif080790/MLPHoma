/**
 * Reports.tsx
 * Reports & Export Center: KPIs snapshot and export buttons (CSV, Excel, PDF).
 * Enhancements: Excel export (xlsx) and PDF export (jsPDF + html2canvas) for KPI snapshot.
 */

import React, { useMemo, useRef } from "react"
import { AppShell } from "../../components/layout/AppShell"
import { ModuleHeader } from "../../components/modules/ModuleHeader"
import { FileBarChart2, Download, Target, DollarSign, Calendar, FileSpreadsheet, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { useProjectStore } from "../../store/projectStore"
import { useRabStore } from "../../store/rabStore"
import { useCurvaSStore } from "../../store/curvaSStore"
import { useRapStore } from "../../store/rapStore"
import * as XLSX from "xlsx"
import jsPDF from "jspdf"
import html2canvas from "html2canvas"
import { calculateCashFlow } from "../../lib/cashflowCalculator"

/**
 * Build RAB KPI summary from items
 */
function useRabSummary(projectId: string) {
  const rabItems = useRabStore((s: any) => s.getItems?.(projectId) ?? [])
  const total = useMemo(
    () => rabItems.reduce((sum: number, it: any) => sum + (it.finalTotal || it.final_total || it.finalPrice || 0), 0),
    [rabItems]
  )
  const count = rabItems.length
  return { total, count, items: rabItems }
}

/**
 * Curva-S analysis snapshot
 */
function useCurvaSnapshot(projectId: string) {
  const analysis = useCurvaSStore((s) => s.getAnalysis(projectId))
  return analysis
}

/**
 * Cash Flow Summary Hook
 */
function useCashFlowSummary(projectId: string, budget: number, terms: any) {
  const points = useCurvaSStore((s) => (projectId ? s.getDataPoints(projectId) : []))
  const summary = useMemo(() => {
    const rows = calculateCashFlow(points, terms || {}, budget || 0)
    if (!rows.length) return { inflow: 0, outflow: 0, balance: 0 }
    const last = rows[rows.length - 1]
    return {
      inflow: last.cumInflow,
      outflow: last.cumOutflow,
      balance: last.balance,
    }
  }, [points, budget, terms])
  return summary
}

/**
 * Resource Summary Hook (Top 3 High Cost Items)
 */
function useResourceSummary(projectId: string) {
  const rap = useRapStore((s: any) => s.getSchedule?.(projectId) ?? [])
  const rabItems = useRabStore((s: any) => s.getItems?.(projectId) ?? [])

  const topItems = useMemo(() => {
    const map: Record<string, { name: string; total: number }> = {}
    const byId: Record<string, string> = {}
    rabItems.forEach((ri: any) => (byId[ri.id ?? ri.rab_id ?? ri.item_code] = ri.item_name ?? ri.name))

    rap.forEach((p: any) =>
      (p.items || []).forEach((it: any) => {
        const key = it.rabId ?? it.rab_id ?? it.item_code
        const name = byId[key] ?? key
        map[key] = map[key]
          ? { ...map[key], total: map[key].total + (it.plannedCost || 0) }
          : { name, total: it.plannedCost || 0 }
      })
    )
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 3)
  }, [rap, rabItems])

  return topItems
}

/**
 * Export helpers - CSV (existing)
 */
function exportRabCSV(items: any[]) {
  const headers = ["Item Code", "Name", "Unit", "Volume", "Unit Price", "Final Total"]
  const lines = [headers.join(",")]
  items.forEach((it: any) => {
    const row = [
      it.item_code ?? it.code ?? "",
      (it.item_name ?? it.name ?? "").toString().replace(/"/g, '""'),
      it.unit ?? "",
      it.volume ?? 0,
      it.unit_price ?? it.unitPrice ?? 0,
      it.finalTotal ?? it.final_total ?? it.finalPrice ?? 0,
    ]
    lines.push(row.map((v) => (typeof v === "string" ? `"${v}"` : String(v))).join(","))
  })
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "RAB_Summary.csv"
  a.click()
  URL.revokeObjectURL(url)
}

function exportCurvaCSV(analysis: any | null) {
  if (!analysis) return
  const headers = ["ProjectId", "CurrentProgress", "SPI", "CPI", "Status", "ForecastCompletion", "ForecastTotalCost", "AnalysisDate"]
  const values = [
    analysis.projectId,
    analysis.currentProgress,
    analysis.metrics.spi,
    analysis.metrics.cpi,
    analysis.status,
    analysis.forecastCompletionDate ?? "",
    analysis.forecastTotalCost ?? "",
    analysis.analysisDate,
  ]
  const csv = headers.join(",") + "\n" + values.join(",")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "CurvaS_Analysis.csv"
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export helpers - Excel
 */
function exportExcel(rabItems: any[], curva: any | null) {
  const rabSheet = [
    ["RAB Summary"],
    ["GeneratedAt", new Date().toISOString()],
    [],
    ["Item Code", "Name", "Unit", "Volume", "Unit Price", "Final Total"],
    ...rabItems.map((it: any) => [
      it.item_code ?? it.code ?? "",
      it.item_name ?? it.name ?? "",
      it.unit ?? "",
      it.volume ?? 0,
      it.unit_price ?? it.unitPrice ?? 0,
      it.finalTotal ?? it.final_total ?? it.finalPrice ?? 0,
    ]),
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(rabSheet)

  const curvaSheet = [
    ["Curva-S Analysis"],
    ["GeneratedAt", new Date().toISOString()],
    [],
    ["ProjectId", "CurrentProgress", "SPI", "CPI", "Status", "ForecastCompletion", "ForecastTotalCost", "AnalysisDate"],
    [
      curva?.projectId ?? "",
      curva?.currentProgress ?? "",
      curva?.metrics?.spi ?? "",
      curva?.metrics?.cpi ?? "",
      curva?.status ?? "",
      curva?.forecastCompletionDate ?? "",
      curva?.forecastTotalCost ?? "",
      curva?.analysisDate ?? "",
    ],
  ]
  const ws2 = XLSX.utils.aoa_to_sheet(curvaSheet)

  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws1, "RAB_Summary")
  XLSX.utils.book_append_sheet(wb, ws2, "CurvaS_Analysis")
  XLSX.writeFile(wb, "Reports.xlsx")
}

/**
 * Export KPI snapshot to PDF
 */
async function exportPDF(element: HTMLElement | null, filename = "Reports.pdf") {
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
 * Reports module
 */
export default function Reports() {
  const project = useProjectStore((s: any) => s.getActiveProject?.() ?? null)
  const projectName = project?.name ?? "—"
  const projectId = project?.id ?? "demo"

  const rab = useRabSummary(projectId)
  const curva = useCurvaSnapshot(projectId)
  const cashFlow = useCashFlowSummary(projectId, project?.budget ?? 0, project?.paymentTerms)
  const topResources = useResourceSummary(projectId)

  const rap = useRapStore((s: any) => s.getSchedule?.(projectId) ?? [])
  const totalRap = useMemo(
    () =>
      rap.reduce(
        (sum: number, p: any) => sum + (p.items || []).reduce((s: number, it: any) => s + (it.plannedCost || 0), 0),
        0
      ),
    [rap]
  )

  const exportRef = useRef<HTMLDivElement | null>(null)

  return (
    <AppShell projectName={projectName}>
      <ModuleHeader
        icon={<FileBarChart2 size={18} />}
        title="Reports"
        description="Dashboard analitik dan ekspor (CSV, Excel, PDF) untuk RAB &amp; Curva‑S."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportRabCSV(rab.items)}
            >
              <Download size={16} /> RAB CSV
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportCurvaCSV(curva)}
            >
              <Download size={16} /> Curva‑S CSV
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportExcel(rab.items, curva)}
            >
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportPDF(exportRef.current, "Reports.pdf")}
            >
              <FileText size={16} /> PDF
            </button>
          </div>
        }
      />

      <div ref={exportRef} className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" /> Total Budget (RAB)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            Rp {rab.total.toLocaleString("id-ID")}
            <div className="mt-2 text-sm text-neutral-500">{rab.count} items</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-600" /> Total RAP (Planned Cost)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            Rp {totalRap.toLocaleString("id-ID")}
            <div className="mt-2 text-sm text-neutral-500">Aggregated from schedule</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5 text-amber-600" /> SPI/CPI
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-bold">
            {curva ? (
              <div className="flex items-center gap-6">
                <div>SPI {curva.metrics.spi.toFixed(2)}</div>
                <div>CPI {curva.metrics.cpi.toFixed(2)}</div>
              </div>
            ) : (
              <div className="text-base text-neutral-500">No analysis</div>
            )}
            <div className="mt-2 text-sm text-neutral-500">Status: {curva ? curva.status.replace("-", " ") : "—"}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-emerald-600" /> Cash Flow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-neutral-500">Inflow</div>
                <div className="font-bold text-green-600">Rp {cashFlow.inflow.toLocaleString("id-ID")}</div>
              </div>
              <div>
                <div className="text-sm text-neutral-500">Outflow</div>
                <div className="font-bold text-rose-600">Rp {cashFlow.outflow.toLocaleString("id-ID")}</div>
              </div>
            </div>
            <div className="mt-2 border-t pt-2">
              <div className="flex justify-between text-sm font-medium">
                <span>Net Balance</span>
                <span className={cashFlow.balance < 0 ? "text-rose-600" : "text-blue-600"}>
                  Rp {cashFlow.balance.toLocaleString("id-ID")}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileBarChart2 className="h-5 w-5 text-purple-600" /> Top Resources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topResources.length > 0 ? (
              topResources.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="truncate pr-2">{item.name}</span>
                  <span className="font-medium">Rp {item.total.toLocaleString("id-ID")}</span>
                </div>
              ))
            ) : (
              <div className="text-sm text-neutral-500">No resource data</div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <img
              src="https://pub-cdn.sider.ai/u/U0W8H7R4X2W/web-coder/690b315461d18d657615a7d2/resource/43ef6f55-5795-47a4-be29-66d5c61e53fa.jpg"
              className="h-56 w-full object-cover"
              alt="Reports"
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {curva?.insights?.length ? (
              curva.insights.map((i, idx) => (
                <div key={idx} className="rounded-md border p-3 dark:border-neutral-800">
                  {i}
                </div>
              ))
            ) : (
              <div className="text-neutral-500">Belum ada insight.</div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  )
}
