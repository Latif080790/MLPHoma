/**
 * src/components/rab/BoQImportDialog.tsx
 *
 * BoQ Import Wizard for RAB items with:
 * - CSV/XLSX file upload
 * - Column mapping (item code, name, unit, volume, unit_price, category)
 * - Overhead vs Direct Cost classification toggle (per-row or bulk)
 * - Preview table with is_overhead badges
 * - Batch import to rabStore
 */

import React, { useState, useCallback } from 'react'
import { Button } from '../ui/button'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '../ui/dialog'
import { useRabStore } from '../../store/rabStore'
import notify from '../../lib/toast'
import { FileUp, CheckCircle2, AlertTriangle, ArrowRight, ToggleLeft, ToggleRight } from 'lucide-react'

/* ── Target Fields ── */
const TARGET_FIELDS = [
    { key: 'item_code', label: 'Kode Item', required: false },
    { key: 'item_name', label: 'Nama Pekerjaan', required: true },
    { key: 'unit', label: 'Satuan', required: false },
    { key: 'volume', label: 'Volume', required: false },
    { key: 'unit_price', label: 'Harga Satuan', required: false },
    { key: 'category', label: 'Kategori', required: false },
]

/* ── Simple CSV Parser ── */
function parseCSV(text: string): string[][] {
    const lines = text.split(/\r\n|\n/)
    const rows: string[][] = []
    for (const line of lines) {
        if (line.trim() === '') continue
        const values: string[] = []
        let curr = ''
        let inQuotes = false
        for (let i = 0; i < line.length; i++) {
            const ch = line[i]
            if (ch === '"' && line[i + 1] === '"') { curr += '"'; i++; continue }
            if (ch === '"') { inQuotes = !inQuotes; continue }
            if ((ch === ',' || ch === ';') && !inQuotes) { values.push(curr); curr = ''; continue }
            curr += ch
        }
        values.push(curr)
        rows.push(values)
    }
    return rows
}

/* ── XLSX loader (guarded) ── */
let XLSX: any = null
try { 
  // Dynamic import for optional xlsx dependency - will be loaded when needed
  void import('xlsx').then(m => { XLSX = m.default || m }).catch(() => { XLSX = null })
} catch { 
  XLSX = null 
}

/* ── Types ── */
interface ParsedRow {
    raw: string[]
    mapped: Record<string, string>
    is_overhead: boolean
}

/* ── Props ── */
interface BoQImportDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: string
}

export default function BoQImportDialog({ open, onOpenChange, projectId }: BoQImportDialogProps) {
    const addItem = useRabStore((s: any) => s.addItem)

    // Wizard steps
    const [step, setStep] = useState<'upload' | 'map' | 'classify' | 'preview'>('upload')
    const [fileName, setFileName] = useState<string | null>(null)
    const [headers, setHeaders] = useState<string[]>([])
    const [rawRows, setRawRows] = useState<string[][]>([])
    const [mapping, setMapping] = useState<Record<string, string>>({})
    const [parsedRows, setParsedRows] = useState<ParsedRow[]>([])
    const [bulkOverhead, setBulkOverhead] = useState(false)
    const [importing, setImporting] = useState(false)

    /* ── Reset ── */
    const reset = useCallback(() => {
        setStep('upload')
        setFileName(null)
        setHeaders([])
        setRawRows([])
        setMapping({})
        setParsedRows([])
        setBulkOverhead(false)
        setImporting(false)
    }, [])

    /* ── File Upload ── */
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
                    const data = new Uint8Array(result as ArrayBuffer)
                    const workbook = XLSX.read(data, { type: 'array' })
                    const sheet = workbook.Sheets[workbook.SheetNames[0]]
                    const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
                    processRows(json.map(r => r.map((c: any) => c == null ? '' : String(c))))
                } catch {
                    notify.error('Gagal membaca file XLSX')
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
        if (!parsed || parsed.length < 2) {
            notify.error('File harus memiliki minimal header + 1 baris data')
            return
        }
        const hdr = parsed[0].map(h => String(h).trim())
        setHeaders(hdr)
        setRawRows(parsed.slice(1))
        // Auto-map
        const auto: Record<string, string> = {}
        TARGET_FIELDS.forEach(t => {
            const idx = hdr.findIndex(h => {
                const lower = h.toLowerCase()
                if (t.key === 'item_code') return lower.includes('kode') || lower.includes('code') || lower === 'no'
                if (t.key === 'item_name') return lower.includes('uraian') || lower.includes('nama') || lower.includes('name') || lower.includes('pekerjaan') || lower.includes('description')
                if (t.key === 'unit') return lower.includes('satuan') || lower.includes('unit') || lower === 'sat'
                if (t.key === 'volume') return lower.includes('volume') || lower.includes('qty') || lower.includes('jumlah') || lower.includes('quantity')
                if (t.key === 'unit_price') return lower.includes('harga') || lower.includes('price') || lower.includes('unit_price') || lower.includes('tarif')
                if (t.key === 'category') return lower.includes('kategori') || lower.includes('category') || lower.includes('group') || lower.includes('kelompok')
                return false
            })
            if (idx !== -1) auto[t.key] = hdr[idx]
        })
        setMapping(auto)
        setStep('map')
        notify.success(`${parsed.length - 1} baris terdeteksi. Konfirmasi mapping kolom.`)
    }

    /* ── Apply Mapping → Build Parsed Rows ── */
    function applyMapping() {
        if (!mapping.item_name) {
            notify.error('Kolom "Nama Pekerjaan" wajib di-mapping!')
            return
        }
        const mapped = rawRows.map(raw => {
            const obj: Record<string, string> = {}
            TARGET_FIELDS.forEach(t => {
                const header = mapping[t.key]
                if (!header) return
                const idx = headers.indexOf(header)
                obj[t.key] = idx !== -1 ? (raw[idx] ?? '') : ''
            })
            return { raw, mapped: obj, is_overhead: bulkOverhead }
        }).filter(r => r.mapped.item_name?.trim())

        setParsedRows(mapped)
        setStep('classify')
        notify.success(`${mapped.length} item valid. Klasifikasi overhead/biaya langsung.`)
    }

    /* ── Toggle single row overhead ── */
    function toggleRowOverhead(idx: number) {
        setParsedRows(prev => prev.map((r, i) => i === idx ? { ...r, is_overhead: !r.is_overhead } : r))
    }

    /* ── Toggle all overhead ── */
    function toggleAllOverhead() {
        setBulkOverhead(!bulkOverhead)
        setParsedRows(prev => prev.map(r => ({ ...r, is_overhead: !bulkOverhead })))
    }

    /* ── Commit Import ── */
    async function commitImport() {
        setImporting(true)
        try {
            let imported = 0
            for (const row of parsedRows) {
                const m = row.mapped
                addItem(projectId, {
                    item_code: m.item_code?.trim() || '',
                    item_name: m.item_name?.trim() || '',
                    name: m.item_name?.trim() || '',
                    unit: m.unit?.trim() || 'ls',
                    volume: Number(m.volume?.replace(/[^\d.,]/g, '').replace(',', '.') || 0),
                    unit_price: Number(m.unit_price?.replace(/[^\d.,]/g, '').replace(',', '.') || 0),
                    category: m.category?.trim() || (row.is_overhead ? 'Overhead' : 'Direct Cost'),
                    is_overhead: row.is_overhead,
                    boq_id: `boq-import-${Date.now()}-${imported}`,
                } as any)
                imported++
            }
            notify.success(`Berhasil import ${imported} item RAB (${parsedRows.filter(r => r.is_overhead).length} overhead, ${parsedRows.filter(r => !r.is_overhead).length} biaya langsung)`)
            reset()
            onOpenChange(false)
        } catch (err) {
            notify.error('Gagal import: ' + String(err))
        } finally {
            setImporting(false)
        }
    }

    const directCount = parsedRows.filter(r => !r.is_overhead).length
    const overheadCount = parsedRows.filter(r => r.is_overhead).length

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v) }}>
            <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileUp size={18} />
                        Import BoQ ke RAB
                    </DialogTitle>
                    <DialogDescription>
                        Upload file CSV/XLSX, mapping kolom, dan klasifikasi biaya langsung vs overhead.
                    </DialogDescription>
                </DialogHeader>

                {/* Step indicator */}
                <div className="flex items-center gap-1 text-xs mb-4">
                    {(['upload', 'map', 'classify', 'preview'] as const).map((s, i) => (
                        <React.Fragment key={s}>
                            {i > 0 && <ArrowRight size={12} className="text-neutral-400" />}
                            <span className={`px-2 py-1 rounded-full ${step === s ? 'bg-blue-600 text-white' : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'}`}>
                                {s === 'upload' ? '1. Upload' : s === 'map' ? '2. Mapping' : s === 'classify' ? '3. Klasifikasi' : '4. Import'}
                            </span>
                        </React.Fragment>
                    ))}
                </div>

                {/* STEP 1: Upload */}
                {step === 'upload' && (
                    <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg border-neutral-300 dark:border-neutral-700">
                        <FileUp size={48} className="text-neutral-400 mb-4" />
                        <p className="text-sm text-neutral-500 mb-4">Upload file BoQ (CSV atau XLSX)</p>
                        <label className="cursor-pointer">
                            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
                            <Button variant="outline" asChild><span>Pilih File</span></Button>
                        </label>
                        {fileName && <p className="text-xs text-neutral-500 mt-2">{fileName}</p>}
                    </div>
                )}

                {/* STEP 2: Column Mapping */}
                {step === 'map' && (
                    <div>
                        <div className="text-sm font-medium mb-3">Mapping Kolom</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            {TARGET_FIELDS.map(t => (
                                <div key={t.key} className="flex items-center gap-2">
                                    <div className="w-32 text-sm text-neutral-700 dark:text-neutral-300">
                                        {t.label}
                                        {t.required && <span className="text-red-500 ml-0.5">*</span>}
                                    </div>
                                    <select
                                        value={mapping[t.key] || ''}
                                        onChange={e => setMapping({ ...mapping, [t.key]: e.target.value })}
                                        className="flex-1 border rounded px-2 py-1.5 text-sm bg-white dark:bg-neutral-900 dark:border-neutral-700"
                                    >
                                        <option value="">-- pilih kolom --</option>
                                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                                    </select>
                                </div>
                            ))}
                        </div>

                        {/* Quick preview of first 3 rows */}
                        {rawRows.length > 0 && (
                            <div className="border rounded overflow-x-auto max-h-32 mb-4">
                                <table className="w-full text-xs">
                                    <thead><tr className="bg-neutral-50 dark:bg-neutral-800">
                                        {headers.map(h => <th key={h} className="px-2 py-1 text-left font-medium">{h}</th>)}
                                    </tr></thead>
                                    <tbody>
                                        {rawRows.slice(0, 3).map((row, i) => (
                                            <tr key={i} className="border-t">
                                                {row.map((c, j) => <td key={j} className="px-2 py-1">{c}</td>)}
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep('upload')}>Kembali</Button>
                            <Button onClick={applyMapping}>Lanjut ke Klasifikasi</Button>
                        </div>
                    </div>
                )}

                {/* STEP 3: Classify Overhead vs Direct */}
                {step === 'classify' && (
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="text-sm font-medium">Klasifikasi Biaya</div>
                            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={toggleAllOverhead}>
                                {bulkOverhead ? <ToggleRight size={14} className="text-amber-500" /> : <ToggleLeft size={14} />}
                                {bulkOverhead ? 'Semua Overhead' : 'Semua Biaya Langsung'}
                            </Button>
                        </div>

                        <div className="text-xs text-neutral-500 mb-2">
                            Klik toggle per baris untuk mengubah klasifikasi. Biaya <span className="text-blue-600 font-medium">Langsung</span> = pekerjaan utama, <span className="text-amber-600 font-medium">Overhead</span> = biaya umum/operasional.
                        </div>

                        <div className="border rounded overflow-x-auto max-h-80 mb-3">
                            <table className="w-full text-xs">
                                <thead><tr className="bg-neutral-50 dark:bg-neutral-800 sticky top-0">
                                    <th className="px-2 py-1.5 text-left font-medium w-10">#</th>
                                    <th className="px-2 py-1.5 text-left font-medium">Nama Pekerjaan</th>
                                    <th className="px-2 py-1.5 text-left font-medium w-16">Satuan</th>
                                    <th className="px-2 py-1.5 text-right font-medium w-20">Volume</th>
                                    <th className="px-2 py-1.5 text-right font-medium w-28">Harga Satuan</th>
                                    <th className="px-2 py-1.5 text-center font-medium w-28">Tipe Biaya</th>
                                </tr></thead>
                                <tbody>
                                    {parsedRows.map((row, i) => (
                                        <tr key={i} className={`border-t ${row.is_overhead ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                                            <td className="px-2 py-1 text-neutral-400">{i + 1}</td>
                                            <td className="px-2 py-1 font-medium">{row.mapped.item_name}</td>
                                            <td className="px-2 py-1">{row.mapped.unit || '-'}</td>
                                            <td className="px-2 py-1 text-right font-mono">{row.mapped.volume || '0'}</td>
                                            <td className="px-2 py-1 text-right font-mono">{row.mapped.unit_price ? Number(row.mapped.unit_price.replace(/[^\d.,]/g, '').replace(',', '.')).toLocaleString('id-ID') : '0'}</td>
                                            <td className="px-2 py-1 text-center">
                                                <button
                                                    onClick={() => toggleRowOverhead(i)}
                                                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${row.is_overhead
                                                        ? 'bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/40 dark:text-amber-400'
                                                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/40 dark:text-blue-400'
                                                        }`}
                                                >
                                                    {row.is_overhead ? 'Overhead' : 'Langsung'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Summary */}
                        <div className="flex items-center gap-4 text-xs mb-4 p-3 bg-neutral-50 dark:bg-neutral-800 rounded">
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                <span><strong>{directCount}</strong> Biaya Langsung</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-amber-500" />
                                <span><strong>{overheadCount}</strong> Overhead</span>
                            </div>
                            <div className="ml-auto text-neutral-500">
                                Total: <strong>{parsedRows.length}</strong> item
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep('map')}>Kembali</Button>
                            <Button onClick={() => setStep('preview')}>
                                <CheckCircle2 size={14} className="mr-1" />
                                Preview & Import
                            </Button>
                        </div>
                    </div>
                )}

                {/* STEP 4: Final Preview & Import */}
                {step === 'preview' && (
                    <div>
                        <div className="flex items-center gap-2 mb-3">
                            <CheckCircle2 size={16} className="text-green-600" />
                            <div className="text-sm font-medium">Siap Import</div>
                        </div>

                        <div className="grid grid-cols-3 gap-3 mb-4">
                            <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded">
                                <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{directCount}</div>
                                <div className="text-xs text-blue-600 dark:text-blue-400">Biaya Langsung</div>
                            </div>
                            <div className="text-center p-3 bg-amber-50 dark:bg-amber-900/20 rounded">
                                <div className="text-2xl font-bold text-amber-700 dark:text-amber-400">{overheadCount}</div>
                                <div className="text-xs text-amber-600 dark:text-amber-400">Overhead</div>
                            </div>
                            <div className="text-center p-3 bg-neutral-50 dark:bg-neutral-800 rounded">
                                <div className="text-2xl font-bold">{parsedRows.length}</div>
                                <div className="text-xs text-neutral-500">Total Item</div>
                            </div>
                        </div>

                        {parsedRows.some(r => !r.mapped.unit_price || r.mapped.unit_price === '0') && (
                            <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-800 dark:text-yellow-400 mb-4">
                                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                                <span>Beberapa item tidak memiliki harga satuan. Anda bisa mengisi harga nanti di tabel RAB.</span>
                            </div>
                        )}

                        <DialogFooter className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep('classify')}>Kembali</Button>
                            <Button disabled={importing} onClick={commitImport}>
                                {importing ? 'Importing...' : `Import ${parsedRows.length} Item`}
                            </Button>
                        </DialogFooter>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
