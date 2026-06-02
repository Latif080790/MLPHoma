/**
 * WBSDetailPanel.tsx
 * Right-hand inspector for the selected WBS node — progress, QC status,
 * linked RAB budget (IDR gold), timeline links, and edit/delete actions.
 */

import { GitBranch, Edit2, Trash2, Clock, Lock, CheckCircle2, AlertCircle, XCircle, ListTree, X } from 'lucide-react'
import { formatIDR } from '../../lib/utils'
import type { WBSItem } from '../../types/wbs'

export interface WBSDetailPanelProps {
  /** Selected item, or null for empty state */
  item: WBSItem | null
  /** Sum of linked RAB item totals for this node (Rupiah) */
  budgetLinked?: number
  /** Number of timeline tasks linked to this node */
  timelineTaskCount?: number
  /** Edit handler */
  onEdit: (item: WBSItem) => void
  /** Delete handler */
  onDelete: (item: WBSItem) => void
  /** Optional close handler (mobile drawer dismiss) */
  onClose?: () => void
}

/** Small label/value row */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</div>
      <div className="text-sm text-slate-700 dark:text-slate-200">{children}</div>
    </div>
  )
}

/** Status pill */
function Pill({
  tone,
  icon,
  children,
}: {
  tone: 'jade' | 'amber' | 'coral' | 'cobalt' | 'teal' | 'neutral'
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const tones: Record<string, string> = {
    jade: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    coral: 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300',
    cobalt: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    teal: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    neutral: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>
      {icon}
      {children}
    </span>
  )
}

/** Map qc_status → pill tone + icon + label */
function qcPill(status: WBSItem['qc_status']) {
  switch (status) {
    case 'PASSED':
      return <Pill tone="jade" icon={<CheckCircle2 size={11} />}>QC Passed</Pill>
    case 'PENDING':
      return <Pill tone="amber" icon={<AlertCircle size={11} />}>QC Pending</Pill>
    case 'FAILED':
      return <Pill tone="coral" icon={<XCircle size={11} />}>QC Failed</Pill>
    default:
      return <Pill tone="neutral">QC Tidak Wajib</Pill>
  }
}

export function WBSDetailPanel({
  item,
  budgetLinked = 0,
  timelineTaskCount = 0,
  onEdit,
  onDelete,
  onClose,
}: WBSDetailPanelProps) {
  // ── Empty state ──────────────────────────────────────────────
  if (!item) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-500 dark:bg-blue-900/20 dark:text-blue-400">
          <ListTree size={22} />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Pilih item WBS</p>
          <p className="mt-0.5 text-xs text-slate-400">Klik salah satu item pada struktur untuk melihat detail.</p>
        </div>
      </div>
    )
  }

  const progress = item.progress ?? 0
  const isComplete = progress >= 100
  const progressTone = isComplete ? 'bg-emerald-500' : 'bg-blue-500'

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-start gap-2 border-b border-slate-100 px-4 py-3 dark:border-slate-800">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-1.5 py-0.5 font-mono text-xs font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
              <GitBranch size={10} />
              {item.code || '—'}
            </span>
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Level {item.level ?? 1}
            </span>
          </div>
          <h3 className="font-display truncate text-base font-bold leading-tight tracking-tight text-slate-800 dark:text-slate-100">
            {item.name}
          </h3>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 lg:hidden"
            aria-label="Tutup detail"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {/* Status pills */}
        <div className="flex flex-wrap gap-1.5">
          {isComplete ? (
            <Pill tone="jade" icon={<CheckCircle2 size={11} />}>Selesai</Pill>
          ) : progress > 0 ? (
            <Pill tone="cobalt">Berjalan</Pill>
          ) : (
            <Pill tone="neutral">Belum Mulai</Pill>
          )}
          {item.physicalProgressLocked ? (
            <Pill tone="amber" icon={<Lock size={11} />}>Locked</Pill>
          ) : item.progressSource === 'timeline' ? (
            <Pill tone="teal" icon={<Clock size={11} />}>Auto</Pill>
          ) : (
            <Pill tone="neutral">Manual</Pill>
          )}
        </div>

        {/* Progress bar */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Progress Fisik</span>
            <span className={`font-mono text-sm font-bold ${isComplete ? 'text-emerald-600 dark:text-emerald-400' : 'text-blue-600 dark:text-blue-400'}`}>
              {progress}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${progressTone}`}
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        </div>

        <hr className="border-slate-100 dark:border-slate-800" />

        {/* Fields */}
        <Field label="Progress Source">
          {item.physicalProgressLocked ? (
            <span className="text-amber-600 dark:text-amber-400">Dikunci — input manual</span>
          ) : item.progressSource === 'timeline' ? (
            <span className="text-teal-600 dark:text-teal-400">Otomatis dari Timeline</span>
          ) : (
            <span>Manual</span>
          )}
        </Field>

        <Field label="Status QC">{qcPill(item.qc_status)}</Field>

        <Field label="Budget RAB Terhubung">
          {budgetLinked > 0 ? (
            <span className="idr-value text-base font-bold">
              {formatIDR(budgetLinked)}
            </span>
          ) : (
            <span className="text-slate-400">Belum ada RAB terhubung</span>
          )}
        </Field>

        <Field label="Timeline Tasks">
          {timelineTaskCount > 0 ? (
            <span className="text-blue-600 dark:text-blue-400">{timelineTaskCount} task terhubung</span>
          ) : (
            <span className="text-slate-400">Tidak ada</span>
          )}
        </Field>

        {item.description && <Field label="Deskripsi"><span className="text-slate-500 dark:text-slate-400">{item.description}</span></Field>}
      </div>

      {/* Footer actions */}
      <div className="flex gap-2 border-t border-slate-100 px-4 py-3 dark:border-slate-800">
        <button
          onClick={() => onEdit(item)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Edit2 size={13} />
          Edit
        </button>
        <button
          onClick={() => onDelete(item)}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-900/20"
        >
          <Trash2 size={13} />
          Hapus
        </button>
      </div>
    </div>
  )
}

export default WBSDetailPanel
