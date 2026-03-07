import React, { Suspense, useState, useMemo } from 'react'
import { Calculator, BookOpen, GitBranch, DollarSign, BarChart2, Wrench, ChevronRight, Settings2, RotateCcw, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import ModulePageState from '@/components/common/ModulePageState'
import { BudgetHealthPanel } from '@/components/modules/BudgetHealthPanel'
import { useProjectStore } from '@/store/projectStore'
import { useWBSStore } from '@/store/wbsStore'
import { useRabStore } from '@/store/rabStore'
import { useRapStore } from '@/store/rapStore'
import { useAHSPStore } from '@/store/ahspStore'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'

const AHSP = React.lazy(() => import('@/pages/modules/AHSP/index'))
const WBS = React.lazy(() => import('@/pages/modules/WBS'))
const RAB = React.lazy(() => import('@/pages/modules/RAB'))
const RAP = React.lazy(() => import('@/pages/modules/RAP'))
const ResourcePlan = React.lazy(() => import('@/pages/modules/ResourcePlan'))

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

// ─── CostingConfigPanel ─────────────────────────────────────────────────────
/**
 * Inline panel for setting project-level markup parameters:
 *   overheadPercent, profitPercent, taxPercent, profitBasis
 *
 * Saved to project.meta.costingConfig — consumed by:
 *   - RAPGeneratorSimple (markupConfig for distributeVolumeByTasks)
 *   - CurvaS (Import dari RAB)
 *   - ResourcePlan visualizations (future)
 */
function CostingConfigPanel({ projectId }: { projectId: string }) {
  const project = useProjectStore(s => s.projects[projectId])
  const updateProject = useProjectStore(s => s.updateProject)

  const cc = (project?.meta?.costingConfig as {
    overheadPercent?: number
    profitPercent?: number
    taxPercent?: number
    profitBasis?: string
  } | undefined) ?? {}

  const [oh, setOh] = useState(String(cc.overheadPercent ?? 0))
  const [profit, setProfit] = useState(String(cc.profitPercent ?? 0))
  const [tax, setTax] = useState(String(cc.taxPercent ?? 11))
  const [basis, setBasis] = useState<string>(cc.profitBasis ?? 'base_plus_overhead')
  const [open, setOpen] = useState(false)

  const handleSave = () => {
    updateProject(projectId, {
      meta: {
        ...project?.meta,
        costingConfig: {
          overheadPercent: parseFloat(oh) || 0,
          profitPercent: parseFloat(profit) || 0,
          taxPercent: parseFloat(tax) || 11,
          profitBasis: basis,
        },
      },
    })
    toast.success('Markup config tersimpan')
    setOpen(false)
  }

  const handleReset = () => {
    setOh('0'); setProfit('0'); setTax('11'); setBasis('base_plus_overhead')
  }

  const hasCfg = (cc.overheadPercent || 0) > 0 || (cc.profitPercent || 0) > 0

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
      >
        <Settings2 size={12} />
        <span>Markup Config</span>
        {hasCfg && (
          <span className="ml-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 px-1.5 py-0 text-xs font-bold">
            OH {cc.overheadPercent ?? 0}% · P {cc.profitPercent ?? 0}%
          </span>
        )}
      </button>

      {open && (
        <Card className="mt-2 border-slate-200 dark:border-slate-700">
          <CardContent className="p-4">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Project Markup Config
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Overhead %</label>
                <Input
                  type="number" min="0" max="100" step="0.5"
                  value={oh}
                  onChange={e => setOh(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Profit %</label>
                <Input
                  type="number" min="0" max="100" step="0.5"
                  value={profit}
                  onChange={e => setProfit(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Tax (PPN) %</label>
                <Input
                  type="number" min="0" max="100" step="0.5"
                  value={tax}
                  onChange={e => setTax(e.target.value)}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-slate-500">Profit Basis</label>
                <Select value={basis} onValueChange={setBasis}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="base_plus_overhead">Base + OH (SNI)</SelectItem>
                    <SelectItem value="base">Base only</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* ── Semantic guidance: RAB vs RAP price semantics ── */}
            {!parseFloat(oh) && !parseFloat(profit) ? (
              <div className="flex items-start gap-2 rounded-md bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-800 dark:bg-amber-900/20 dark:border-amber-700 dark:text-amber-300 mt-3">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                <div>
                  <div className="font-semibold">Markup belum dikonfigurasi</div>
                  <div className="mt-0.5 text-amber-700 dark:text-amber-400">
                    Saat OH% = 0 dan Profit% = 0, harga RAP akan sama dengan RAB &mdash; tidak ada selisih margin.
                    Set OH% &amp; Profit% untuk memisahkan <strong>biaya produksi (RAP)</strong> dari <strong>harga kontrak (RAB)</strong>.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-md bg-emerald-50 border border-emerald-200 p-2 text-xs text-emerald-800 dark:bg-emerald-900/20 dark:border-emerald-700 dark:text-emerald-300 mt-3">
                <CheckCircle2 size={13} className="shrink-0" />
                <span>RAB = harga kontrak (AHSP base + OH + Profit + PPN) &nbsp;&middot;&nbsp; RAP = biaya produksi (AHSP base price saja).</span>
              </div>
            )}

            <div className="flex items-center gap-2 mt-3">
              <Button size="sm" onClick={handleSave} className="h-7 text-xs">Simpan</Button>
              <Button size="sm" variant="ghost" onClick={handleReset} className="h-7 text-xs gap-1">
                <RotateCcw size={11} /> Reset
              </Button>
              <span className="ml-auto text-xs text-slate-400">
                RAB = harga kontrak &nbsp;&middot;&nbsp; RAP = biaya produksi
              </span>
            </div>
          </CardContent>
        </Card>
      )}
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

      {/* ── Markup Config ───────────────────────────────────────────── */}
      <CostingConfigPanel key={activeProjectId} projectId={activeProjectId} />

      <div className="min-h-[420px]">{renderContent()}</div>
    </div>
  )
}
