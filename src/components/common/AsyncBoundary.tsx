/**
 * AsyncBoundary.tsx
 *
 * Composable wrapper that centralises loading / error / empty state display.
 * Replaces ad-hoc use of inline spinners, blank pages, and PageSkeleton
 * across the app (fixes UI-03 / UI-04).
 *
 * Usage:
 *   <AsyncBoundary isLoading={loading} error={error} isEmpty={!data.length}>
 *     <MyContent />
 *   </AsyncBoundary>
 */

import React from 'react'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

export interface AsyncBoundaryProps {
  /** Show loading state when true */
  isLoading: boolean
  /** Show error state when truthy (string or Error) */
  error?: string | Error | null
  /**
   * Show empty state when true — only evaluated when isLoading=false and
   * error is falsy.
   */
  isEmpty?: boolean
  /** Message shown inside the EmptyState */
  emptyMessage?: string
  /** Text shown next to the spinner while loading */
  loadingText?: string
  /** Callback wired into ErrorState's "Coba Lagi" button */
  onRetry?: () => void
  /**
   * Custom skeleton rendered instead of the default LoadingSpinner.
   * Pass e.g. a <TableSkeleton /> or <CardSkeleton /> from the design system.
   */
  skeleton?: React.ReactNode
  /** Content rendered when not loading, no error, and not empty */
  children: React.ReactNode
}

/**
 * AsyncBoundary
 *
 * Priority order: isLoading → error → isEmpty → children
 */
export function AsyncBoundary({
  isLoading,
  error,
  isEmpty = false,
  emptyMessage,
  loadingText,
  onRetry,
  skeleton,
  children,
}: AsyncBoundaryProps) {
  // --- Loading ---
  if (isLoading) {
    if (skeleton) {
      return <>{skeleton}</>
    }
    return (
      <div className="flex min-h-[200px] items-center justify-center">
        <LoadingSpinner size="lg" text={loadingText} />
      </div>
    )
  }

  // --- Error ---
  const errorMessage = error instanceof Error ? error.message : (error ?? null)
  if (errorMessage) {
    return (
      <ErrorState
        title="Gagal memuat data"
        description={errorMessage}
        onRetry={onRetry}
      />
    )
  }

  // --- Empty ---
  if (isEmpty) {
    return (
      <EmptyState
        title="Tidak ada data"
        description={emptyMessage}
      />
    )
  }

  // --- Content ---
  return <>{children}</>
}

export default AsyncBoundary
