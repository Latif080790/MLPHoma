import React, { useState, useEffect } from "react"
import { AppHeader } from "./AppHeader"
import { AppSidebar } from "./AppSidebar"
import { cn } from "@/lib/utils"

export interface AppShellProps {
  projectName?: string
  onSearch?: (value: string) => void
  children: React.ReactNode
}

export function AppShell({ projectName, onSearch, children }: AppShellProps) {
  // Persist sidebar state
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("sidebar-collapsed") === "true"
    } catch {
      return false
    }
  })

  // Sync to local storage
  useEffect(() => {
    localStorage.setItem("sidebar-collapsed", String(collapsed))
  }, [collapsed])

  return (
    <div
      className="min-h-screen bg-slate-50 dark:bg-neutral-950 font-sans text-slate-900 dark:text-slate-100 selection:bg-blue-100 dark:selection:bg-blue-900/30"
      style={{
        backgroundImage:
          'radial-gradient(circle, rgba(148,163,184,0.12) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >

      {/* 1. Glass Sidebar */}
      <AppSidebar collapsed={collapsed} setCollapsed={setCollapsed} />

      {/* 2. Main Content Wrapper */}
      <div
        className={cn(
          "relative flex min-h-screen flex-col transition-all duration-300 ease-in-out",
          collapsed ? "pl-[72px]" : "pl-[280px]"
        )}
      >
        {/* 3. Sticky Glass Header */}
        <div className="sticky top-0 z-40 border-b border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-neutral-950/70 backdrop-blur-md">
          <AppHeader projectName={projectName} onSearch={onSearch} />
        </div>

        {/* 4. Scrollable Page Content */}
        <main className="flex-1 p-6 md:p-8 overflow-x-hidden">
          <div className="mx-auto max-w-[1600px] w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
            {children}
          </div>
        </main>

      </div>
    </div>
  )
}
