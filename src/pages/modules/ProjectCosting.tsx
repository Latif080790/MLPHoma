/**
 * ProjectCosting v2.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Integrated costing workspace: AHSP → WBS → RAB → RAP → Resource
 * 
 * REDESIGNED with enterprise design system:
 *   L1: GlobalContextBar  → project context + health
 *   L2: WorkflowStepper   → 5-step costing pipeline (replaces CostingFlowIndicator)
 *   L3: WorkspaceHeader   → title + active step description
 *   L4: SummaryStrip      → budget health KPIs
 *   Alert: AlertStrip     → empty-data warnings
 *   L6: Step Content      → lazy-loaded submodule
 */

import React, { Suspense, useState, useEffect, useMemo } from 'react'
import { Calculator, BookOpen, GitBranch, DollarSign, BarChart2, Wrench, Plus, Settings2 } from 'lucide-react'
import ModulePageState from '@/components/common/ModulePageState'
import { BudgetHealthPanel } from '@/components/modules/BudgetHealthPanel'
import { useProjectStore } from '@/store/projectStore'
import { useWBSStore } from '@/store/wbsStore'
import { useRabStore } from '@/store/rabStore'
import { useRapStore } from '@/store/rapStore'
import { useAHSPStore } from '@/store/ahspStore'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { lazyRetry } from '@/lib/lazyRetry'

// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, WorkflowStepper, SummaryStrip, AlertStrip } from '@/components/patterns'

const AHSP = lazyRetry(() => import('@/pages/modules/AHSP/index'))
const WBS = lazyRetry(() => import('@/pages/modules/WBS'))
const RAB = lazyRetry(() => import('@/pages/modules/RAB'))
const RAP = lazyRetry(() => import('@/pages/modules/RAP'))
const ResourcePlan = lazyRetry(() => import('@/pages/modules/ResourcePlan'))

type CostingStep = 'ahsp' | 'wbs' | 'rab' | 'rap' | 'resource'

// ─── Step Pipeline Configuration ────────────────────────────────────────────
const STEP_CONFIG: Array<{
  id: CostingStep
  label: string
  description: string
  icon: React.ReactNode
}> = [
  { id: 'ahsp', label: 'AHSP', description: 'Katalog harga satuan pekerjaan', icon: <BookOpen size={14} /> },
  { id: 'wbs', label: 'WBS', description: 'Struktur pekerjaan & hierarki', icon: <GitBranch size={14} /> },
  { id: 'rab', label: 'RAB', description: 'Rencana anggaran biaya baseline', icon: <DollarSign size={14} /> },
  { id: 'rap', label: 'RAP', description: 'Anggaran pelaksanaan operasional', icon: <BarChart2 size={14} /> },
  { id: 'resource', label: 'Resource', description: 'Perencanaan kebutuhan resource', icon: <Wrench size={14} /> },
]

// ─── TabFallback ─────────────────────────────────────────────────────────────
function TabFallback() {
  return (
    <div className="space-y-space-3 p-padding-md">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="h-8 animate-pulse rounded-radius-sm bg-surface-subtle" style={{ width: `${85 - i * 10}%` }} />
      ))}
    </div>
  )
}

export default function ProjectCosting() {
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const projects = useProjectStore(s => s.projects)
  const [activeStep, setActiveStep] = useState<CostingStep>('ahsp')
  const [srStatus, setSrStatus] = useState('AHSP step opened.')

  // Store selectors — primitive values to avoid re-render loops
  const ahspCount = useAHSPStore(s => s.ahspItems.length)
  const wbsByProj = useWBSStore(s => s.itemsByProject)
  const rabByProj = useRabStore(s => s.itemsByProject)
  const rapItems = useRapStore(s => s.items)

  // Proactive fetching
  const { fetchItems: fetchWbs } = useWBSStore()
  const { fetchItems: fetchRab } = useRabStore()
  const { fetchItems: fetchRap } = useRapStore()

  useEffect(() => {
    if (activeProjectId) {
      if (!wbsByProj[activeProjectId]) fetchWbs(activeProjectId).catch(console.error)
      if (!rabByProj[activeProjectId]) fetchRab(activeProjectId).catch(console.error)
      fetchRap(activeProjectId).catch(console.error)
    }
  }, [activeProjectId, fetchWbs, fetchRab, fetchRap])

  const activeProject = activeProjectId ? projects[activeProjectId] : null

  // ─── Compute step counts & states ─────────────────────────────────────────
  const wbsCount = activeProjectId ? (wbsByProj[activeProjectId]?.length ?? 0) : 0
  const rabCount = activeProjectId ? (rabByProj[activeProjectId]?.length ?? 0) : 0
  const rapCount = activeProjectId ? rapItems.filter(i => i.project_id === activeProjectId).length : 0

  const workflowSteps = useMemo(() => {
    const counts: Record<CostingStep, number | null> = {
      ahsp: ahspCount,
      wbs: wbsCount,
      rab: rabCount,
      rap: rapCount,
      resource: null,
    }

    return STEP_CONFIG.map(step => {
      const count = counts[step.id]
      const hasData = count === null || count > 0
      const isActive = activeStep === step.id

      // Determine step status
      let status: 'inactive' | 'active' | 'complete' | 'warning' = 'inactive'
      if (isActive) status = 'active'
      else if (!hasData && step.id !== 'resource') status = 'warning'
      else if (hasData && count !== null && count > 0) status = 'complete'

      return {
        id: step.id,
        title: step.label,
        description: count !== null ? `${count} items` : step.description,
        status,
        icon: step.icon,
        count: count ?? undefined,
      }
    })
  }, [activeStep, ahspCount, wbsCount, rabCount, rapCount])

  // ─── Summary Strip KPIs ───────────────────────────────────────────────────
  const summaryItems = useMemo(() => [
    { label: 'AHSP Items', value: ahspCount, status: ahspCount > 0 ? 'success' as const : 'warning' as const },
    { label: 'WBS Items', value: wbsCount, status: wbsCount > 0 ? 'success' as const : 'warning' as const },
    { label: 'RAB Lines', value: rabCount, status: rabCount > 0 ? 'success' as const : 'warning' as const },
    { label: 'RAP Lines', value: rapCount, status: rapCount > 0 ? 'success' as const : 'info' as const },
  ], [ahspCount, wbsCount, rabCount, rapCount])

  // ─── Empty step alerts ────────────────────────────────────────────────────
  const emptySteps = STEP_CONFIG
    .filter(s => s.id !== 'resource')
    .filter(s => stepCounts[s.id] === 0)
    .map(s => s.label)

  // ─── Guard: No active project ─────────────────────────────────────────────
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
    const stepLabel = STEP_CONFIG.find(s => s.id === stepId)?.label || stepId
    setSrStatus(`${stepLabel} step dibuka.`)
  }

  const currentStep = STEP_CONFIG.find(s => s.id === activeStep)!

  const renderContent = () => {
    const wrap = (label: string, Component: React.LazyExoticComponent<React.ComponentType>) => (
      <ErrorBoundary errorMessage={`${label} module failed to render`}>
        <Suspense fallback={<TabFallback />}>
          <Component />
        </Suspense>
      </ErrorBoundary>
    )
    switch (activeStep) {
      case 'ahsp': return wrap('AHSP', AHSP as React.LazyExoticComponent<React.ComponentType>)
      case 'wbs': return wrap('WBS', WBS as React.LazyExoticComponent<React.ComponentType>)
      case 'rab': return wrap('RAB', RAB as React.LazyExoticComponent<React.ComponentType>)
      case 'rap': return wrap('RAP', RAP as React.LazyExoticComponent<React.ComponentType>)
      case 'resource': return wrap('Resource Plan', ResourcePlan as React.LazyExoticComponent<React.ComponentType>)
    }
  }

  return (
    <PageShell
      contextBar={
        <GlobalContextBar
          projectName={activeProject.name}
          packageName={activeProject.code || undefined}
          versionLabel={activeProject.status || undefined}
          syncStatus="synced"
          healthItems={[
            {
              label: 'Pipeline',
              level: emptySteps.length === 0 ? 'good' : emptySteps.length <= 2 ? 'warning' : 'critical',
              value: `${4 - emptySteps.length}/4`,
            },
          ]}
        />
      }
      navigation={
        <WorkflowStepper
          steps={workflowSteps}
          activeStepId={activeStep}
          onStepClick={handleStepChange}
        />
      }
      header={
        <WorkspaceHeader
          title={`Costing — ${currentStep.label}`}
          subtitle={currentStep.description}
          primaryAction={{
            label: 'New Item',
            icon: <Plus className="h-3.5 w-3.5" />,
            onClick: () => { /* handled by submodule */ },
          }}
        />
      }
      summary={
        <SummaryStrip items={summaryItems} variant="chips" />
      }
      alert={
        emptySteps.length > 0 ? (
          <AlertStrip
            severity="info"
            message={`${emptySteps.join(', ')} belum memiliki data — mulai dari ${emptySteps[0]} untuk melengkapi pipeline`}
          />
        ) : undefined
      }
    >
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

      {/* Budget Health KPIs */}
      <BudgetHealthPanel
        projectId={activeProjectId}
        projectBudget={activeProject.budget ?? 0}
      />

      {/* Step Content */}
      <div className="min-h-[420px] mt-[var(--space-4)]">
        {renderContent()}
      </div>
    </PageShell>
  )
}
