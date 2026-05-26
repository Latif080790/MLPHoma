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

  return (
    <div className="flex flex-col h-full overflow-hidden bg-slate-50">
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

      {/* ── L1: CommandBar ──────────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 h-12 flex items-center px-4 z-10 relative overflow-hidden"
        style={{
          background: 'linear-gradient(180deg, #0e1628 0%, #0b1120 100%)',
          boxShadow: 'inset 0 -1px 0 rgba(234,88,12,0.18), 0 1px 0 rgba(0,0,0,0.4)',
        }}
      >
        {/* Scan-line texture — technical grid feel */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none select-none"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px)',
            backgroundSize: '100% 8px',
          }}
        />

        {/* Left: project identity */}
        <div className="flex items-center gap-3 flex-1 min-w-0 relative">
          {/* Code callsign — no box, just pure orange mono */}
          {activeProject.code && (
            <span
              className="flex-shrink-0 font-mono text-xs font-bold tracking-[0.12em] border-l-2 pl-2 leading-none"
              style={{ color: '#f97316', borderColor: 'rgba(249,115,22,0.7)' }}
            >
              {activeProject.code}
            </span>
          )}

          {/* Thin separator */}
          <div className="w-px h-4 flex-shrink-0" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Project name */}
          <span className="text-sm font-semibold tracking-tight truncate" style={{ color: 'rgba(248,250,252,0.92)' }}>
            {activeProject.name}
          </span>

          {/* Pipeline segment progress */}
          <div className="hidden sm:flex items-center gap-1 flex-shrink-0 ml-1" role="progressbar" aria-label={`Pipeline ${4 - emptySteps.length}/4 complete`}>
            {STEP_CONFIG.filter(s => s.id !== 'resource').map(step => {
              const done = stepCounts[step.id] > 0
              return (
                <div
                  key={step.id}
                  title={`${step.label}: ${done ? 'complete' : 'empty'}`}
                  className="transition-all duration-500"
                  style={{
                    width: 20,
                    height: 2,
                    borderRadius: 1,
                    background: done ? '#f97316' : 'rgba(255,255,255,0.12)',
                    boxShadow: done ? '0 0 6px rgba(249,115,22,0.5)' : 'none',
                  }}
                />
              )
            })}
            <span
              className="text-xs font-mono ml-1.5 font-bold tabular-nums"
              style={{ color: 'rgba(255,255,255,0.28)', letterSpacing: '0.05em' }}
            >
              {4 - emptySteps.length}/4
            </span>
          </div>
        </div>

        {/* Right: status + sync */}
        <div className="flex items-center gap-3 flex-shrink-0 relative">
          {/* Project status label */}
          {activeProject.status && (
            <span
              className="hidden lg:block text-xs font-mono uppercase"
              style={{ color: 'rgba(255,255,255,0.22)', letterSpacing: '0.1em' }}
            >
              {activeProject.status}
            </span>
          )}

          {/* Thin separator */}
          <div className="hidden lg:block w-px h-4" style={{ background: 'rgba(255,255,255,0.08)' }} />

          {/* Sync indicator */}
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0" aria-hidden="true">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-50" style={{ background: '#4ade80' }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: '#22c55e' }} />
            </span>
            <span
              className="text-xs font-mono font-bold tracking-widest"
              style={{ color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em' }}
            >
              LIVE
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              if (activeProjectId) {
                fetchSnapshot(activeProjectId).catch((e: unknown) => handleError(e, 'network.fetch'))
              }
            }}
            className="transition-colors rounded p-0.5"
            style={{ color: 'rgba(255,255,255,0.2)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.5)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,255,255,0.2)')}
            aria-label="Refresh cost data"
            title="Refresh cost data"
          >
            <RefreshCw size={11} />
          </button>
        </div>
      </div>

      {/* ── L2: UnifiedTabBar ───────────────────────────────────────────────── */}
      <div
        className="flex-shrink-0 flex items-stretch h-10 overflow-x-auto z-10"
        style={{ background: '#f4f6fb', borderBottom: '1px solid #e2e6ef' }}
      >
        {/* Dashboard */}
        <button
          type="button"
          onClick={() => setActiveMode('dashboard')}
          className={`flex items-center gap-1.5 px-4 h-full text-xs font-semibold flex-shrink-0 transition-all relative ${
            activeMode === 'dashboard'
              ? 'text-[#ea6b0a] bg-white'
              : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
          }`}
          style={activeMode === 'dashboard' ? { boxShadow: 'inset 0 -2px 0 #f97316' } : {}}
        >
          <BarChart2 size={12} />
          Dashboard
        </button>

        {/* Separator + Pipeline label */}
        <div className="flex items-center gap-0 flex-shrink-0">
          <div className="w-px h-5 mx-2" style={{ background: '#dde1ea' }} />
          <span className="text-xs font-bold uppercase tracking-[0.1em] text-slate-400/70 pr-2 leading-none">Pipeline</span>
        </div>

        {/* Step tabs */}
        {STEP_CONFIG.map((step, i) => {
          const count   = stepCounts[step.id]
          const hasData = step.id === 'resource' || count > 0
          const isActive = activeMode === 'pipeline' && activeStep === step.id
          return (
            <React.Fragment key={step.id}>
              {i > 0 && (
                <div className="flex items-center flex-shrink-0" style={{ color: '#c8cedc', padding: '0 2px' }}>
                  <ArrowRight size={10} />
                </div>
              )}
              <button
                type="button"
                onClick={() => handleStepChange(step.id)}
                className={`flex items-center gap-1.5 px-3 h-full text-xs font-medium flex-shrink-0 transition-all relative ${
                  isActive ? 'text-slate-900 bg-white' : 'text-slate-500 hover:text-slate-700 hover:bg-white/60'
                }`}
                style={isActive ? { boxShadow: 'inset 0 -2px 0 #f97316' } : {}}
              >
                <span style={{ color: isActive ? '#f97316' : '#94a3b8' }}>{step.icon}</span>
                {step.label}
                {step.id !== 'resource' && (
                  <span
                    className="flex items-center justify-center w-3.5 h-3.5 rounded-full flex-shrink-0"
                    style={hasData
                      ? { background: 'rgba(34,197,94,0.12)', color: '#16a34a' }
                      : { background: 'rgba(245,158,11,0.12)', color: '#d97706' }
                    }
                  >
                    {hasData ? <CheckCircle2 size={9} /> : <span className="font-black leading-none" style={{ fontSize: 9 }}>!</span>}
                  </span>
                )}
              </button>
            </React.Fragment>
          )
        })}
      </div>

      {/* ── L3: BudgetStrip (pipeline only) ────────────────────────────────── */}
      {activeMode === 'pipeline' && (
        <div
          className="flex-shrink-0 grid grid-cols-4"
          style={{ borderBottom: '1px solid #e2e6ef', background: '#f8f9fd' }}
        >
          {budgetCells.map((cell, i) => (
            <div
              key={cell.label}
              className="flex flex-col justify-center px-3 py-2"
              style={i > 0 ? { borderLeft: '1px solid #e2e6ef' } : {}}
            >
              <div
                className="text-xs font-bold uppercase leading-none mb-0.5"
                style={{ color: '#9aa3b5', letterSpacing: '0.08em' }}
              >
                {cell.label}
              </div>
              <div
                className="text-sm font-bold font-mono leading-tight"
                style={{ color: cell.warn ? '#dc2626' : '#1e293b' }}
              >
                {cell.value}
              </div>
              <div className="text-xs truncate leading-none mt-0.5" style={{ color: '#9aa3b5' }}>
                {cell.sub}
              </div>
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
