/**
 * Progress.tsx
 * Progress Tracking module: log actual progress and cost,
 * push to Curva-S store, and show recent history.
 * Added CSV/Excel export and PDF snapshot for the history table.
 */

import React, { useMemo, useRef, useState } from "react"
import { ModuleHeader } from "../../components/modules/ModuleHeader"
import { BarChart2, Plus, Download, FileSpreadsheet, FileText, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useProjectStore } from "../../store/projectStore"
import { useCurvaSStore } from "../../store/curvaSStore"
import { EmptyState } from "../../components/common/EmptyState"
import * as XLSX from "xlsx"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"
import { timelineService } from "@/services/timelineService"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { progressBillingService } from "@/services/progressBillingService"
import { progressEvidenceService } from "@/services/progressEvidenceService"

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
        (r.plannedProgress ?? 0).toFixed(1),
        (r.actualProgress ?? 0).toFixed(1),
        r.actualCost ?? 0,
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
    volume: 0,
    weather: 'sunny',
    delayReason: 'none'
  })

  // Photo Upload State
  const [uploading, setUploading] = useState(false)
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null)

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const url = await timelineService.uploadProgressPhoto(file, `progress/${projectId}`)
      setForm(prev => ({ ...prev, photoUrl: url }))
      toast.success("Photo uploaded successfully")
    } catch (err: any) {
      toast.error("Upload failed", { description: err.message })
    } finally {
      setUploading(false)
    }
  }

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

    const payload: any = {
      projectId,
      date: form.date,
      actualProgress: Number(form.progress) || 0,
      actualCost: Number(form.cost) || 0,
      notes: form.notes,
      updatedAt: new Date().toISOString(),
    }

    addDataPoint(projectId, payload)

    // Auto-trigger billing generation (non-blocking)
    try {
      progressBillingService.generateMonthlyBilling(
        projectId,
        Number(form.progress) || 0
      ).then(() => {
        toast.success("Billing claim auto-generated", {
          description: "Check Finance → AR for details.",
          action: {
            label: 'Go to Finance',
            onClick: () => window.location.hash = '/finance'
          }
        })
      }).catch((err) => {
        toast.error('Auto-billing gagal', {
          description: err?.message || 'Billing generation failed. Please check Finance module manually.'
        })
      })
    } catch { /* ignore */ }

    setForm({
      date: new Date().toISOString().split("T")[0],
      progress: 0,
      cost: 0,
      notes: "",
      photoUrl: "",
      volume: 0,
      weather: 'sunny',
      delayReason: 'none'
    })
    setGpsCoords(null)
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
                    <div className="mt-2 text-xs flex gap-2">
                      <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setForm({ ...form, weather: 'sunny' })}>Start: ☀️ Sunny</Badge>
                      <Badge variant="outline" className="cursor-pointer hover:bg-slate-100" onClick={() => setForm({ ...form, weather: 'rain_heavy' })}>🌧️ Heavy Rain</Badge>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="volume">Daily Volume (m2/m3)</Label>
                    <Input
                      id="volume"
                      type="number"
                      placeholder="Input Volume Terpasang..."
                      value={form.volume || ''}
                      onChange={(e) => {
                        const vol = Number(e.target.value)
                        // Simple auto-calc % logic (mockup: assuming total vol 100 for demo)
                        setForm({ ...form, volume: vol, progress: vol / 100 * 100 })
                      }}
                      className="border-blue-500"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">*Input Volume, Progress % hits auto.</p>
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
                    <Label htmlFor="delay">Delay Reason (If Any)</Label>
                    <Select onValueChange={(val) => setForm({ ...form, delayReason: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select Reason..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None (On Track)</SelectItem>
                        <SelectItem value="weather">Weather / Hujan</SelectItem>
                        <SelectItem value="material">Material Late</SelectItem>
                        <SelectItem value="equipment">Alat Rusak</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-2">
                    <Label htmlFor="photo">Evidence / Photo URL (Required for QC)</Label>
                    <div className="flex gap-2 items-center">
                      <Input
                        id="photo"
                        placeholder="https://..."
                        value={form.photoUrl}
                        onChange={(e) => setForm({ ...form, photoUrl: e.target.value })}
                        className="flex-1"
                      />

                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        id="photo-upload"
                        onChange={handleFileUpload}
                        disabled={uploading}
                      />
                      <label
                        htmlFor="photo-upload"
                        className={`inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 w-10 cursor-pointer ${uploading ? 'opacity-50' : ''}`}
                      >
                        {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                      </label>

                      <Button variant="outline" size="icon" title="Get GPS" onClick={async () => {
                        try {
                          const pos = await progressEvidenceService.getCurrentPosition()
                          if (pos) {
                            setGpsCoords(pos)
                            toast.success(`GPS: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`)
                          } else {
                            toast.error("GPS unavailable")
                          }
                        } catch (err: any) {
                          toast.error("GPS failed", { description: err.message })
                        }
                      }}>
                        <MapPin className={`h-4 w-4 ${gpsCoords ? 'text-green-600' : ''}`} />
                      </Button>
                    </div>
                  </div>
                </div>
                <Button onClick={onAdd} className="w-full bg-green-600 hover:bg-green-700">
                  <Plus className="mr-2 h-4 w-4" />
                  Submit for QC Validation
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
                      <div className="text-right">{(r.plannedProgress ?? 0).toFixed(1)}%</div>
                      <div className="text-right">{(r.actualProgress ?? 0).toFixed(1)}%</div>
                      <div className="text-right">Rp {(r.actualCost ?? 0).toLocaleString("id-ID")}</div>
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
