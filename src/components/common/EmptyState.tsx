/**
 * EmptyState.tsx
 * Generic empty state with optional illustration (autoimage), icon, title, description, and actions.
 * Supports:
 *  - imageKeyword: show an illustration via https://sider.ai/autoimage/{keyword}
 *  - action (alias) or actions (preferred) for CTA buttons
 */

import React from 'react'

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
}: EmptyStateProps) {
  const cta = actions ?? action
  const hasImage = !!imageKeyword

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border bg-white p-8 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      {/* Illustration or Icon */}
      {hasImage ? (
        <div className="mb-4 w-full max-w-sm overflow-hidden rounded-lg border dark:border-neutral-800">
          <img
            src={`https://sider.ai/autoimage/${encodeURIComponent(imageKeyword || '')}`}
            className="h-36 w-full object-cover"
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
