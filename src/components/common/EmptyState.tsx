/**
 * EmptyState.tsx
 * Enhanced empty state with guidance, icons, and contextual help.
 * Provides specific empty states for different contexts.
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Search, Inbox, AlertCircle, Plus } from 'lucide-react'

/**
 * EmptyStateProps
 * Props definition for the EmptyState component.
 */
export interface EmptyStateProps {
  /** Main title */
  title: string
  /** Optional description text */
  description?: string
  /** Optional leading icon (fallback when no imageKeyword provided) */
  icon?: React.ReactNode
  /** Optional illustration keyword for autoimage system (short English keywords recommended) */
  imageKeyword?: string
  /** Optional actions area (preferred prop) */
  actions?: React.ReactNode
  /** Backward-compatible alias for actions used in older calls */
  action?: React.ReactNode
  /** Additional className */
  className?: string
}

/**
 * EmptyState
 * Encourages users to take first actions when no data is available.
 * Renders an optional header image using the platform's autoimage helper.
 */
export function EmptyState({
  title,
  description,
  icon,
  imageKeyword,
  actions,
  action,
  className,
}: EmptyStateProps) {
  const cta = actions ?? action
  const hasImage = !!imageKeyword

  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl border bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900', className)}>
      {/* Illustration or Icon */}
      {hasImage ? (
        <div className="mb-4 w-full max-w-sm overflow-hidden rounded-lg border dark:border-neutral-800">
          <img
            src={`https://sider.ai/autoimage/${encodeURIComponent(imageKeyword || '')}`}
            className="h-36 w-full object-cover"
            alt={title}
          />
        </div>
      ) : icon ? (
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-200">
          {icon}
        </div>
      ) : null}

      <div className="text-base font-semibold">{title}</div>
      {description ? (
        <p className="mt-1 max-w-md text-sm text-neutral-600 dark:text-neutral-400">{description}</p>
      ) : null}

      {cta ? <div className="mt-4 flex flex-wrap items-center justify-center gap-2">{cta}</div> : null}
    </div>
  )
}

export default EmptyState

/**
 * Contextual empty state variants
 */

export function EmptySearchResults({ query, onClear }: { query: string; onClear?: () => void }) {
  return (
    <EmptyState
      icon={<Search className="h-6 w-6" />}
      title="Tidak ada hasil"
      description={`Tidak ditemukan hasil untuk "${query}". Coba gunakan kata kunci lain.`}
      action={
        onClear ? (
          <button
            onClick={onClear}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Hapus pencarian
          </button>
        ) : undefined
      }
    />
  )
}

export function EmptyProjectList({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={<Inbox className="h-6 w-6" />}
      title="Belum ada proyek"
      description="Mulai dengan membuat proyek pertama Anda. Anda dapat menambahkan WBS, timeline, dan analisis biaya."
      action={
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
        >
          <Plus className="h-4 w-4" />
          Buat Proyek Baru
        </button>
      }
    />
  )
}

export function ErrorState({
  title = 'Terjadi kesalahan',
  description = 'Maaf, terjadi kesalahan saat memuat data.',
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <EmptyState
      icon={<AlertCircle className="h-6 w-6" />}
      title={title}
      description={description}
      action={
        onRetry ? (
          <button
            onClick={onRetry}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            Coba Lagi
          </button>
        ) : undefined
      }
    />
  )
}

export function OfflineState({ onRetry }: { onRetry?: () => void }) {
  return (
    <EmptyState
      icon={<AlertCircle className="h-6 w-6" />}
      title="Tidak ada koneksi"
      description="Tidak dapat terhubung ke server. Periksa koneksi internet Anda dan coba lagi."
      action={
        onRetry ? (
          <button
            onClick={onRetry}
            className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
          >
            Coba Lagi
          </button>
        ) : undefined
      }
    />
  )
}
