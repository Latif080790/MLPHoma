import React from 'react'

/**
 * PageSkeleton
 * Loading skeleton component for page-level route transitions.
 * Provides visual feedback during code splitting/lazy loading.
 */
export function PageSkeleton() {
  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      {/* Header skeleton */}
      <div className="h-14 border-b bg-white dark:bg-neutral-900 dark:border-neutral-800">
        <div className="mx-auto max-w-7xl px-4 flex items-center h-full">
          <div className="h-6 w-32 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          <div className="ml-auto flex gap-3">
            <div className="h-8 w-8 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
            <div className="h-8 w-8 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
      {/* Content skeleton */}
      <main className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
        <div className="h-8 w-1/3 bg-neutral-200 dark:bg-neutral-700 rounded animate-pulse" />
        <div className="h-4 w-2/3 bg-neutral-100 dark:bg-neutral-800 rounded animate-pulse" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-24 bg-white dark:bg-neutral-900 rounded-xl border dark:border-neutral-800 animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-white dark:bg-neutral-900 rounded-xl border dark:border-neutral-800 animate-pulse" />
      </main>
    </div>
  )
}
