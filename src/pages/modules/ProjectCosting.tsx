import React, { Suspense, useState } from 'react'
import { Calculator, BookOpen, GitBranch, DollarSign, BarChart2, Wrench, ChevronRight } from 'lucide-react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import ModulePageState from '@/components/common/ModulePageState'
import { BudgetHealthPanel } from '@/components/modules/BudgetHealthPanel'
import { useProjectStore } from '@/store/projectStore'
import { useWBSStore } from '@/store/wbsStore'
import { useRabStore } from '@/store/rabStore'
import { useRapStore } from '@/store/rapStore'
import { useAHSPStore } from '@/store/ahspStore'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { lazyRetry } from '@/lib/lazyRetry'

const AHSP = lazyRetry(() => import('@/pages/modules/AHSP/index'))
const WBS = lazyRetry(() => import('@/pages/modules/WBS'))
const RAB = lazyRetry(() => import('@/pages/modules/RAB'))
const RAP = lazyRetry(() => import('@/pages/modules/RAP'))
const ResourcePlan = lazyRetry(() => import('@/pages/modules/ResourcePlan'))

type CostingTab = 'ahsp' | 'wbs' | 'rab' | 'rap' | 'resource'

// ─── Tab config ──────────────────────────────────────────────────────────────
const TAB_CONFIG: Array<{
  id: CostingTab
  label: string
  shortLabel: string
  icon: React.ReactNode
  description: string
}> = [
    { id: 'ahsp', label: 'AHSP', shortLabel: 'AHSP', icon: <BookOpen size={13} />, description: 'Katalog harga satuan' },
    { id: 'wbs', label: 'WBS', shortLabel: 'WBS', icon: <GitBranch size={13} />, description: 'Struktur pekerjaan' },
    { id: 'rab', label: 'RAB', shortLabel: 'RAB', icon: <DollarSign size={13} />, description: 'Rencana anggaran biaya' },
    { id: 'rap', label: 'RAP', shortLabel: 'RAP', icon: <BarChart2 size={13} />, description: 'Anggaran pelaksanaan' },
    { id: 'resource', label: 'Resource Plan', shortLabel: 'RES', icon: <Wrench size={13} />, description: 'Kebutuhan resource' },
  ]

// ─── CostingFlowIndicator ────────────────────────────────────────────────────
function CostingFlowIndicator({
  activeTab,
  onTabChange,
  projectId,
}: {
  activeTab: CostingTab
  onTabChange: (tab: CostingTab) => void
  projectId: string
}) {
  // All selectors return primitives (numbers) to avoid new-reference re-render loops
  const ahspCount = useAHSPStore(s => s.ahspItems.length)
  const wbsCount = useWBSStore(s => s.itemsByProject[projectId]?.length ?? 0)
  const rabCount = useRabStore(s => s.itemsByProject[projectId]?.length ?? 0)
  const rapCount = useRapStore(s => s.items.filter(i => i.project_id === projectId).length)

  const counts: Record<CostingTab, number | null> = {
    ahsp: ahspCount,
    wbs: wbsCount,
    rab: rabCount,
    rap: rapCount,
    resource: null,
  }

  return (
    <div
      className="flex items-center overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/60 px-2 py-1 dark:border-slate-700 dark:bg-slate-800/40"
      role="navigation"
      aria-label="Alur Project Costing"
    >
      {TAB_CONFIG.map((tab, idx) => {
        const isActive = activeTab === tab.id
        const count = counts[tab.id]
        const hasIssue = count === 0 && tab.id !== 'resource'
        return (
          <React.Fragment key={tab.id}>
            <button
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${isActive
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-slate-100'
                : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
                }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
              {count !== null && (
                <span
                  className={`ml-0.5 rounded-full px-1.5 py-0 text-xs font-bold ${hasIssue
                    ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
                    : 'bg-slate-200 text-slate-600 dark:bg-slate-600 dark:text-slate-200'
                    }`}
                >
                  {count}
                </span>
              )}
            </button>
            {idx < TAB_CONFIG.length - 1 && (
              <ChevronRight size={11} className="mx-0.5 shrink-0 text-slate-300 dark:text-slate-600" />
            )}
          </React.Fragment>
        )
      })}
    </div>
  )
}

// ─── TabFallback ─────────────────────────────────────────────────────────────
function TabFallback() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-8 animate-pulse rounded bg-slate-100 dark:bg-slate-800" style={{ width: `${85 - i * 10}%` }} />
      ))}
    </div>
  )
}

export default function ProjectCosting() {
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const projects = useProjectStore(s => s.projects)
  const [activeTab, setActiveTab] = useState<CostingTab>('ahsp')
  const [srStatus, setSrStatus] = useState('AHSP tab opened.')

  const activeProject = activeProjectId ? projects[activeProjectId] : null

  if (!activeProjectId || !activeProject) {
    return (
      <ModulePageState
        icon={<Calculator size={18} />}
        title="Project Costing"
        description="Workspace terintegrasi AHSP / WBS / RAB / RAP / Resource Plan."
        variant="empty"
        message="Pilih proyek aktif untuk mengakses modul costing."
      />
    )
  }

  const handleTabChange = (next: CostingTab) => {
    setActiveTab(next)
    const labels: Record<CostingTab, string> = {
      ahsp: 'AHSP', wbs: 'WBS', rab: 'RAB', rap: 'RAP', resource: 'Resource Plan',
    }
    setSrStatus(`${labels[next]} tab dibuka.`)
  }

  const renderContent = () => {
    const wrap = (label: string, Component: React.LazyExoticComponent<() => JSX.Element>) => (
      <ErrorBoundary errorMessage={`${label} module failed to render`}>
        <Suspense fallback={<TabFallback />}>
          <Component />
        </Suspense>
      </ErrorBoundary>
    )
    switch (activeTab) {
      case 'ahsp': return wrap('AHSP', AHSP as React.LazyExoticComponent<() => JSX.Element>)
      case 'wbs': return wrap('WBS', WBS as React.LazyExoticComponent<() => JSX.Element>)
      case 'rab': return wrap('RAB', RAB as React.LazyExoticComponent<() => JSX.Element>)
      case 'rap': return wrap('RAP', RAP as React.LazyExoticComponent<() => JSX.Element>)
      case 'resource': return wrap('Resource Plan', ResourcePlan as React.LazyExoticComponent<() => JSX.Element>)
    }
  }

  return (
    <div className="space-y-4 density-compact">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
      <ModuleHeader
        icon={<Calculator size={18} />}
        title="Project Costing"
        description={`Workspace terintegrasi costing — ${activeProject.name}`}
        accent="emerald"
      />

      {/* ── Flow indicator breadcrumb ───────────────────────────────── */}
      <CostingFlowIndicator
        activeTab={activeTab}
        onTabChange={handleTabChange}
        projectId={activeProjectId}
      />

      {/* ── Budget Health KPIs — FASE 5 ────────────────────────────── */}
      <BudgetHealthPanel
        projectId={activeProjectId}
        projectBudget={activeProject.budget ?? 0}
      />


      <div className="min-h-[420px]">{renderContent()}</div>
    </div>
  )
}
