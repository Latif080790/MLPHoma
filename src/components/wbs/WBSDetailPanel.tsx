/**
 * WBSDetailPanel.tsx
 * Right-hand inspector for the selected WBS node — 4-tab layout:
 * Overview | RAB | Timeline | +Child
 */

import React, { useState, KeyboardEvent } from 'react'
import * as Tabs from '@radix-ui/react-tabs'
import {
  GitBranch,
  Edit2,
  Trash2,
  Clock,
  Lock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  ListTree,
  X,
  Plus,
  ReceiptText,
  CalendarDays,
  LayoutList,
} from 'lucide-react'
import { formatIDR } from '../../lib/utils'
import type { WBSItem } from '../../types/wbs'
import type { RABItem } from '../../types/rab'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface WBSDetailPanelProps {
  /** Selected item, or null for empty state */
  item: WBSItem | null
  /** Sum of linked RAB item totals for this node (Rupiah) */
  budgetLinked?: number
  /** Number of timeline tasks linked to this node */
  timelineTaskCount?: number
  /** RAB items to filter for this node */
  rabItems?: RABItem[]
  /** Timeline tasks to filter for this node */
  timelineTasks?: Array<{ id: string; name: string; wbsId?: string }>
  /** Edit handler */
  onEdit: (item: WBSItem) => void
  /** Delete handler */
  onDelete: (item: WBSItem) => void
  /** Add child handler */
  onAddChild?: (parentId: string) => void
  /** Optional close handler (mobile drawer dismiss) */
  onClose?: () => void
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the monetary total for a RABItem, checking all known field variants.
 */
function rabTotal(r: RABItem): number {
  if (typeof r.finalTotal === 'number' && r.finalTotal > 0) return r.finalTotal
  if (typeof r.final_total === 'number' && r.final_total > 0) return r.final_total
  if (typeof r.finalPrice === 'number' && r.finalPrice > 0) return r.finalPrice
  const vol = r.volume ?? 0
  const price = r.unit_price ?? r.unitPrice ?? 0
  return vol * price
}

/** Get display name from RABItem (name or item_name fallback) */
function rabName(r: RABItem): string {
  return r.name ?? r.item_name ?? '(tanpa nama)'
}

// ─── Sub-components ───────────────────────────────────────────────────────────

/** Small label/value row */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color: 'var(--text-secondary)' }}
      >
        {label}
      </div>
      <div className="text-sm" style={{ color: 'var(--text-primary)' }}>
        {children}
      </div>
    </div>
  )
}

/** Status pill */
function Pill({
  tone,
  icon,
  children,
}: {
  tone: 'jade' | 'amber' | 'coral' | 'cobalt' | 'cyan' | 'neutral'
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  const styles: Record<string, React.CSSProperties> = {
    jade: { background: 'color-mix(in srgb, var(--wbs-progress-high) 15%, transparent)', color: 'var(--wbs-progress-high)' },
    amber: { background: 'color-mix(in srgb, var(--wbs-progress-low) 15%, transparent)', color: 'var(--wbs-progress-low)' },
    coral: { background: 'var(--status-danger-bg)', color: 'var(--status-danger-fg)' },
    cobalt: { background: 'color-mix(in srgb, hsl(var(--cobalt-400)) 15%, transparent)', color: 'hsl(var(--cobalt-400))' },
    cyan: { background: 'color-mix(in srgb, var(--wbs-progress-mid) 15%, transparent)', color: 'var(--wbs-progress-mid)' },
    neutral: { background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)' },
  }
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
      style={styles[tone]}
    >
      {icon}
      {children}
    </span>
  )
}

/** QC status pill */
function QcPill({ status }: { status: WBSItem['qc_status'] }) {
  switch (status) {
    case 'PASSED':
      return (
        <Pill tone="jade" icon={<CheckCircle2 size={11} />}>
          QC Passed
        </Pill>
      )
    case 'PENDING':
      return (
        <Pill tone="amber" icon={<AlertCircle size={11} />}>
          QC Pending
        </Pill>
      )
    case 'FAILED':
      return (
        <Pill tone="coral" icon={<XCircle size={11} />}>
          QC Failed
        </Pill>
      )
    default:
      return <Pill tone="neutral">QC Tidak Wajib</Pill>
  }
}

// ─── Tab content components ───────────────────────────────────────────────────

function OverviewTab({ item, budgetLinked = 0, timelineTaskCount = 0, rabItems = [], timelineTasks = [] }: {
  item: WBSItem
  budgetLinked?: number
  timelineTaskCount?: number
  rabItems?: RABItem[]
  timelineTasks?: Array<{ id: string; name: string; wbsId?: string }>
}) {
  const progress = Math.min(100, Math.max(0, item.progress ?? 0))
  const isComplete = progress >= 100

  const progressColor = isComplete
    ? 'var(--wbs-progress-high)'
    : progress >= 50
    ? 'hsl(var(--cobalt-400))'
    : 'var(--wbs-progress-low)'

  const linkedRab = rabItems.filter((r) => r.wbsId === item.id)
  const linkedTimeline = timelineTasks.filter((t) => t.wbsId === item.id)
  const timelineDisplay = linkedTimeline.length > 0 ? linkedTimeline.length : timelineTaskCount

  return (
    <div className="space-y-4 p-4">
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
          <Pill tone="cyan" icon={<Clock size={11} />}>Auto</Pill>
        ) : (
          <Pill tone="neutral">Manual</Pill>
        )}
        <QcPill status={item.qc_status} />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <span
            className="text-xs font-bold uppercase tracking-wider"
            style={{ color: 'var(--text-secondary)' }}
          >
            Progress Fisik
          </span>
          <span
            className="font-mono text-sm font-bold"
            style={{ color: progressColor }}
          >
            {progress}%
          </span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--bg-surface-hover)' }}
        >
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress}%`, background: progressColor }}
          />
        </div>
      </div>

      <hr style={{ borderColor: 'var(--border-default)' }} />

      {/* Budget + inline RAB mini-list */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Budget RAB Terhubung
          {linkedRab.length > 0 && (
            <span className="ml-1 font-normal normal-case" style={{ color: 'var(--text-muted)' }}>
              ({linkedRab.length} item)
            </span>
          )}
        </div>
        {budgetLinked > 0 ? (
          <>
            <div className="text-base font-bold font-mono" style={{ color: 'var(--text-idr)' }}>
              {formatIDR(budgetLinked)}
            </div>
            {linkedRab.length > 0 && (
              <div className="space-y-1">
                {linkedRab.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
                    style={{ background: 'var(--bg-surface-hover)' }}
                  >
                    <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}
                      title={rabName(r)}>
                      {rabName(r)}
                    </span>
                    <span className="shrink-0 font-mono font-semibold" style={{ color: 'var(--text-idr)' }}>
                      {formatIDR(rabTotal(r))}
                    </span>
                  </div>
                ))}
                {linkedRab.length > 3 && (
                  <p className="pl-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    +{linkedRab.length - 3} item lainnya → tab RAB
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Belum ada RAB terhubung</span>
        )}
      </div>

      <hr style={{ borderColor: 'var(--border-default)' }} />

      {/* Timeline inline mini-list */}
      <div className="space-y-2">
        <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Timeline Tasks
          {timelineDisplay > 0 && (
            <span className="ml-1 font-normal normal-case" style={{ color: 'var(--text-muted)' }}>
              ({timelineDisplay})
            </span>
          )}
        </div>
        {timelineDisplay > 0 ? (
          <>
            {linkedTimeline.length > 0 ? (
              <div className="space-y-1">
                {linkedTimeline.slice(0, 3).map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center gap-2 rounded px-2 py-1 text-xs"
                    style={{ background: 'var(--bg-surface-hover)' }}
                  >
                    <CalendarDays size={10} style={{ color: 'hsl(var(--cobalt-400))', flexShrink: 0 }} />
                    <span className="min-w-0 flex-1 truncate" style={{ color: 'var(--text-secondary)' }}
                      title={t.name}>
                      {t.name}
                    </span>
                  </div>
                ))}
                {linkedTimeline.length > 3 && (
                  <p className="pl-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                    +{linkedTimeline.length - 3} task lainnya → tab Timeline
                  </p>
                )}
              </div>
            ) : (
              <span className="text-sm" style={{ color: 'hsl(var(--cobalt-400))' }}>
                {timelineDisplay} task terhubung
              </span>
            )}
          </>
        ) : (
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Tidak ada</span>
        )}
      </div>

      <hr style={{ borderColor: 'var(--border-default)' }} />

      {/* Progress Source */}
      <Field label="Progress Source">
        {item.physicalProgressLocked ? (
          <span style={{ color: 'var(--wbs-progress-low)' }}>Dikunci</span>
        ) : item.progressSource === 'timeline' ? (
          <span style={{ color: 'var(--wbs-progress-mid)' }}>Otomatis dari Timeline</span>
        ) : (
          <span style={{ color: 'var(--text-primary)' }}>Manual</span>
        )}
      </Field>

      {/* Description */}
      {item.description && (
        <Field label="Deskripsi">
          <span style={{ color: 'var(--text-secondary)' }}>{item.description}</span>
        </Field>
      )}
    </div>
  )
}

function RABTab({ item, rabItems = [] }: { item: WBSItem; rabItems?: RABItem[] }) {
  const linked = rabItems.filter((r) => r.wbsId === item.id)
  const total = linked.reduce((acc, r) => acc + rabTotal(r), 0)

  if (linked.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <ReceiptText size={28} style={{ color: 'var(--text-secondary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Tidak ada item RAB terhubung
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-0 p-4">
      {/* Summary */}
      <div
        className="mb-3 rounded-lg px-3 py-2 text-xs"
        style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)' }}
      >
        <span>{linked.length} item</span>
        <span className="mx-1.5" style={{ color: 'var(--border-default)' }}>·</span>
        <span className="font-bold" style={{ color: 'var(--text-idr)' }}>
          {formatIDR(total)}
        </span>
      </div>

      {/* List */}
      <div className="space-y-1">
        {linked.map((r) => {
          const amt = rabTotal(r)
          return (
            <div
              key={r.id}
              className="flex items-start justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
              style={{ background: 'var(--bg-surface-hover)' }}
            >
              <span
                className="min-w-0 flex-1 truncate leading-snug"
                style={{ color: 'var(--text-primary)' }}
                title={rabName(r)}
              >
                {rabName(r)}
              </span>
              <span
                className="shrink-0 font-mono text-xs font-semibold"
                style={{ color: 'var(--text-idr)' }}
              >
                {formatIDR(amt)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimelineTab({
  item,
  timelineTasks = [],
  timelineTaskCount = 0,
}: {
  item: WBSItem
  timelineTasks?: Array<{ id: string; name: string; wbsId?: string }>
  timelineTaskCount?: number
}) {
  const linked = timelineTasks.filter((t) => t.wbsId === item.id)
  // Prefer filtered list; fall back to the scalar count for display
  const displayCount = linked.length > 0 ? linked.length : timelineTaskCount

  if (displayCount === 0 && linked.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <CalendarDays size={28} style={{ color: 'var(--text-secondary)' }} />
        <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
          Tidak ada timeline task terhubung
        </p>
      </div>
    )
  }

  return (
    <div className="p-4">
      {/* Badge */}
      <div
        className="mb-3 rounded-lg px-3 py-2 text-xs"
        style={{ background: 'var(--bg-surface-hover)', color: 'var(--text-secondary)' }}
      >
        <span className="font-bold" style={{ color: 'hsl(var(--cobalt-400))' }}>
          {displayCount}
        </span>{' '}
        task terhubung
      </div>

      {linked.length > 0 ? (
        <div className="space-y-1">
          {linked.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
              style={{ background: 'var(--bg-surface-hover)' }}
            >
              <CalendarDays size={12} style={{ color: 'hsl(var(--cobalt-400))', flexShrink: 0 }} />
              <span
                className="min-w-0 flex-1 truncate"
                style={{ color: 'var(--text-primary)' }}
                title={t.name}
              >
                {t.name}
              </span>
            </div>
          ))}
        </div>
      ) : (
        /* Only scalar count provided — no individual names available */
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          Detail task tidak tersedia.
        </p>
      )}
    </div>
  )
}

function AddChildTab({
  item,
  onAddChild,
}: {
  item: WBSItem
  onAddChild?: (parentId: string) => void
}) {
  const [childName, setChildName] = useState('')

  function handleSubmit() {
    if (childName.trim() && onAddChild) {
      onAddChild(item.id)
      setChildName('')
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleSubmit()
  }

  if (!onAddChild) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 p-8 text-center">
        <LayoutList size={28} style={{ color: 'var(--text-secondary)' }} />
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Tambah child tidak tersedia.
        </p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-3">
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
        Tambah sub-item di bawah{' '}
        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
          {item.code} {item.name}
        </span>
      </p>

      <div className="flex gap-2">
        <input
          type="text"
          value={childName}
          onChange={(e) => setChildName(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Nama sub-item…"
          className="flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none transition-colors placeholder:opacity-50"
          style={{
            background: 'var(--bg-surface-hover)',
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={handleSubmit}
          disabled={!childName.trim()}
          className="flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition-opacity disabled:opacity-40"
          style={{
            background: 'hsl(var(--cobalt-400))',
            color: 'var(--bg-page)',
          }}
        >
          <Plus size={13} />
          Tambah
        </button>
      </div>

      <p className="text-xs" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>
        Tekan Enter atau klik Tambah
      </p>
    </div>
  )
}

// ─── Tab list style helpers ───────────────────────────────────────────────────

const TAB_LIST_TABS = [
  { value: 'overview', label: 'Overview', icon: <ListTree size={11} /> },
  { value: 'rab', label: 'RAB', icon: <ReceiptText size={11} /> },
  { value: 'timeline', label: 'Timeline', icon: <CalendarDays size={11} /> },
  { value: 'child', label: '+Child', icon: <Plus size={11} /> },
] as const

type TabValue = (typeof TAB_LIST_TABS)[number]['value']

// ─── Main component ───────────────────────────────────────────────────────────

export function WBSDetailPanel({
  item,
  budgetLinked = 0,
  timelineTaskCount = 0,
  rabItems = [],
  timelineTasks = [],
  onEdit,
  onDelete,
  onAddChild,
  onClose,
}: WBSDetailPanelProps) {
  const [activeTab, setActiveTab] = useState<TabValue>('overview')

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (!item) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center"
        style={{ background: 'var(--bg-surface)' }}
      >
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            background: 'color-mix(in srgb, hsl(var(--cobalt-400)) 12%, transparent)',
            color: 'hsl(var(--cobalt-400))',
          }}
        >
          <ListTree size={22} />
        </div>
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Pilih item WBS
          </p>
          <p className="mt-0.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            Klik salah satu item pada struktur untuk melihat detail.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      className="flex h-full flex-col"
      style={{ background: 'var(--bg-surface)' }}
    >
      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div
        className="flex items-start gap-2 px-4 py-3"
        style={{
          background: 'var(--bg-surface-hover)',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-xs font-bold"
              style={{
                background: 'color-mix(in srgb, hsl(var(--cobalt-400)) 15%, transparent)',
                color: 'hsl(var(--cobalt-400))',
              }}
            >
              <GitBranch size={10} />
              {item.code || '—'}
            </span>
            <span
              className="text-xs font-bold uppercase tracking-wider"
              style={{ color: 'var(--text-secondary)' }}
            >
              Level {item.level ?? 1}
            </span>
          </div>
          <h3
            className="font-display truncate text-base font-bold leading-tight tracking-tight"
            style={{ color: 'var(--text-primary)' }}
          >
            {item.name}
          </h3>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className="rounded p-1 transition-colors lg:hidden"
            style={{ color: 'var(--text-secondary)' }}
            aria-label="Tutup detail"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Radix Tabs ─────────────────────────────────────────────────────── */}
      <Tabs.Root
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as TabValue)}
        className="flex min-h-0 flex-1 flex-col"
      >
        {/* Tab list */}
        <Tabs.List
          className="flex shrink-0 gap-0"
          style={{ borderBottom: '1px solid var(--border-default)' }}
          aria-label="Detail panel tabs"
        >
          {TAB_LIST_TABS.map((tab) => (
            <Tabs.Trigger
              key={tab.value}
              value={tab.value}
              className="group flex flex-1 items-center justify-center gap-1 px-1 py-2 text-xs font-semibold transition-colors"
              style={{
                color: activeTab === tab.value ? 'hsl(var(--cobalt-400))' : 'var(--text-secondary)',
                borderBottom:
                  activeTab === tab.value
                    ? '2px solid hsl(var(--cobalt-400))'
                    : '2px solid transparent',
                background: 'transparent',
                outline: 'none',
              }}
            >
              {tab.icon}
              {tab.label}
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        {/* Tab panels */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Tabs.Content value="overview" className="h-full">
            <OverviewTab
              item={item}
              budgetLinked={budgetLinked}
              timelineTaskCount={timelineTaskCount}
              rabItems={rabItems}
              timelineTasks={timelineTasks}
            />
          </Tabs.Content>

          <Tabs.Content value="rab" className="h-full">
            <RABTab item={item} rabItems={rabItems} />
          </Tabs.Content>

          <Tabs.Content value="timeline" className="h-full">
            <TimelineTab
              item={item}
              timelineTasks={timelineTasks}
              timelineTaskCount={timelineTaskCount}
            />
          </Tabs.Content>

          <Tabs.Content value="child" className="h-full">
            <AddChildTab item={item} onAddChild={onAddChild} />
          </Tabs.Content>
        </div>
      </Tabs.Root>

      {/* ── Footer actions ──────────────────────────────────────────────────── */}
      <div
        className="flex shrink-0 gap-2 px-4 py-3"
        style={{ borderTop: '1px solid var(--border-default)' }}
      >
        <button
          onClick={() => onEdit(item)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{
            borderColor: 'var(--border-default)',
            color: 'var(--text-primary)',
            background: 'transparent',
          }}
        >
          <Edit2 size={13} />
          Edit
        </button>
        <button
          onClick={() => onDelete(item)}
          className="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors"
          style={{ color: 'var(--status-danger-fg)', background: 'transparent' }}
        >
          <Trash2 size={13} />
          Hapus
        </button>
      </div>
    </div>
  )
}

export default WBSDetailPanel
