/**
 * ProjectCosting v3 — Industrial Command Center layout
 * L1: CommandBar (dark)  — project identity + pipeline health
 * L2: UnifiedTabBar       — Dashboard | AHSP → WBS → RAB → RAP → Resource
 * L3: BudgetStrip         — 4-cell KPI (pipeline mode only)
 * L4: Content             — fills remaining viewport height
 */

import React, { Suspense, useState, useEffect, useMemo } from 'react'
import {
  Calculator, BookOpen, GitBranch, DollarSign, BarChart2, Wrench,
  ArrowRight, AlertCircle, CheckCircle2, RefreshCw,
} from 'lucide-react'
import ModulePageState from '@/components/common/ModulePageState'
import { useProjectStore } from '@/store/projectStore'
import { useWBSStore } from '@/store/wbsStore'
import { useRabStore } from '@/store/rabStore'
import { useRapStore } from '@/store/rapStore'
import { useAHSPStore } from '@/store/ahspStore'
import { useForecastStore } from '@/store/costForecastStore'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { lazyRetry } from '@/lib/lazyRetry'
import { useShallow } from 'zustand/react/shallow'
import { CostDashboardView } from '@/components/costing'
import { formatIDR } from '@/lib/utils'

const AHSP = lazyRetry(() => import('@/pages/modules/AHSP/index'))
const WBS = lazyRetry(() => import('@/pages/modules/WBS'))
const RAB = lazyRetry(() => import('@/pages/modules/RAB'))
const RAP = lazyRetry(() => import('@/pages/modules/RAP'))
const ResourcePlan = lazyRetry(() => import('@/pages/modules/ResourcePlan'))

type CostingStep = 'ahsp' | 'wbs' | 'rab' | 'rap' | 'resource'

const STEP_CONFIG: Array<{ id: CostingStep; label: string; description: string; icon: React.ReactNode }> = [
  { id: 'ahsp',     label: 'AHSP',     description: 'Katalog harga satuan pekerjaan',    icon: <BookOpen   size={12} /> },
  { id: 'wbs',      label: 'WBS',      description: 'Struktur pekerjaan & hierarki',     icon: <GitBranch  size={12} /> },
  { id: 'rab',      label: 'RAB',      description: 'Rencana anggaran biaya baseline',   icon: <DollarSign size={12} /> },
  { id: 'rap',      label: 'RAP',      description: 'Anggaran pelaksanaan operasional',  icon: <BarChart2  size={12} /> },
  { id: 'resource', label: 'Resource', description: 'Perencanaan kebutuhan resource',    icon: <Wrench     size={12} /> },
]

function TabFallback() {
  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="h-6 w-1/3 animate-pulse rounded bg-slate-100" />
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="h-8 animate-pulse rounded bg-slate-100" style={{ width: `${90 - i * 8}%` }} />
      ))}
      <div className="mt-4 h-48 animate-pulse rounded bg-slate-100 opacity-60" />
    </div>
  )
}

export default function ProjectCosting() {
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const projects        = useProjectStore(s => s.projects)
  const [activeStep, setActiveStep] = useState<CostingStep>('ahsp')
  const [activeMode, setActiveMode] = useState<'dashboard' | 'pipeline'>('dashboard')
  const [srStatus, setSrStatus]     = useState('AHSP step opened.')
  const { handleError } = useErrorHandler()

  const { snapshot, fetchSnapshot } = useForecastStore(
    useShallow(s => ({ snapshot: s.snapshot, fetchSnapshot: s.fetchSnapshot }))
  )

  const ahspCount = useAHSPStore(s => s.ahspItems.length)
  const wbsByProj = useWBSStore(s => s.itemsByProject)
  const rabByProj = useRabStore(s => s.itemsByProject)
  const rapItems  = useRapStore(s => s.items)

  const { fetchItems: fetchWbs } = useWBSStore()
  const { fetchItems: fetchRab } = useRabStore()
  const { fetchItems: fetchRap } = useRapStore()

  useEffect(() => {
    if (activeProjectId) {
      if (!wbsByProj[activeProjectId]) fetchWbs(activeProjectId).catch((e: unknown) => handleError(e, 'network.fetch'))
      if (!rabByProj[activeProjectId]) fetchRab(activeProjectId).catch((e: unknown) => handleError(e, 'network.fetch'))
      fetchRap(activeProjectId).catch((e: unknown) => handleError(e, 'network.fetch'))
      fetchSnapshot(activeProjectId).catch((e: unknown) => handleError(e, 'network.fetch'))
    }
  }, [activeProjectId, fetchWbs, fetchRab, fetchRap, fetchSnapshot])

  const activeProject = activeProjectId ? projects[activeProjectId] : null

  const wbsCount = activeProjectId ? (wbsByProj[activeProjectId]?.length ?? 0) : 0
  const rabCount = activeProjectId ? (rabByProj[activeProjectId]?.length ?? 0) : 0
  const rapCount = activeProjectId ? rapItems.filter(i => i.project_id === activeProjectId).length : 0

  const stepCounts: Record<CostingStep, number> = useMemo(() => ({
    ahsp: ahspCount, wbs: wbsCount, rab: rabCount, rap: rapCount, resource: 1,
  }), [ahspCount, wbsCount, rabCount, rapCount])

  const emptySteps = useMemo(() =>
    STEP_CONFIG.filter(s => s.id !== 'resource' && stepCounts[s.id] === 0).map(s => s.label),
    [stepCounts]
  )

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

  const handleStepChange = (stepId: string) => {
    setActiveStep(stepId as CostingStep)
    setActiveMode('pipeline')
    setSrStatus(`${STEP_CONFIG.find(s => s.id === stepId)?.label ?? stepId} step dibuka.`)
  }

  const renderContent = () => {
    const wrap = (
      label: string,
      Component: React.LazyExoticComponent<React.ComponentType>,
      props?: Record<string, unknown>
    ) => (
      <ErrorBoundary errorMessage={`${label} module failed to render`}>
        <Suspense fallback={<TabFallback />}>
          <Component {...(props ?? {})} />
        </Suspense>
      </ErrorBoundary>
    )
    switch (activeStep) {
      case 'ahsp':     return wrap('AHSP',          AHSP         as React.LazyExoticComponent<React.ComponentType>, { embedded: true })
      case 'wbs':      return wrap('WBS',           WBS          as React.LazyExoticComponent<React.ComponentType>, { embedded: true })
      case 'rab':      return wrap('RAB',           RAB          as React.LazyExoticComponent<React.ComponentType>, { embedded: true })
      case 'rap':      return wrap('RAP',           RAP          as React.LazyExoticComponent<React.ComponentType>, { embedded: true })
      case 'resource': return wrap('Resource Plan', ResourcePlan as React.LazyExoticComponent<React.ComponentType>, { embedded: true, onSwitchToRap: () => setActiveStep('rap') })
    }
  }

  // ── BudgetStrip data ──────────────────────────────────────────────────────
  const budget    = activeProject.budget ?? 0
  const rabPct    = budget > 0 && snapshot ? Math.round((snapshot.rabTotal    / budget) * 100) : null
  const actualPct = budget > 0 && snapshot ? Math.round((snapshot.actualCost  / budget) * 100) : null
  const cpi       = snapshot?.latestCpi ?? null

  const budgetCells: Array<{ label: string; value: string; sub: string; warn: boolean }> = [
    {
      label: 'Budget',
      value: budget > 0 ? formatIDR(budget) : '—',
      sub:   activeProject.status ?? 'Project',
      warn:  false,
    },
    {
      label: 'RAB / Budget',
      value: rabPct    !== null ? `${rabPct}%`    : '—',
      sub:   snapshot  ? formatIDR(snapshot.rabTotal)   : '—',
      warn:  rabPct    !== null && rabPct > 105,
    },
    {
      label: 'Actual Spent',
      value: actualPct !== null ? `${actualPct}%` : '—',
      sub:   snapshot  ? formatIDR(snapshot.actualCost) : '—',
      warn:  actualPct !== null && actualPct > 90,
    },
    {
      label: 'CPI',
      value: cpi !== null ? cpi.toFixed(2) : '—',
      sub:   cpi !== null ? (cpi >= 1 ? 'On Budget' : 'Over Budget') : 'No data',
      warn:  cpi !== null && cpi < 1,
    },
  ]

  const pipelineHealthBadge =
    emptySteps.length === 0 ? 'bg-emerald-500/20 text-emerald-400' :
    emptySteps.length <= 2  ? 'bg-amber-500/20  text-amber-400'   :
                               'bg-red-500/20    text-red-400'

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

      {/* ── L1: CommandBar ──────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 h-11 bg-slate-900 flex items-center px-4 gap-3 z-10">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm font-bold text-white truncate">{activeProject.name}</span>
          {activeProject.code && (
            <span className="px-1.5 py-0.5 rounded text-xs font-mono font-bold bg-nl-orange/20 text-nl-orange border border-nl-orange/30 flex-shrink-0 leading-none">
              {activeProject.code}
            </span>
          )}
          <span className={`px-1.5 py-0.5 rounded text-xs font-semibold flex-shrink-0 leading-none ${pipelineHealthBadge}`}>
            Pipeline {4 - emptySteps.length}/4
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-xs text-slate-400">Synced</span>
          <RefreshCw size={11} className="text-slate-500 ml-1" />
        </div>
      </div>

      {/* ── L2: UnifiedTabBar ───────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 flex items-stretch h-10 overflow-x-auto z-10">
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => setActiveMode('dashboard')}
          className={`flex items-center gap-1.5 px-4 h-full text-xs font-semibold border-r border-slate-200 flex-shrink-0 transition-colors ${
            activeMode === 'dashboard'
              ? 'text-nl-orange border-b-2 border-b-nl-orange bg-orange-50/50'
              : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
          }`}
        >
          <BarChart2 size={12} />
          Dashboard
        </button>

        {/* Pipeline label */}
        <div className="flex items-center px-3 flex-shrink-0">
          <span className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Pipeline</span>
        </div>

        {/* Step tabs */}
        {STEP_CONFIG.map((step, i) => {
          const count   = stepCounts[step.id]
          const hasData = step.id === 'resource' || count > 0
          const isActive = activeMode === 'pipeline' && activeStep === step.id
          return (
            <React.Fragment key={step.id}>
              {i > 0 && (
                <div className="flex items-center text-slate-300 flex-shrink-0 px-0.5">
                  <ArrowRight size={11} />
                </div>
              )}
              <button
                type="button"
                onClick={() => handleStepChange(step.id)}
                className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium flex-shrink-0 transition-colors ${
                  isActive
                    ? 'text-slate-900 border-b-2 border-b-nl-orange bg-slate-50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={isActive ? 'text-nl-orange' : 'text-slate-400'}>{step.icon}</span>
                {step.label}
                {step.id !== 'resource' && (
                  <span className={`w-4 h-4 rounded-full text-xs flex items-center justify-center flex-shrink-0 ${
                    hasData ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'
                  }`}>
                    {hasData ? <CheckCircle2 size={10} /> : '!'}
                  </span>
                )}
              </button>
            </React.Fragment>
          )
        })}
      </div>

      {/* ── L3: BudgetStrip (pipeline only) ────────────────────────────────── */}
      {activeMode === 'pipeline' && (
        <div className="flex-shrink-0 grid grid-cols-4 divide-x divide-slate-200 bg-white border-b border-slate-200">
          {budgetCells.map(cell => (
            <div key={cell.label} className="flex flex-col justify-center px-3 py-1.5">
              <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider leading-none mb-0.5">
                {cell.label}
              </div>
              <div className={`text-sm font-bold font-mono leading-tight ${cell.warn ? 'text-red-600' : 'text-slate-800'}`}>
                {cell.value}
              </div>
              <div className="text-xs text-slate-400 truncate leading-none mt-0.5">{cell.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* ── L4: Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        {activeMode === 'dashboard' ? (
          <CostDashboardView />
        ) : (
          <>
            {emptySteps.length === 4 && (
              <div className="m-4 rounded-xl border border-dashed border-amber-300 bg-amber-50/60 p-5">
                <div className="flex items-start gap-3">
                  <AlertCircle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-amber-800">Pipeline Costing Belum Diisi</p>
                    <p className="text-xs text-amber-700">
                      Ikuti urutan berikut untuk membangun rencana anggaran proyek:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {STEP_CONFIG.filter(s => s.id !== 'resource').map((step, i, arr) => (
                        <React.Fragment key={step.id}>
                          <button
                            type="button"
                            onClick={() => handleStepChange(step.id)}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-amber-200 px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
                          >
                            {step.icon}
                            {step.label}
                          </button>
                          {i < arr.length - 1 && <ArrowRight size={12} className="text-amber-400 self-center" />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            {renderContent()}
          </>
        )}
      </div>
    </div>
  )
}
