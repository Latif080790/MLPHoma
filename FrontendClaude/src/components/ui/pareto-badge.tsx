/**
 * Multi-Modal Pareto Classification Badge
 * 
 * WCAG 2.1 AA Compliant - Uses multiple indicators beyond color:
 * - Icon (AlertTriangle, AlertCircle, Circle)
 * - Color coding (Red, Amber, Slate)
 * - Text label (High, Medium, Low)
 * - Tooltip with detailed explanation
 * 
 * Usage:
 * ```tsx
 * <ParetoClassBadge class="A" />
 * <ParetoClassBadge class="B" />
 * <ParetoClassBadge class="C" />
 * ```
 */

import React from 'react'
import { Badge } from './badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip'
import { AlertTriangle, AlertCircle, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ParetoClass = 'A' | 'B' | 'C'

interface ParetoClassBadgeProps {
  class: ParetoClass
  className?: string
  showLabel?: boolean
  size?: 'sm' | 'md' | 'lg'
}

const PARETO_CONFIG = {
  A: {
    icon: AlertTriangle,
    color: 'red',
    label: 'High',
    bgColor: 'bg-red-50 dark:bg-red-950',
    textColor: 'text-red-700 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800',
    description: 'Critical Priority - 20% of items contributing 80% of total value',
    percentage: '~80%',
  },
  B: {
    icon: AlertCircle,
    color: 'amber',
    label: 'Medium',
    bgColor: 'bg-amber-50 dark:bg-amber-950',
    textColor: 'text-amber-700 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800',
    description: 'Moderate Priority - Middle segment contributing ~15% of total value',
    percentage: '~15%',
  },
  C: {
    icon: Circle,
    color: 'slate',
    label: 'Low',
    bgColor: 'bg-slate-50 dark:bg-slate-900',
    textColor: 'text-slate-600 dark:text-slate-400',
    borderColor: 'border-slate-200 dark:border-slate-700',
    description: 'Low Priority - 80% of items contributing only 5% of total value',
    percentage: '~5%',
  },
} as const

export function ParetoClassBadge({
  class: paretoClass,
  className,
  showLabel = true,
  size = 'md',
}: ParetoClassBadgeProps) {
  const config = PARETO_CONFIG[paretoClass]
  const Icon = config.icon

  const sizeClasses = {
    sm: 'h-4 px-1.5 text-xs gap-0.5',
    md: 'h-5 px-2 text-xs gap-1',
    lg: 'h-6 px-2.5 text-sm gap-1.5',
  }

  const iconSizes = {
    sm: 'size-2.5',
    md: 'size-3',
    lg: 'size-3.5',
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={cn(
              'flex items-center font-semibold border transition-all',
              config.bgColor,
              config.textColor,
              config.borderColor,
              sizeClasses[size],
              'hover:shadow-sm',
              className
            )}
          >
            <Icon className={iconSizes[size]} aria-hidden="true" />
            <span className="font-bold" aria-label={`Pareto class ${paretoClass}`}>
              {paretoClass}
            </span>
            {showLabel && (
              <span className="text-xs font-medium opacity-75">
                {config.label}
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className={cn(
            'max-w-xs text-xs',
            config.bgColor,
            config.textColor,
            config.borderColor
          )}
        >
          <div className="space-y-1">
            <div className="font-semibold flex items-center gap-2">
              <span>Pareto {paretoClass}</span>
              <Badge variant="secondary" className="text-xs h-4 px-1">
                {config.percentage}
              </Badge>
            </div>
            <p className="text-xs opacity-90">{config.description}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// Bulk export variant for displaying multiple classes
export function ParetoLegend() {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="font-medium">Pareto:</span>
      <ParetoClassBadge class="A" size="sm" />
      <ParetoClassBadge class="B" size="sm" />
      <ParetoClassBadge class="C" size="sm" />
    </div>
  )
}

// Export type for external use
export type { ParetoClass, ParetoClassBadgeProps }
