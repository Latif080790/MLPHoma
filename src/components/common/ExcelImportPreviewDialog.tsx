/**
 * ExcelImportPreviewDialog.tsx
 *
 * v4 Sprint 3 — Item 20: Generic Excel import preview dialog.
 * 4-step wizard: Upload → Map Columns → Preview & Resolve Conflicts → Confirm Import.
 *
 * Usage:
 *   <ExcelImportPreviewDialog
 *     open={open}
 *     onOpenChange={setOpen}
 *     targetFields={[{ key: 'name', label: 'Nama', required: true }, ...]}
 *     onImport={(rows) => { ... }}
 *     title="Import PO dari Excel"
 *   />
 */

import React, { useCallback, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileUp, ArrowRight, AlertTriangle, CheckCircle2, ChevronLeft } from 'lucide-react'
import { toast } from 'sonner'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ImportField {
  key: string
  label: string
  required?: boolean
  /** Optional transform applied to raw cell string before export */
  transform?: (raw: string) => unknown
}

export type MappedRow = Record<string, unknown>

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
  /** Column definitions the caller expects */
  targetFields: ImportField[]
  /** Called once user confirms import — receives mapped rows */
  onImport: (rows: MappedRow[]) => void | Promise<void>
  title?: string
  description?: string
  maxPreviewRows?: number
}

// ---------------------------------------------------------------------------
// CSV parser (handles quoted fields, ; and , delimiters)
// ---------------------------------------------------------------------------

function parseCSV(text: string): string[][] {
  const lines = text.split(/\r?\n/)
  const out: string[][] = []
  for (const line of lines) {
    if (!line.trim()) continue
    const values: string[] = []
    let cur = ''
    let inQ = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue }
      if (ch === '"') { inQ = !inQ; continue }
      if ((ch === ',' || ch === ';') && !inQ) { values.push(cur); cur = ''; continue }
      cur += ch
    }
    values.push(cur)
    out.push(values)
  }
  return out
}

// ---------------------------------------------------------------------------
// XLSX loader (optional dep, loaded lazily)
// ---------------------------------------------------------------------------

type XLSXLib = {
  read: (data: unknown, opts?: unknown) => { Sheets: Record<string, unknown>; SheetNames: string[] }
  utils: { sheet_to_json: (sheet: unknown, opts?: unknown) => unknown[][] }
}
let XLSX: XLSXLib | null = null
// Dynamic import for optional xlsx dependency
void import('xlsx').then(m => { XLSX = (m.default || m) as unknown as XLSXLib }).catch(() => { XLSX = null })

// ---------------------------------------------------------------------------
// Step indicator
// ---------------------------------------------------------------------------

const STEPS = ['Upload', 'Mapping', 'Preview', 'Konfirmasi'] as const
type Step = 0 | 1 | 2 | 3

function StepBar({ step }: { step: Step }) {
  return (
    <div className="flex items-center gap-1 mb-4">
      {STEPS.map((label, i) => (
        <React.Fragment key={label}>
          {i > 0 && <ArrowRight size={12} className="text-muted-foreground" />}
          <span
            className={[
              'px-2 py-1 rounded-full text-xs font-medium',
              step === i
                ? 'bg-orange-500 text-white'
                : step > i
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                  : 'bg-muted/50 text-muted-foreground',
            ].join(' ')}
          >
            {i + 1}. {label}
          </span>
        </React.Fragment>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ExcelImportPreviewDialog({
  open,
  onOpenChange,
  targetFields,
  onImport,
  title = 'Import dari Excel/CSV',
  description = 'Upload file CSV atau XLSX, mapping kolom, lalu konfirmasi import.',
  maxPreviewRows = 10,
}: Props) {
  const [step, setStep] = useState<Step>(0)
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rawRows, setRawRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [previewRows, setPreviewRows] = useState<MappedRow[]>([])
  const [conflicts, setConflicts] = useState<number[]>([])
  const [importing, setImporting] = useState(false)

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStep(0)
    setFileName(null)
    setHeaders([])
    setRawRows([])
    setMapping({})
    setPreviewRows([])
    setConflicts([])
    setImporting(false)
  }, [])

  // ── Step 0 → Step 1: File upload ──────────────────────────────────────────
  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const result = ev.target?.result
      if (!result) return
      if ((file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) && XLSX) {
        try {
          const wb = XLSX.read(new Uint8Array(result as ArrayBuffer), { type: 'array' })
          const sheet = wb.Sheets[wb.SheetNames[0]]
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][]
          processRows(json.map(r => (r as unknown[]).map(c => c == null ? '' : String(c))))
        } catch {
          toast.error('Gagal membaca file XLSX')
        }
      } else {
        processRows(parseCSV(String(result)))
      }
    }
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
    e.currentTarget.value = ''
  }

  function processRows(parsed: string[][]) {
    if (parsed.length < 2) { toast.error('File harus memiliki minimal 2 baris (header + data)'); return }
    const hdrs = parsed[0].map(h => String(h).trim())
    setHeaders(hdrs)
    setRawRows(parsed.slice(1))
    // Auto-map: try to find matching header for each target field
    const auto: Record<string, string> = {}
    targetFields.forEach(tf => {
      const idx = hdrs.findIndex(h => h.toLowerCase().includes(tf.key.toLowerCase()) || h.toLowerCase().includes(tf.label.toLowerCase()))
      if (idx !== -1) auto[tf.key] = hdrs[idx]
    })
    setMapping(auto)
    setStep(1)
    toast.success(`${parsed.length - 1} baris terdeteksi. Konfirmasi mapping kolom.`)
  }

  // ── Step 1 → Step 2: Apply mapping + detect conflicts ─────────────────────
  function applyMapping() {
    const missingRequired = targetFields.filter(f => f.required && !mapping[f.key])
    if (missingRequired.length > 0) {
      toast.error(`Kolom wajib belum di-mapping: ${missingRequired.map(f => f.label).join(', ')}`)
      return
    }
    const mapped: MappedRow[] = rawRows.map(row => {
      const obj: MappedRow = {}
      targetFields.forEach(tf => {
        const header = mapping[tf.key]
        const idx = header ? headers.indexOf(header) : -1
        const raw = idx !== -1 ? (row[idx] ?? '') : ''
        obj[tf.key] = tf.transform ? tf.transform(raw) : raw
      })
      return obj
    }).filter(row => {
      // Must have at least one required field with a value
      const req = targetFields.filter(f => f.required)
      return req.length === 0 || req.some(f => String(row[f.key] ?? '').trim())
    })

    // Detect "conflicts" — rows that have missing required data
    const conflictIdxs: number[] = []
    mapped.forEach((row, i) => {
      const incomplete = targetFields.filter(f => f.required && !String(row[f.key] ?? '').trim())
      if (incomplete.length > 0) conflictIdxs.push(i)
    })

    setPreviewRows(mapped)
    setConflicts(conflictIdxs)
    setStep(2)
  }

  // ── Step 2 → Step 3: Confirm ───────────────────────────────────────────────
  function goToConfirm() {
    setStep(3)
  }

  // ── Step 3: Commit import ──────────────────────────────────────────────────
  async function commitImport() {
    setImporting(true)
    try {
      // Exclude conflict rows from import
      const clean = previewRows.filter((_, i) => !conflicts.includes(i))
      await onImport(clean)
      toast.success(`Berhasil import ${clean.length} baris${conflicts.length > 0 ? ` (${conflicts.length} baris dilewati — data tidak lengkap)` : ''}`)
      reset()
      onOpenChange(false)
    } catch (err) {
      toast.error('Import gagal: ' + String(err))
    } finally {
      setImporting(false)
    }
  }

  const cleanCount = previewRows.length - conflicts.length

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) reset(); onOpenChange(v) }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileUp size={18} />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <StepBar step={step} />

        {/* ── Step 0: Upload ─────────────────────────────────────────────── */}
        {step === 0 && (
          <label className="flex flex-col items-center justify-center py-14 border-2 border-dashed rounded-xl border-border cursor-pointer hover:border-orange-400 transition-colors gap-3">
            <FileUp size={36} className="text-muted-foreground" />
            <div className="text-center">
              <p className="text-sm font-medium text-muted-foreground">
                Klik untuk pilih file
              </p>
              <p className="text-xs text-muted-foreground mt-1">CSV atau XLSX (Excel)</p>
            </div>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="sr-only" />
          </label>
        )}

        {/* ── Step 1: Column Mapping ─────────────────────────────────────── */}
        {step === 1 && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              File: <span className="font-medium text-muted-foreground">{fileName}</span> — {rawRows.length} baris data
            </p>
            <div className="space-y-3">
              {targetFields.map(tf => (
                <div key={tf.key} className="flex items-center gap-3">
                  <label className="w-40 text-xs font-medium text-muted-foreground shrink-0">
                    {tf.label}
                    {tf.required && <span className="text-red-500 ml-0.5">*</span>}
                  </label>
                  <select
                    value={mapping[tf.key] ?? ''}
                    onChange={e => setMapping(prev => ({ ...prev, [tf.key]: e.target.value }))}
                    className="flex-1 text-xs rounded-md border border-border bg-card px-2 py-1.5 text-foreground"
                  >
                    <option value="">— Tidak dimap —</option>
                    {headers.map(h => (
                      <option key={h} value={h}>{h}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setStep(0)}>
                <ChevronLeft size={14} className="mr-1" /> Kembali
              </Button>
              <Button size="sm" onClick={applyMapping}>
                Terapkan Mapping <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 2: Preview & Conflicts ─────────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-xs">
              <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0">
                <CheckCircle2 size={12} className="mr-1" />
                {cleanCount} siap diimport
              </Badge>
              {conflicts.length > 0 && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-0">
                  <AlertTriangle size={12} className="mr-1" />
                  {conflicts.length} konflik (data tidak lengkap)
                </Badge>
              )}
            </div>
            <ScrollArea className="h-72 border rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-1.5 text-muted-foreground w-8">#</th>
                    <th className="text-left px-2 py-1.5 text-muted-foreground w-8">Status</th>
                    {targetFields.map(tf => (
                      <th key={tf.key} className="text-left px-2 py-1.5 text-muted-foreground whitespace-nowrap">{tf.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {previewRows.slice(0, maxPreviewRows).map((row, i) => {
                    const isConflict = conflicts.includes(i)
                    return (
                      <tr key={i} className={[
                        'border-t border-border',
                        isConflict ? 'bg-amber-50 dark:bg-amber-900/10' : '',
                      ].join(' ')}>
                        <td className="px-2 py-1 text-muted-foreground">{i + 1}</td>
                        <td className="px-2 py-1">
                          {isConflict
                            ? <AlertTriangle size={12} className="text-amber-500" />
                            : <CheckCircle2 size={12} className="text-green-500" />}
                        </td>
                        {targetFields.map(tf => (
                          <td key={tf.key} className="px-2 py-1 text-muted-foreground max-w-[160px] truncate">
                            {String(row[tf.key] ?? '')}
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {previewRows.length > maxPreviewRows && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  ... dan {previewRows.length - maxPreviewRows} baris lainnya
                </p>
              )}
            </ScrollArea>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setStep(1)}>
                <ChevronLeft size={14} className="mr-1" /> Kembali
              </Button>
              <Button size="sm" onClick={goToConfirm} disabled={cleanCount === 0}>
                Lanjut ke Konfirmasi <ArrowRight size={14} className="ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ── Step 3: Confirmation ────────────────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 p-4">
              <div className="flex items-center gap-3 mb-2">
                <CheckCircle2 size={20} className="text-green-600" />
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  Siap import {cleanCount} baris
                </p>
              </div>
              {conflicts.length > 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <AlertTriangle size={12} className="inline mr-1" />
                  {conflicts.length} baris dilewati karena data tidak lengkap (field wajib kosong).
                </p>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" className="bg-transparent" onClick={() => setStep(2)}>
                <ChevronLeft size={14} className="mr-1" /> Kembali
              </Button>
              <Button onClick={commitImport} disabled={importing || cleanCount === 0}>
                {importing ? 'Mengimport...' : `Konfirmasi Import (${cleanCount} baris)`}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export default ExcelImportPreviewDialog
