/**
 * Progress.tsx
 * Progress Tracking module: log actual progress and cost,
 * push to Curva-S store, and show recent history.
 * Added CSV/Excel export and PDF snapshot for the history table.
 */

import React, { useMemo, useRef, useState } from "react"
import { ModuleHeader } from "../../components/modules/ModuleHeader"
import { BarChart2, Plus, FileText, MapPin } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "../../components/ui/card"
import { Input } from "../../components/ui/input"
import { Label } from "../../components/ui/label"
import { Button } from "../../components/ui/button"
import { Badge } from "../../components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useProjectStore } from "../../store/projectStore"
import { useCurvaSStore } from "../../store/curvaSStore"
import { useWBSStore } from "../../store/wbsStore"
import type { Project } from "../../store/projectStore"
import type { CurvaSDataPoint } from "../../types/curvaS"
import { EmptyState } from "../../components/common/EmptyState"
import { timelineService } from "@/services/timelineService"
import { Camera, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { progressBillingService } from "@/services/progressBillingService"
import { progressEvidenceService } from "@/services/progressEvidenceService"
import { syncProgressLog } from "@/lib/supabaseSyncService"
import { reportService } from "@/services/reportService"
import { ResourceUsageDialog } from "@/components/progress/ResourceUsageDialog"
import { ExportMenu } from "@/components/shared/ExportMenu"
import { RoleGuard } from "@/components/common/RoleGuard"

type ProgressLogExtra = {
  wbsId?: string
  photoUrl?: string
  qc_status?: 'pending' | 'approved' | 'rejected' | string
  gpsCoords?: { latitude: number; longitude: number } | null
}

type RecentProgressRow = CurvaSDataPoint & ProgressLogExtra & {
  wbsName?: string
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message
  return 'Unknown error'
}

/**
 * Export progress rows as CSV
 */
function exportProgressCSV(rows: RecentProgressRow[]) {
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
async function exportProgressExcel(rows: RecentProgressRow[]) {
  const XLSX = await import("xlsx")
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
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ])
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
  const project = useProjectStore((s): Project | null => s.getActiveProject?.() ?? null)
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
    wbsId: "",
    weather: 'sunny',
    delayReason: 'none'
  })

  const [resourceOpen, setResourceOpen] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null)
  const [allowNoGps, setAllowNoGps] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)

  const captureGps = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation not supported")
      setAllowNoGps(true)
      return
    }
    setGpsLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
        setGpsLoading(false)
        toast.success("GPS Captured")
      },
      (err) => {
        toast.warning("Could not capture GPS. You may still submit but it will be flagged as unverified.")
        setGpsLoading(false)
        setAllowNoGps(true)
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const url = await timelineService.uploadProgressPhoto(file, `progress/${projectId}`)
      setForm(prev => ({ ...prev, photoUrl: url }))
      toast.success("Photo uploaded successfully")
    } catch (err: unknown) {
      toast.error("Upload failed", { description: getErrorMessage(err) })
    } finally {
      setUploading(false)
    }
  }

  const { itemsByProject } = useWBSStore()
  const wbsItems = useMemo(() => itemsByProject[projectId] || [], [itemsByProject, projectId])

  const recent = useMemo(
    () =>
      all
        .filter((d) => d.actualProgress > 0 || d.actualCost > 0)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .map((d): RecentProgressRow => {
          const extra = d as CurvaSDataPoint & Partial<ProgressLogExtra>
          return {
            ...d,
            wbsName: wbsItems.find(w => w.id === extra.wbsId)?.name,
            photoUrl: extra.photoUrl,
            qc_status: extra.qc_status || 'pending',
            gpsCoords: extra.gpsCoords,
          }
        })
        .slice(0, 50),
    [all, wbsItems]
  )

  const exportRef = useRef<HTMLDivElement | null>(null)

  const onAdd = () => {
    if (!form.date) return

    // Task 1: Enforce Evidence-Based Progress
    // Only block if not a demo/local project (optional: block always for strict policy)
    const isStrictPolicy = !projectId.includes('demo') && projectId !== 'default'
    if (isStrictPolicy) {
      if (!form.photoUrl) {
        toast.error("Evidence Required", { description: "Please upload a photo of site progress before submitting." })
        return
      }
      if (!gpsCoords && !allowNoGps) {
        toast.error("GPS Required", {
          description: "Please capture GPS location to verify site presence. If GPS is unavailable, try again or use the bypass (if allowed)."
        })
        return
      }
    }

    const existingPoint = all.find((point) => point.date === form.date)
    const nowIso = new Date().toISOString()
    const payload: CurvaSDataPoint = {
      id: existingPoint?.id || `${projectId}-${form.date}`,
      projectId,
      date: form.date,
      plannedProgress: existingPoint?.plannedProgress || 0,
      actualProgress: Number(form.progress) || 0,
      plannedCost: existingPoint?.plannedCost || 0,
      actualCost: Number(form.cost) || 0,
      notes: allowNoGps && !gpsCoords ? `[NO-GPS] ${form.notes}` : form.notes,
      createdAt: existingPoint?.createdAt || nowIso,
      updatedAt: nowIso,
    }

    // 1. Save detailed progress log with evidence (Phase 11)
    syncProgressLog({
      ...form,
      projectId,
      gpsCoords
    })

    // 2. Update S-Curve Data Points
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
      wbsId: "",
      weather: 'sunny',
      delayReason: 'none'
    })
    setGpsCoords(null)
  }

  const handleApproveQC = async (id: string) => {
    // In a real app we'd fetch the log id from Supabase, but CurvaS store might just have client ids.
    // Assuming 'id' is a valid Supabase progress_logs UUID for this demo:
    if (!id || id.length < 10) { toast.error("Invalid progress ID"); return }
    const success = await progressEvidenceService.approveProgressLog(id, 'PM_USER')
    if (success) toast.success("Quality Control Approved")
  }

  const handleRejectQC = async (id: string) => {
    if (!id || id.length < 10) { toast.error("Invalid progress ID"); return }
    const reason = window.prompt("Reason for rejection:")
    if (!reason) return
    const success = await progressEvidenceService.rejectProgressLog(id, reason)
    if (success) toast.success("Quality Control Rejected")
  }

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={<BarChart2 size={18} />}
        title="Progress Tracking"
        description="Input progres aktual dan biaya lapangan—terhubung langsung ke Curva‑S."
        accent="blue"
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 shadow-sm"
              onClick={() => {
                toast.promise(reportService.generateDSR(projectId, form.date), {
                  loading: 'Generating Daily Site Report...',
                  success: 'DSR downloaded successfully',
                  error: 'Failed to generate DSR'
                })
              }}
            >
              <FileText size={16} /> Generate DSR
            </button>
            <button
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800 text-blue-600 border-blue-200"
              onClick={() => setResourceOpen(true)}
            >
              <Plus size={16} /> Log Resource
            </button>
            <ExportMenu
              data={recent}
              columns={[
                { header: 'Date', accessor: r => new Date(r.date).toISOString().split('T')[0] },
                { header: 'Planned %', accessor: r => (r.plannedProgress ?? 0).toFixed(1) },
                { header: 'Actual %', accessor: r => (r.actualProgress ?? 0).toFixed(1) },
                { header: 'Actual Cost', accessor: r => r.actualCost ?? 0 },
                { header: 'Notes', accessor: r => r.notes ?? '' },
              ]}
              filename={`Progress_${projectId}`}
            />
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              onClick={() => exportPDF(exportRef.current, "Progress.pdf")}
            >
              <FileText size={16} /> PDF
            </button>
          </div>
        }
      />

      <ResourceUsageDialog open={resourceOpen} onOpenChange={setResourceOpen} projectId={projectId} />

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
                {/* WBS Link Section */}
                <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30 space-y-2">
                  <Label htmlFor="wbs-select" className="text-blue-700 dark:text-blue-300 font-bold flex items-center gap-1.5">
                    <BarChart2 size={14} /> Item Pekerjaan (WBS Link)
                  </Label>
                  <Select
                    value={form.wbsId}
                    onValueChange={(val) => {
                      const item = wbsItems.find(i => i.id === val)
                      setForm({ ...form, wbsId: val, notes: item ? `Progress for ${item.name}` : form.notes })
                    }}
                  >
                    <SelectTrigger id="wbs-select" className="bg-white dark:bg-slate-900 border-blue-200 focus:ring-blue-500">
                      <SelectValue placeholder="Pilih Item Pekerjaan..." />
                    </SelectTrigger>
                    <SelectContent>
                      {wbsItems.filter(i => i.level > 1).map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          <span className="font-mono text-xs mr-2 opacity-50">{item.code}</span>
                          {item.name}
                        </SelectItem>
                      ))}
                      {wbsItems.length === 0 && (
                        <SelectItem value="none" disabled>No tasks found in WBS</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-blue-600/70 italic">*Wajib dipilih agar Actual Cost ter-link otomatis ke Budget Control.</p>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="bg-sky-50 text-sky-700 border-sky-200"
                    onClick={captureGps}
                    disabled={gpsLoading}
                  >
                    {gpsLoading ? <Loader2 size={14} className="animate-spin mr-2" /> : <MapPin size={14} className="mr-2" />}
                    Capture GPS Location
                  </Button>
                  {gpsCoords && (
                    <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                      {gpsCoords.latitude.toFixed(4)}, {gpsCoords.longitude.toFixed(4)}
                    </Badge>
                  )}
                  {allowNoGps && !gpsCoords && (
                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                      GPS Unavailable (Allowed)
                    </Badge>
                  )}
                </div>

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
                    <p className="text-xs text-muted-foreground mt-1">*Input Volume, Progress % hits auto.</p>
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

                      <Button variant="outline" size="icon" title="Get GPS" aria-label="Get GPS location" onClick={async () => {
                        try {
                          const pos = await progressEvidenceService.getCurrentPosition()
                          if (pos) {
                            setGpsCoords(pos)
                            toast.success(`GPS: ${pos.latitude.toFixed(6)}, ${pos.longitude.toFixed(6)}`)
                          } else {
                            toast.error("GPS unavailable")
                          }
                        } catch (err: unknown) {
                          toast.error("GPS failed", { description: getErrorMessage(err) })
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

            <div ref={exportRef}>
              <Card>
                <CardHeader>
                  <CardTitle>Riwayat Update Terbaru</CardTitle>
                </CardHeader>
                <CardContent>
                <div className="rounded-md border">
                  <div className="grid grid-cols-6 border-b bg-neutral-50 p-2 text-sm font-medium dark:border-neutral-800 dark:bg-neutral-900">
                    <div>Date</div>
                    <div>Evidence</div>
                    <div className="text-right">Actual (%)</div>
                    <div className="text-right">QC Status</div>
                    <div>Notes</div>
                    <div className="text-right">Action</div>
                  </div>
                  {recent.map((r) => (
                    <div key={r.id} className="grid grid-cols-6 items-center border-b p-2 text-sm last:border-b-0 dark:border-neutral-800">
                      <div>
                        {new Date(r.date).toLocaleDateString("id-ID")}
                        {r.wbsName && <div className="text-xs text-blue-600 font-medium truncate">{r.wbsName}</div>}
                      </div>
                      <div>
                        {r.photoUrl ? (
                          <div className="flex flex-col gap-1 items-start">
                            <img src={r.photoUrl} alt="Evidence" className="h-8 w-12 object-cover rounded cursor-pointer border" onClick={() => window.open(r.photoUrl, '_blank')} />
                            {r.gpsCoords && (
                              <span className="text-xs text-green-600">
                                {r.gpsCoords.latitude.toFixed(3)}, {r.gpsCoords.longitude.toFixed(3)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">No Photo</span>
                        )}
                      </div>
                      <div className="text-right font-mono">{(r.actualProgress ?? 0).toFixed(1)}%</div>
                      <div className="text-right">
                        {r.qc_status === 'approved' && <Badge className="bg-green-500 text-xs h-4">APPROVED</Badge>}
                        {r.qc_status === 'rejected' && <Badge className="bg-red-500 text-xs h-4">REJECTED</Badge>}
                        {(r.qc_status === 'pending' || !r.qc_status) && <Badge className="bg-amber-500 text-xs h-4">PENDING</Badge>}
                      </div>
                      <div className="truncate text-slate-400">{r.notes || "-"}</div>
                      <div className="text-right flex justify-end gap-1">
                        {(r.qc_status === 'pending' || !r.qc_status) && (
                          <RoleGuard allowedRoles={['QC_ENGINEER', 'PROJECT_MANAGER', 'ADMIN']}>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-green-600 border-green-200 hover:bg-green-50" onClick={() => handleApproveQC(r.id)}>✔</Button>
                            <Button size="sm" variant="outline" className="h-6 text-xs px-2 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleRejectQC(r.id)}>✖</Button>
                          </RoleGuard>
                        )}
                      </div>
                    </div>
                  ))}
                  {recent.length === 0 && (
                    <div className="p-3 text-sm text-neutral-500">Belum ada data progres.</div>
                  )}
                </div>
                </CardContent>
              </Card>
            </div>
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
