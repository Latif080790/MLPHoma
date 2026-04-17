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
  draft: { color: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300', label: 'Draft' },
  planning: { color: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400', label: 'Planning' },
  pending: { color: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400', label: 'Pending' },
  review: { color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-800/40 dark:text-amber-300', label: 'Review' },
  approved: { color: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400', label: 'Approved' },
  active: { color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-800/40 dark:text-emerald-300', label: 'Active' },
  rejected: { color: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-400', label: 'Rejected' },
  delayed: { color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-800/40 dark:text-rose-300', label: 'Delayed' },
  locked: { color: 'bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400', label: 'Locked' },
  baseline: { color: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400', label: 'Baseline' },
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
  const config = statusConfig[key] || { color: 'bg-slate-100 text-slate-600', label: status }
  
  const displayLabel = label || config.label

  return (
    <Badge 
      variant="outline"
      className={cn(
        "px-2 py-0 h-5 text-[10px] font-bold uppercase tracking-wider transition-all",
        variant === 'subtle' ? config.color : "",
        className
      )}
    >
      {key === 'pending' && <span className="mr-1 h-1 w-1 rounded-full bg-amber-500 animate-pulse" />}
      {key === 'active' && <span className="mr-1 h-1 w-1 rounded-full bg-emerald-500" />}
      {displayLabel}
    </Badge>
  )
}
