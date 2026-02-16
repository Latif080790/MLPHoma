/**
 * src/components/rab/ImportWizard.tsx
 *
 * Import wizard for AHSP CSV/XLSX with:
 * - header mapping UI
 * - preview
 * - mapping presets per project (saved to localStorage)
 *
 * Notes:
 * - Uses simple CSV parser (no external deps) to support CSV uploads in environments
 *   without XLSX. If xlsx is available it will parse XLSX as well.
 */

import React, { useEffect, useState } from 'react'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog'
import { useAHSPStore } from '../../store/ahspStore'
import notify from '../../lib/toast'

/**
 * Target fields for AHSP import mapping
 */
const TARGET_FIELDS = [
  { key: 'code', label: 'AHSP Code' },
  { key: 'name', label: 'AHSP Name' },
  { key: 'unit', label: 'Unit' },
  { key: 'basePrice', label: 'Base Price' },
  { key: 'category', label: 'Category' },
]

/**
 * LocalStorage key helper for mapping presets per project
 * @param projectId string
 */
function presetsKey(projectId: string) {
  return `importMappingPresets:${projectId}`
}

/**
 * Try load xlsx library (guarded)
 */
let XLSX: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  XLSX = require('xlsx')
} catch (e) {
  XLSX = null
}

/**
 * Simple CSV parser supporting quoted fields
 * @param text string
 */
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
      if (ch === '"' && line[i + 1] === '"') {
        curr += '"'
        i++
        continue
      }
      if (ch === '"') {
        inQuotes = !inQuotes
        continue
      }
      if (ch === ',' && !inQuotes) {
        values.push(curr)
        curr = ''
        continue
      }
      curr += ch
    }
    values.push(curr)
    rows.push(values)
  }
  return rows
}

/**
 * ImportWizard
 * @param props - optional projectId to scope presets (default 'default')
 */
export default function ImportWizard({ projectId = 'default' }: { projectId?: string }) {
  const importAHSPItems = useAHSPStore((s) => s.importAHSPItems)
  const [fileName, setFileName] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [previewCount] = useState(10)
  const [presets, setPresets] = useState<Record<string, Record<string, string>>>({})
  const [selectedPreset, setSelectedPreset] = useState<string>('')
  const [savePresetName, setSavePresetName] = useState('')
  const [pendingDeletePreset, setPendingDeletePreset] = useState<string | null>(null)

  // load presets on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(presetsKey(projectId))
      if (raw) {
        setPresets(JSON.parse(raw))
      } else {
        setPresets({})
      }
    } catch {
      setPresets({})
    }
  }, [projectId])

  function savePresets(next: Record<string, Record<string, string>>) {
    try {
      localStorage.setItem(presetsKey(projectId), JSON.stringify(next))
      setPresets(next)
    } catch (e) {
      console.warn('Failed to save presets', e)
    }
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
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
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const json = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][]
          processParsedRows(json.map((r) => r.map((c) => (c == null ? '' : String(c)))))
        } catch (err) {
          console.error(err)
          notify.error('Failed to parse XLSX. Falling back to CSV requirement.')
        }
      } else {
        const text = String(result)
        const parsed = parseCSV(text)
        processParsedRows(parsed)
      }
    }

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.readAsArrayBuffer(file)
    } else {
      reader.readAsText(file)
    }
    e.currentTarget.value = ''
  }

  function processParsedRows(parsed: string[][]) {
    if (!parsed || parsed.length === 0) {
      notify.error('No data found in file')
      return
    }
    const hdr = parsed[0].map((h) => (h == null ? '' : String(h).trim()))
    setHeaders(hdr)
    setRows(parsed.slice(1))
    // try to auto-map
    const auto: Record<string, string> = {}
    TARGET_FIELDS.forEach((t) => {
      const idx = hdr.findIndex((h) => h.toLowerCase().includes(t.key.toLowerCase()))
      if (idx !== -1) auto[t.key] = hdr[idx]
    })
    setMapping(auto)
    notify.success('File parsed. Confirm mapping and import.')
  }

  function commitImport() {
    if (!rows || rows.length === 0) {
      notify.error('No rows to import')
      return
    }
    const mapped = rows.map((r) => {
      const obj: any = {}
      TARGET_FIELDS.forEach((t) => {
        const header = mapping[t.key]
        if (!header) return
        const idx = headers.indexOf(header)
        obj[t.key] = idx !== -1 ? (r[idx] ?? '') : ''
      })
      return obj
    })

    // validate & add
    const toAdd = mapped
      .filter((item) => item.code && item.name)
      .map((item) => ({
        code: String(item.code).trim(),
        name: String(item.name).trim(),
        unit: String(item.unit || '').trim() || 'unit',
        category: String(item.category || '').trim() || 'Imported',
        basePrice: Number(item.basePrice || 0),
        description: '',
        finalPrice: Number(item.basePrice || 0),
        isActive: true,
      }))

    if (toAdd.length === 0) {
      notify.error('No valid AHSP items found (missing code/name)')
      return
    }

    importAHSPItems(toAdd as any)
    notify.success(`Imported ${toAdd.length} AHSP items`)
    // clear preview
    setFileName(null)
    setHeaders([])
    setRows([])
    setMapping({})
  }

  function handleSavePreset() {
    if (!savePresetName.trim()) {
      notify.error('Preset name required')
      return
    }
    const next = { ...presets, [savePresetName]: mapping }
    savePresets(next)
    setSavePresetName('')
    notify.success('Mapping preset saved')
  }

  function handleSelectPreset(name?: string) {
    if (!name) {
      setSelectedPreset('')
      setMapping({})
      return
    }
    setSelectedPreset(name)
    setMapping(presets[name] || {})
    notify.info(`Preset '${name}' loaded`)
  }

  function handleDeletePreset(name: string) {
    setPendingDeletePreset(name)
  }

  function handleDeletePresetConfirm() {
    if (!pendingDeletePreset) return
    const next = { ...presets }
    delete next[pendingDeletePreset]
    savePresets(next)
    if (selectedPreset === pendingDeletePreset) {
      setSelectedPreset('')
      setMapping({})
    }
    notify.success('Preset deleted')
    setPendingDeletePreset(null)
  }

  return (
    <div className="rounded-md border p-4 shadow-sm bg-white">
      <h3 className="text-sm font-semibold mb-2">Import AHSP (CSV / XLSX)</h3>

      <div className="flex gap-2 items-center mb-3">
        <label className="cursor-pointer">
          <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
          <Button variant="outline" className="bg-transparent">Upload file</Button>
        </label>
        <div className="text-sm text-neutral-500">{fileName || 'No file selected'}</div>
      </div>

      <div className="mb-3">
        <div className="text-xs text-neutral-500 mb-2">Mapping presets (project)</div>
        <div className="flex gap-2 items-center">
          <select
            value={selectedPreset}
            onChange={(e) => handleSelectPreset(e.target.value || undefined)}
            className="border px-2 py-1 text-sm"
          >
            <option value="">-- choose preset --</option>
            {Object.keys(presets).map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <Input placeholder="preset name" value={savePresetName} onChange={(e) => setSavePresetName(e.target.value)} />
          <Button size="sm" onClick={handleSavePreset}>Save preset</Button>
          {selectedPreset && <Button variant="outline" className="bg-transparent" size="sm" onClick={() => handleDeletePreset(selectedPreset)}>Delete</Button>}
        </div>
      </div>

      {headers.length > 0 && (
        <div>
          <div className="text-xs text-neutral-500 mb-2">Map columns</div>
          <div className="grid grid-cols-1 gap-2">
            {TARGET_FIELDS.map((t) => (
              <div key={t.key} className="flex items-center gap-2">
                <div className="w-28 text-sm text-neutral-700">{t.label}</div>
                <select
                  value={mapping[t.key] || ''}
                  onChange={(e) => setMapping({ ...mapping, [t.key]: e.target.value })}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                >
                  <option value="">-- unmapped --</option>
                  {headers.map((h) => (
                    <option key={h} value={h}>{h}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="mt-3">
            <div className="text-xs text-neutral-500 mb-2">Preview (first {previewCount} rows)</div>
            <div className="overflow-x-auto border rounded">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    {headers.map((h) => (
                      <th key={h} className="px-2 py-1">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, previewCount).map((row, i) => (
                    <tr key={i} className="border-t">
                      {row.map((c, j) => (
                        <td key={j} className="px-2 py-1">{c}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex gap-2 mt-3">
              <Button onClick={() => commitImport()}>Import</Button>
              <Button variant="outline" className="bg-transparent" onClick={() => { setRows([]); setHeaders([]); setMapping({}); setFileName(null) }}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={!!pendingDeletePreset} onOpenChange={(open) => { if (!open) setPendingDeletePreset(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete mapping preset?</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDeletePreset ? `Preset '${pendingDeletePreset}' will be removed.` : 'This action cannot be undone.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePresetConfirm}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}