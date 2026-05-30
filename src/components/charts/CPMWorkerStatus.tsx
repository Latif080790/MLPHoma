import React from 'react'
import { Activity, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CPMWorkerStatusProps {
  isCalculating?: boolean
  lastDurationMs?: number
  taskCount?: number
}

/**
 * CPMWorkerStatus — WF04
 * 
 * Pulsing activity bar indicating that the Critical Path Method engine
 * is active or was recently updated. Key for real-time schedule UX.
 */
export function CPMWorkerStatus({ 
  isCalculating = false, 
  lastDurationMs = 0,
  taskCount = 0 
}: CPMWorkerStatusProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 px-3 py-1.5 rounded-md border transition-all duration-700",
      isCalculating 
        ? "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800 animate-pulse" 
        : "bg-muted/30 border-border"
    )}>
      <div className="relative">
        <Cpu size={14} className={cn(
          "text-muted-foreground",
          isCalculating && "text-blue-500"
        )} />
        {isCalculating && (
          <span className="absolute -top-1 -right-1 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          </span>
        )}
      </div>

      <div className="flex flex-col">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {isCalculating ? 'Recalculating Critical Path...' : 'CPM Engine Standby'}
          </span>
          {lastDurationMs > 0 && !isCalculating && (
            <span className="text-xs font-mono text-muted-foreground">
              ({lastDurationMs}ms)
            </span>
          )}
        </div>
        {!isCalculating && taskCount > 0 && (
          <div className="text-xs text-muted-foreground leading-none">
            {taskCount} tasks monitored via Pert/CPM
          </div>
        )}
      </div>

      {isCalculating && (
        <div className="ml-auto flex items-center gap-1">
          <Activity size={12} className="text-blue-400 animate-in fade-in duration-1000" />
        </div>
      )}
    </div>
  )
}
