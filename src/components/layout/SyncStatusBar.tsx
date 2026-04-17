import React, { useState, useEffect } from 'react'
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export type SyncState = 'synced' | 'pending' | 'error' | 'offline'

interface SyncStatusBarProps {
  state?: SyncState
  pendingCount?: number
  lastSynced?: Date
}

/**
 * SyncStatusBar — WF01
 * 
 * Sticky bottom status indicator for enterprise data synchronization.
 * Shown only when there are pending items or errors, or momentarily after sync.
 */
export function SyncStatusBar({ 
  state = 'synced', 
  pendingCount = 0, 
  lastSynced 
}: SyncStatusBarProps) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (state !== 'synced' || pendingCount > 0) {
      setVisible(true)
    } else {
      // Keep visible for a few seconds after sync success
      const timer = setTimeout(() => setVisible(false), 3000)
      return () => clearTimeout(timer)
    }
  }, [state, pendingCount])

  if (!visible && state === 'synced') return null

  return (
    <div 
      className={cn(
        "fixed bottom-4 right-4 z-[1001] flex items-center gap-3 px-4 py-2 rounded-full shadow-lg border transition-all duration-500 animate-in slide-in-from-bottom-4",
        state === 'synced' && "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-400",
        state === 'pending' && "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-400",
        state === 'error' && "bg-red-50 border-red-200 text-red-700 dark:bg-red-950/40 dark:border-red-800 dark:text-red-400 font-bold",
        state === 'offline' && "bg-slate-100 border-slate-300 text-slate-600 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400"
      )}
    >
      <div className="flex items-center gap-2">
        {state === 'synced' && <CheckCircle2 size={16} className="text-emerald-500" />}
        {state === 'pending' && <RefreshCw size={16} className="animate-spin text-blue-500" />}
        {state === 'error' && <CloudOff size={16} className="text-red-500" />}
        {state === 'offline' && <Cloud size={16} className="text-slate-400" />}
        
        <span className="text-xs font-semibold uppercase tracking-wider">
          {state === 'synced' && 'All Changes Saved'}
          {state === 'pending' && `Syncing ${pendingCount} item${pendingCount > 1 ? 's' : ''}...`}
          {state === 'error' && 'Sync Failure'}
          {state === 'offline' && 'Working Offline'}
        </span>
      </div>

      {lastSynced && state === 'synced' && (
        <span className="text-[10px] opacity-60 ml-2 border-l pl-2 border-current">
          {lastSynced.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
    </div>
  )
}
