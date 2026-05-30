import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type EnterpriseStatus = 
  | 'draft' | 'planning' | 'open'
  | 'pending' | 'review' | 'submitted'
  | 'approved' | 'active' | 'completed'
  | 'rejected' | 'delayed' | 'cancelled' | 'error'
  | 'locked' | 'closed' | 'baseline'

interface StatusBadgeProps {
  status: EnterpriseStatus | string
  label?: string
  className?: string
  variant?: 'outline' | 'solid' | 'subtle'
}

const statusConfig: Record<string, { color: string; label: string }> = {
  // Neutral
  draft:      { color: 'bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-300 dark:border-zinc-500/25', label: 'Draft' },
  closed:     { color: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/25', label: 'Closed' },
  cancelled:  { color: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-400 dark:border-zinc-500/25', label: 'Cancelled' },
  // Info / Reference (blue)
  planning:   { color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25', label: 'Planning' },
  open:       { color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25', label: 'Open' },
  submitted:  { color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30', label: 'Submitted' },
  baseline:   { color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/15 dark:text-blue-400 dark:border-blue-500/25', label: 'Baseline' },
  // Warning (amber)
  pending:    { color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25', label: 'Pending' },
  review:     { color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30', label: 'Review' },
  // Success (emerald)
  approved:   { color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25', label: 'Approved' },
  active:     { color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30', label: 'Active' },
  completed:  { color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-400 dark:border-emerald-500/25', label: 'Completed' },
  // Error (rose)
  rejected:   { color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-400 dark:border-rose-500/25', label: 'Rejected' },
  delayed:    { color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30', label: 'Delayed' },
  error:      { color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30', label: 'Error' },
  // Brand orange — locked/enforced by system
  locked:     { color: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-400 dark:border-orange-500/25', label: 'Locked' },
}

/**
 * StatusBadge
 * 
 * Unified status indicators for MLPHoma.
 * Maps raw backend status strings to consistent semantic styles.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  label,
  className,
  variant = 'subtle'
}) => {
  const key = status.toLowerCase()
  const config = statusConfig[key] || { color: 'bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-500/15 dark:text-zinc-400', label: status }
  
  const displayLabel = label || config.label

  return (
    <Badge 
      variant="outline"
      className={cn(
        "px-2 py-0 h-5 text-xs font-bold uppercase tracking-wider transition-all",
        variant === 'subtle' ? config.color : "",
        className
      )}
    >
      {key === 'pending' && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
      {key === 'active' && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />}
      {key === 'locked' && <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-orange-500" />}
      {displayLabel}
    </Badge>
  )
}
