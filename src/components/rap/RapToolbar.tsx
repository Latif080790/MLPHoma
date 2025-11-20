/**
 * RapToolbar.tsx
 * Top toolbar for RAP page: generator (months + total), presets, normalize, smooth, baseline lock, export/import.
 */

import React, { useRef } from 'react'
import { Wand2, RefreshCw, Lock, Download, Upload, Beaker } from 'lucide-react'
import { Card, CardContent } from '../ui/card'

/** Preset type identifier */
export type PresetKind = 'linear' | 'front' | 'back' | 'bell'

/** Props for RapToolbar */
export interface RapToolbarProps {
  months: number
  setMonths: (n: number) => void
  targetTotal: number
  setTargetTotal: (v: number) => void
  onGenerate: () => void
  onGenerateFromSchedule?: () => void
  onPreset: (kind: PresetKind) => void
  onNormalize: () => void
  onSmooth: () => void
  onLockBaseline: () => void
  onExport: () => void
  onImport: (file: File) => void
  disabled?: boolean
}

/** RapToolbar component: compact actionable controls */
export const RapToolbar: React.FC<RapToolbarProps> = ({
  months,
  setMonths,
  targetTotal,
  setTargetTotal,
  onGenerate,
  onGenerateFromSchedule,
  onPreset,
  onNormalize,
  onSmooth,
  onLockBaseline,
  onExport,
  onImport,
  disabled,
}) => {
  const fileRef = useRef<HTMLInputElement | null>(null)

  return (
    <Card className="mb-4">
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-end md:justify-between">
        {/* Left: Generator inputs */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <div className="text-xs text-neutral-500">Months</div>
            <input
              type="number"
              min={1}
              max={36}
              step={1}
              value={months}
              onChange={(e) => setMonths(Math.min(36, Math.max(1, Number(e.target.value) || 1)))}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700"
            />
          </div>
          <div className="sm:col-span-2">
            <div className="text-xs text-neutral-500">Target Total (Rp)</div>
            <input
              type="number"
              min={0}
              step={1000000}
              value={targetTotal}
              onChange={(e) => setTargetTotal(Math.max(0, Number(e.target.value) || 0))}
              className="mt-1 w-full rounded-md border bg-transparent px-3 py-1.5 text-sm dark:border-neutral-700"
            />
          </div>
          <div className="sm:col-span-3 flex gap-2">
            <button
              onClick={onGenerate}
              disabled={disabled}
              className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
              title="Generate RAP berdasarkan preset yang dipilih"
            >
              <Wand2 size={16} /> Generate
            </button>
            {onGenerateFromSchedule && (
              <button
                onClick={onGenerateFromSchedule}
                disabled={disabled}
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-60 dark:border-neutral-700 dark:hover:bg-neutral-800"
                title="Generate RAP berdasarkan jadwal Timeline dan biaya RAB"
              >
                <Wand2 size={16} /> From Schedule
              </button>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Presets */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-neutral-500">Preset:</span>
            <button
              onClick={() => onPreset('linear')}
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              title="Linear (rata)"
            >
              Linear
            </button>
            <button
              onClick={() => onPreset('front')}
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              title="Front-loaded (awal besar)"
            >
              Front
            </button>
            <button
              onClick={() => onPreset('back')}
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              title="Back-loaded (akhir besar)"
            >
              Back
            </button>
            <button
              onClick={() => onPreset('bell')}
              className="rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              title="Bell-shaped (lonceng)"
            >
              Bell
            </button>
          </div>

          {/* Normalize & Smooth */}
          <button
            onClick={onNormalize}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            title="Normalisasi total ke Target Total"
          >
            <RefreshCw size={14} /> Normalize
          </button>
          <button
            onClick={onSmooth}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            title="Haluskan kurva (moving average)"
          >
            <Beaker size={14} /> Smooth
          </button>

          {/* Baseline */}
          <button
            onClick={onLockBaseline}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            title="Kunci sebagai Baseline"
          >
            <Lock size={14} /> Lock Baseline
          </button>

          {/* Export & Import */}
          <button
            onClick={onExport}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            title="Export Excel"
          >
            <Download size={14} /> Excel
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            title="Import dari Excel (kolom: Period, Planned)"
          >
            <Upload size={14} /> Import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (f) onImport(f)
              e.currentTarget.value = ''
            }}
          />
        </div>
      </CardContent>
    </Card>
  )
}