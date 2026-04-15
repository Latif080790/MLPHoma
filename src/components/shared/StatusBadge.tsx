/**
 * StatusBadge.tsx
 * Unified status badge for ALL status types across MLPHoma modules.
 * Replaces ad-hoc badge implementations in RAB, Timeline, Supply Chain, etc.
 *
 * Covers 22 status variants with WCAG AA compliant color contrast.
 * Pulse animation for active/critical states via status-pulse CSS class.
 *
 * @usage
 * <StatusBadge status="in-progress" />
 * <StatusBadge status="critical" size="lg" />
 * <StatusBadge status="approved" label="Disetujui" />
 */
import React from 'react'
import { cn } from '@/lib/utils'

export type StatusVariant =
  | 'in-progress'
  | 'planning'
  | 'completed'
  | 'delayed'
  | 'on-hold'
  | 'cancelled'
  | 'critical'
  | 'high'
  | 'medium'
  | 'low'
  | 'approved'
  | 'rejected'
  | 'pending'
  | 'draft'
  | 'under-review'
  | 'on-track'
  | 'at-risk'
  | 'behind'
  | 'ahead'
  | 'online'
  | 'offline'
  | 'syncing'

export interface StatusBadgeProps {
  status: StatusVariant
  /** Override label text (defaults to human-readable status name) */
  label?: string
  /** Show pulsing dot indicator (defaults to config default per status) */
  pulse?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

interface StatusConfig {
  label: string
  className: string
  dotColor: string
  defaultPulse: boolean
}

const STATUS_CONFIG: Record<StatusVariant, StatusConfig> = {
  'in-progress': {
    label: 'In Progress',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-500',
    defaultPulse: true,
  },
  planning: {
    label: 'Planning',
    className:
      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
    defaultPulse: false,
  },
  completed: {
    label: 'Completed',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
    defaultPulse: false,
  },
  delayed: {
    label: 'Delayed',
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    defaultPulse: true,
  },
  'on-hold': {
    label: 'On Hold',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
    defaultPulse: false,
  },
  cancelled: {
    label: 'Cancelled',
    className:
      'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
    defaultPulse: false,
  },
  critical: {
    label: 'Critical',
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border border-red-300 dark:border-red-700 font-semibold',
    dotColor: 'bg-red-500',
    defaultPulse: true,
  },
  high: {
    label: 'High',
    className:
      'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300 border border-orange-200 dark:border-orange-800',
    dotColor: 'bg-orange-500',
    defaultPulse: false,
  },
  medium: {
    label: 'Medium',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-400',
    defaultPulse: false,
  },
  low: {
    label: 'Low',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
    defaultPulse: false,
  },
  approved: {
    label: 'Approved',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
    defaultPulse: false,
  },
  rejected: {
    label: 'Rejected',
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    defaultPulse: false,
  },
  pending: {
    label: 'Pending',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-400',
    defaultPulse: true,
  },
  draft: {
    label: 'Draft',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-600',
    dotColor: 'bg-slate-400',
    defaultPulse: false,
  },
  'under-review': {
    label: 'Under Review',
    className:
      'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
    dotColor: 'bg-purple-500',
    defaultPulse: true,
  },
  'on-track': {
    label: 'On Track',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
    defaultPulse: false,
  },
  'at-risk': {
    label: 'At Risk',
    className:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
    dotColor: 'bg-amber-500',
    defaultPulse: true,
  },
  behind: {
    label: 'Behind',
    className:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800',
    dotColor: 'bg-red-500',
    defaultPulse: false,
  },
  ahead: {
    label: 'Ahead',
    className:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
    dotColor: 'bg-emerald-500',
    defaultPulse: false,
  },
  online: {
    label: 'Online',
    className:
      'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800',
    dotColor: 'bg-green-500',
    defaultPulse: true,
  },
  offline: {
    label: 'Offline',
    className:
      'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
    dotColor: 'bg-slate-400',
    defaultPulse: false,
  },
  syncing: {
    label: 'Syncing',
    className:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    dotColor: 'bg-blue-400',
    defaultPulse: true,
  },
}

const SIZE_CLASSES: Record<NonNullable<StatusBadgeProps['size']>, string> = {
  sm: 'text-[10px] px-1.5 py-0.5 gap-1',
  md: 'text-xs px-2 py-0.5 gap-1.5',
  lg: 'text-sm px-2.5 py-1 gap-2',
}

const DOT_SIZES: Record<NonNullable<StatusBadgeProps['size']>, string> = {
  sm: 'h-1.5 w-1.5',
  md: 'h-2 w-2',
  lg: 'h-2.5 w-2.5',
}

export function StatusBadge({
  status,
  label,
  pulse,
  size = 'md',
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status]
  const shouldPulse = pulse ?? config.defaultPulse
  const displayLabel = label ?? config.label

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium whitespace-nowrap',
        SIZE_CLASSES[size],
        config.className,
        className,
      )}
    >
      <span
        className={cn(
          'rounded-full flex-shrink-0',
          DOT_SIZES[size],
          config.dotColor,
          shouldPulse && 'status-pulse',
        )}
      />
      {displayLabel}
    </span>
  )
}