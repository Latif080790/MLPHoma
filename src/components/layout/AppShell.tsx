import React, { useState, useEffect } from "react"
import { AppHeader } from "./AppHeader"
import { AppSidebar } from "./AppSidebar"
import { cn } from "@/lib/utils"
import { useBreakpoint } from "@/hooks/use-breakpoint"
import { SyncStatusBar, SyncState } from "./SyncStatusBar"
import { useOfflineQueueStore } from "@/store/offlineQueueStore"

/**
 * AppShell v3 — Fixed layout container.
 *
 * Key fixes over v2:
 *   - Fixed pixel pl-[260px] / pl-16 instead of pl-[var(--size-sidebar-*)]
 *     to guarantee Tailwind generates the correct CSS
 *   - Removed broken bg-[hsl(...)]/80 opacity pattern on header
 *   - Proper z-index stacking without CSS var in z-[]
 *   - Content area has NO padding (PageShell handles padding)
 */

export interface AppShellProps {
  /** Active project name for header context */
  projectName?: string
  /** Search handler */
  onSearch?: (value: string) => void
  /** Page content */
  children: React.ReactNode
}

export function AppShell({ projectName, onSearch, children }: AppShellProps) {
  const { isMobile, isTablet } = useBreakpoint()
  const shouldOverlay = isMobile || isTablet

  // Persist sidebar collapsed state (desktop only)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true"
    } catch {
      return false
    }
  })

  // Mobile drawer open state
  const [drawerOpen, setDrawerOpen] = useState(false)

  // Offline queue state
  const { queue, isSyncing, syncQueue } = useOfflineQueueStore()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [lastSynced, setLastSynced] = useState<Date | undefined>(undefined)

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true)
      syncQueue().then(() => setLastSynced(new Date()))
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [syncQueue])

  let syncState: SyncState = 'synced'
  if (!isOnline) syncState = 'offline'
  else if (isSyncing) syncState = 'pending'
  else if (queue.length > 0) syncState = 'error' // has queue but online and not syncing = error/failed previously

  // Sync to local storage (desktop collapsed state)
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed))
  }, [collapsed])

  // Close drawer on route changes (handled by parent)
  useEffect(() => {
    if (!shouldOverlay) {
      setDrawerOpen(false)
    }
  }, [shouldOverlay])

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Mobile overlay backdrop — only interactive when shouldOverlay is true */}
      {shouldOverlay && (
        <div
          className={cn(
            "fixed inset-0 z-[399] bg-black/40 backdrop-blur-sm transition-opacity duration-normal",
            drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
          )}
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <AppSidebar
        collapsed={shouldOverlay ? false : collapsed}
        setCollapsed={shouldOverlay ? () => setDrawerOpen(!drawerOpen) : setCollapsed}
        open={drawerOpen}
        isOverlay={shouldOverlay}
      />

      {/* Main Content Wrapper — offset by sidebar width (hardcoded to ensure stability) */}
      <div
        className={cn(
          "relative flex min-h-screen flex-col transition-[padding-left] duration-normal ease-standard",
          shouldOverlay
            ? "pl-0"
            : collapsed
              ? "pl-[72px]"
              : "pl-[280px]"
        )}
      >
        {/* Sticky Header — Layer 0 (Fixed for maximum stability, z-400 to stay under sidebar but above content) */}
        <header className="fixed top-0 right-0 z-[400] h-14 border-b border-border-semantic-subtle bg-surface-panel/95 backdrop-blur-md transition-[left] duration-normal ease-standard"
          style={{ 
            left: shouldOverlay ? 0 : collapsed ? '72px' : '280px' 
          }}
        >
          <AppHeader
            projectName={projectName}
            onSearch={onSearch}
          />
        </header>

        {/* Page Content — offset by fixed header height (h-14 = 56px) */}
        <main className="flex-1 overflow-x-hidden flex flex-col min-h-0 pt-14">
          <div className="w-full flex-1 flex flex-col min-h-0 bg-surface-page">
            {children}
          </div>
        </main>
      </div>

      {/* Persistence Feedback — WF01 */}
      <SyncStatusBar 
        state={syncState}
        pendingCount={queue.length}
        lastSynced={lastSynced}
      />
    </div>
  )
}
