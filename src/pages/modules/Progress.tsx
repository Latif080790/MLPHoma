/**
 * Progress.tsx
 * Progress Tracking module: log actual progress and cost,
 * push to Curva-S store, and show recent history.
 * Added CSV/Excel export and PDF snapshot for the history table.
 */

import React, { useMemo, useRef, useState } from "react"
import { ModuleHeader } from "../../components/modules/ModuleHeader"
import { BarChart2, Plus, Download, FileSpreadsheet, FileText } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Button } from "../../components/ui/button"
import { useProjectStore } from "../../store/projectStore"
import { useCurvaSStore } from "../../store/curvaSStore"
import { EmptyState } from "../../components/common/EmptyState"
import * as XLSX from "xlsx"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

/**
 * Export progress rows as CSV
 */
function exportProgressCSV(rows: any[]) {
  const headers = ["Date", "Planned%", "Actual%", "ActualCost", "Notes"]
  const lines = [headers.join(",")]
  rows.forEach((r) => {
    lines.push(
      [
        new Date(r.date).toISOString().split("T")[0],
        r.plannedProgress.toFixed(1),
        r.actualProgress.toFixed(1),
        r.actualCost,
        (r.notes || "").toString().replace(/"/g, '""'),
      ]
        .map((v) => (typeof v === "string" ? `"${v}"` : String(v)))
        .join(",")
    )
  })
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "progress_history.csv"
  a.click()
  URL.revokeObjectURL(url)
}

/**
 * Export progress rows to Excel
 */
function exportProgressExcel(rows: any[]) {
  const sheetData = [
    ["Progress History"],
    ["GeneratedAt", new Date().toISOString()],
    [],
    ["Date", "Planned%", "Actual%", "ActualCost", "Notes"],
    ...rows.map((r) => [
      new Date(r.date).toISOString().split("T")[0],
      r.plannedProgress,
      r.actualProgress,
      r.actualCost,
      r.notes || "",
    ]),
  ]
  const ws = XLSX.utils.aoa_to_sheet(sheetData)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, "Progress")
  XLSX.writeFile(wb, "Progress.xlsx")
}

/**
 * Export a DOM container to PDF
 */
async function exportPDF(element: HTMLElement | null, filename = "Progress.pdf") {
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
 * Progress module page
 */
export default function Progress() {
  const project = useProjectStore((s) => (s as any).getActiveProject?.() ?? null)
  const projectName = project?.name ?? "—"
  const projectId = project?.id ?? "demo"

  const { addDataPoint, getDataPoints } = useCurvaSStore()
  const all = getDataPoints(projectId)

  const [form, setForm] = useState({
    date: new Date().toISOString().split("T")[0],
    progress: 0,
    cost: 0,
    notes: "",
    photoUrl: "",
  })

  const recent = useMemo(
    () =>
      all
        .filter((d) => d.actualProgress > 0 || d.actualCost > 0)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 50),
    [all]
  )

  const exportRef = useRef<HTMLDivElement | null>(null)

  const onAdd = () => {
    if (!form.date) return
    
    // Find existing point to preserve planned values if needed, 
    // but actually we should just omit them from the update object 
    // so the store's merge logic keeps the old ones.
    // However, if it's a new point, we might want defaults.
    // The store handles merge. We just need to not send 0.

    const payload: any = {
      projectId,
      date: form.date,
      actualProgress: Number(form.progress) || 0,
      actualCost: Number(form.cost) || 0,
      notes: form.notes,
      updatedAt: new Date().toISOString(),
    }

    // Only add createdAt if it's likely a new point (though store handles this too)
    // We don't send plannedProgress/plannedCost so they are not overwritten.
    
    addDataPoint(projectId, payload)
    
    setForm({
      date: new Date().toISOString().split("T")[0],
      progress: 0,
      cost: 0,
      notes: "",
      photoUrl: "",
    })
  }

  const currentPlanned = useMemo(() => {
    const p = all.find(d => d.date === form.date)
    return p ? { progress: p.plannedProgress, cost: p.plannedCost } : null
  }, [all, form.date])

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={<BarChart2 size={18} />}
        title="Progress Tracking"
        description="Input progres aktual dan biaya lapangan—terhubung langsung ke Curva‑S."
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportProgressCSV(recent)}
            >
              <Download size={16} /> CSV
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportProgressExcel(recent)}
            >
              <FileSpreadsheet size={16} /> Excel
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportPDF(exportRef.current, "Progress.pdf")}
            >
              <FileText size={16} /> PDF
            </button>
          </div>
        }
      />

      {!project ? (
        <div className="container mx-auto py-6">
          <EmptyState
            title="No Project Selected"
            description="Pilih project terlebih dahulu untuk mencatat progres."
            imageKeyword="site progress"
          />
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Tambah Progres Aktual</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="date">Date</Label>
                    <Input
                      id="date"
                      type="date"
                      value={form.date}
                      onChange={(e) => setForm({ ...form, date: e.target.value })}
                    />
                    {currentPlanned && (
                      <div className="mt-1 text-xs text-neutral-500">
                        Planned: {currentPlanned.progress.toFixed(1)}% / Rp {currentPlanned.cost.toLocaleString('id-ID')}
                      </div>
                    )}
                  </div>
                  <div>
                    <Label htmlFor="progress">Progress (%)</Label>
                    <Input
                      id="progress"
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={form.progress}
                      onChange={(e) => setForm({ ...form, progress: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="cost">Actual Cost (IDR)</Label>
                    <Input
                      id="cost"
                      type="number"
                      min="0"
                      value={form.cost}
                      onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label htmlFor="notes">Notes</Label>
                    <Input
                      id="notes"
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="photo">Photo URL (optional)</Label>
                    <Input
                      id="photo"
                      placeholder="https://..."
                      value={form.photoUrl}
                      onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                    />
                  </div>
                </div>
                <Button onClick={onAdd} className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Progress
                </Button>
              </CardContent>
            </Card>

            <Card ref={exportRef as any}>
              <CardHeader>
                <CardTitle>Riwayat Update Terbaru</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <div className="grid grid-cols-5 border-b bg-neutral-50 p-2 text-sm font-medium dark:border-neutral-800 dark:bg-neutral-900">
                    <div>Date</div>
                    <div className="text-right">Planned (%)</div>
                    <div className="text-right">Actual (%)</div>
                    <div className="text-right">Actual Cost</div>
                    <div>Notes</div>
                  </div>
                  {recent.map((r) => (
                    <div key={r.id} className="grid grid-cols-5 border-b p-2 text-sm last:border-b-0 dark:border-neutral-800">
                      <div>{new Date(r.date).toLocaleDateString("id-ID")}</div>
                      <div className="text-right">{r.plannedProgress.toFixed(1)}%</div>
                      <div className="text-right">{r.actualProgress.toFixed(1)}%</div>
                      <div className="text-right">Rp {r.actualCost.toLocaleString("id-ID")}</div>
                      <div className="truncate">{r.notes || "-"}</div>
                    </div>
                  ))}
                  {recent.length === 0 && (
                    <div className="p-3 text-sm text-neutral-500">Belum ada data progres.</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="overflow-hidden">
              <CardContent className="p-0">
                <img
                  src={form.photoUrl || "https://pub-cdn.sider.ai/u/U0W8H7R4X2W/web-coder/690b315461d18d657615a7d2/resource/e6de7e83-e3ee-4566-8ab2-7f56a116b5ee.jpg"}
                  alt="Preview"
                  className="h-56 w-full object-cover"
                />
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  )
}
