/**
 * CurvaS.tsx
 * Curva-S module page:
 * - Visualize planned vs actual S-curve (progress/cost)
 * - Generate baseline from budget and period
 * - Import from RAP schedule (monthly) to create planned/actual cumulative curves
 * - Manual analysis trigger (no auto-effect to prevent update-depth loops)
 * - Export CSV of data points
 * - Dense mode for long x-axis series
 *
 * Change log:
 * - Added "Import from RAP" action which reads rapStore plan and feeds Curva-S store (setPlannedFromRap).
 * - Still avoids auto-analyze loops: schedule analyze once after import/generation.
 */

import React, { useState } from 'react'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { useProjectStore } from '../../store/projectStore'
import { useCurvaSStore } from '../../store/curvaSStore'
import { useRapStore } from '../../store/rapStore'
import { useRabStore } from '../../store/rabStore'
import { useTimelineStore } from '../../store/timelineStore'
import { useAHSPStore } from '../../store/ahspStore'
import CurvaSChart from '../../components/charts/CurvaSChart'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent } from '../../components/ui/card'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Download, LineChart, Play, Rocket, RefreshCw, AlertTriangle, Rows, GitPullRequest, Table2 } from 'lucide-react'
import { downloadCSV, formatDate } from '../../lib/utils'
import { shadowCurveService } from '../../services/shadowCurveService'
import { distributeVolumeByTasks } from '../../lib/rapUtils'
import type { ScheduleTask } from '../../lib/rapUtils'
import { calculateUnifiedSchedule } from '../../lib/unifiedSchedule'
import { toast } from 'sonner'
import type { CurvaSDataPoint } from '../../types/curvaS'

/** Stable empty array reference to avoid new [] creation in selectors/defaults. */
const EMPTY_POINTS: CurvaSDataPoint[] = []

/**
 * CurvaSPage
 * Page-level component orchestrating Curva-S data and analysis.
 */
export default function CurvaSPage() {
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const activeProject = useProjectStore(s => activeProjectId ? s.projects[activeProjectId] : null)
  const projectId = activeProject?.id || ''
  const projectBudget = activeProject?.budget || 0

  // Curva-S store selections (do not create new arrays/objects)
  const dataPoints = useCurvaSStore((s) => (projectId ? s.dataPoints[projectId] : undefined)) || EMPTY_POINTS
  const analysis = useCurvaSStore((s) => (projectId ? s.analyses[projectId] || null : null))
  const config = useCurvaSStore((s) => (projectId ? s.configs[projectId] || null : null))

  const generateBaseline = useCurvaSStore((s) => s.generateBaseline)
  const analyzeProject = useCurvaSStore((s) => s.analyzeProject)
  const setPlannedFromRap = useCurvaSStore((s) => s.setPlannedFromRap)

  // Storage accessors
  const getRapPlan = useRapStore((s) => s.getPlan)
  const getRabItems = useRabStore((s) => s.getItems)
  const getTasks = useTimelineStore((s) => s.getTasks)
  const ahspItems = useAHSPStore((s) => s.ahspItems)
  const componentsByAHSP = useAHSPStore((s) => s.componentsByAHSP)

  // UI state toggles
  const [type, setType] = useState<'progress' | 'cost'>('progress')
  const [showPlanned, setShowPlanned] = useState(true)
  const [showActual, setShowActual] = useState(true)
  const [showForecast, setShowForecast] = useState(true)
  const [showShadow, setShowShadow] = useState(false)
  const [denseMode, setDenseMode] = useState(false)

  // Handlers
  /**
   * Create an even-distributed baseline from today to +6 months.
   * After baseline is set, run analysis once (scheduled) to avoid same-tick update loops.
   */
  const handleGenerateBaseline = () => {
    if (!projectId) return
    const start = new Date()
    const end = new Date()
    end.setMonth(end.getMonth() + 6) // default 6 months
    generateBaseline(projectId, projectBudget || 0, formatDate(start), formatDate(end))
    // Schedule analysis after state settles to avoid chained passive updates
    setTimeout(() => analyzeProject(projectId), 0)
  }

  /** Run analysis on demand */
  const handleAnalyze = () => {
    if (!projectId) return
    analyzeProject(projectId)
  }

  /**
   * Sync planned curve computed meticulously from unifiedSchedule.ts
   * This respects overlap dependencies, lags, and exact daily volumes.
   */
  const handleSyncSchedule = () => {
    if (!projectId) return
    const rabItems = getRabItems(projectId)
    const tasks = getTasks(projectId)

    if (rabItems.length === 0 || tasks.length === 0) {
      toast.error('Gagal Sinkron', { description: 'Pastikan RAB dan Timeline sudah terisi.' })
      return
    }

    const ahspMap = new Map(ahspItems.map(a => [a.id, a]))
    const { costSchedule } = calculateUnifiedSchedule(rabItems, tasks, ahspMap, componentsByAHSP, 'month')

    if (costSchedule.length === 0) {
      toast.error('Jadwal kosong. Pastikan item timeline terhubung dengan ID RAB.')
      return
    }

    // Convert TimePhasedCost into CurvaS period plan mapping
    const curvaPlan = costSchedule.map(cs => ({
      period: cs.period,
      planned: cs.totalCost,
      actual: 0 // Actual comes from progress logs, not schedule
    }))

    const totalVal = curvaPlan.reduce((s, p) => s + p.planned, 0)
    setPlannedFromRap(projectId, curvaPlan, projectBudget || totalVal)
    setTimeout(() => analyzeProject(projectId), 0)

    toast.success(
      `S-Curve Tersinkronisasi`,
      { description: `RP ${Math.round(totalVal).toLocaleString('id-ID')} terdistribusi ke ${curvaPlan.length} bulan sesuai Timeline.` }
    )
  }

  /** Export current series to CSV */
  const handleExport = () => {
    if (!projectId || !dataPoints.length) return
    downloadCSV(
      dataPoints.map((d: CurvaSDataPoint) => ({
        date: d.date,
        plannedProgress: d.plannedProgress,
        actualProgress: d.actualProgress,
        plannedCost: d.plannedCost,
        actualCost: d.actualCost,
        plannedVolume: d.plannedVolume ?? '',
        actualVolume: d.actualVolume ?? '',
      })),
      `curva-s-${projectId}`
    )
  }

  // Empty state when no active project
  if (!projectId) {
    return (
      <div className="space-y-6">
        <ModuleHeader
          icon={<LineChart size={18} />}
          title="Curva-S"
          description="Generate and analyze S-Curve from RAP or baseline."
        />
        <div className="rounded-xl border p-6 text-center dark:border-neutral-800">
          <p className="text-neutral-600 dark:text-neutral-300">Please select a project to view Curva-S.</p>
        </div>
      </div>
    )
  }

  const empty = !dataPoints || dataPoints.length === 0

  return (
    <div className="space-y-6">
      <ModuleHeader
        icon={<LineChart size={18} />}
        title="Curva-S"
        description="S-Curve visualization with planned vs actual and performance analysis."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setType(type === 'progress' ? 'cost' : 'progress')}>
              <Rocket size={16} className="mr-2" />
              {type === 'progress' ? 'Switch to Cost' : 'Switch to Progress'}
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setDenseMode((v) => !v)} title="Compress X-axis labels">
              <Rows size={16} className="mr-2" />
              {denseMode ? 'Dense X‑Axis: ON' : 'Dense X‑Axis: OFF'}
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => handleExport()} disabled={empty}>
              <Download size={16} className="mr-2" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => handleSyncSchedule()} disabled={empty && !projectBudget}>
              <Table2 size={14} className="mr-1.5" />
              Sync Unified Schedule
            </Button>
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => handleAnalyze()} disabled={empty}>
              <RefreshCw size={16} className="mr-2" />
              Analyze
            </Button>
            <Button size="sm" onClick={() => handleGenerateBaseline()}>
              <Play size={16} className="mr-2" />
              Generate Baseline
            </Button>
          </div>
        }
      />

      {/* Empty tips */}
      {empty && (
        <Alert className="mb-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            No baseline found. Click &quot;Import from RAP&quot; to load planned curve from RAP schedule, or use &quot;Generate Baseline&quot;.
          </AlertDescription>
        </Alert>
      )}

      {/* Toggles */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Badge
          variant={showPlanned ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setShowPlanned((v) => !v)}
        >
          Planned
        </Badge>
        <Badge
          variant={showActual ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setShowActual((v) => !v)}
        >
          Actual
        </Badge>
        <Badge
          variant={showForecast ? 'default' : 'outline'}
          className="cursor-pointer"
          onClick={() => setShowForecast((v) => !v)}
        >
          Forecast
        </Badge>
        <Badge
          variant={showShadow ? 'default' : 'outline'}
          className={`cursor-pointer ${showShadow ? 'bg-orange-600 hover:bg-orange-700 text-white' : ''}`}
          onClick={() => setShowShadow((v) => !v)}
        >
          Shadow (CCO)
        </Badge>
      </div>

      <CurvaSChart
        data={dataPoints}
        analysis={analysis}
        showPlanned={showPlanned}
        showActual={showActual}
        showForecast={showForecast}
        showShadow={showShadow}
        shadowData={showShadow ? shadowCurveService.calculateShadowCurve(projectId).points : undefined}
        height={420}
        type={type}
        theme="default"
        denseMode={denseMode}
      />

      {/* Shadow Curve Summary */}
      {showShadow && (() => {
        const summary = shadowCurveService.getSummary(projectId)
        return summary.approvedCcoCount > 0 ? (
          <Card className="border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-950/10">
            <CardContent className="p-4 flex items-center gap-4">
              <GitPullRequest className="text-orange-600 shrink-0" size={20} />
              <div className="flex-1 text-sm">
                <span className="font-semibold text-orange-800 dark:text-orange-400">
                  Shadow Curve Active — {summary.approvedCcoCount} CCO{summary.approvedCcoCount > 1 ? 's' : ''} Approved
                </span>
                <div className="flex gap-4 mt-1 text-xs text-orange-700/70 dark:text-orange-400/60">
                  <span>Cost Δ: {summary.totalCostDelta > 0 ? '+' : ''}Rp {summary.totalCostDelta.toLocaleString()}</span>
                  <span>Schedule Δ: {summary.totalScheduleDelta > 0 ? '+' : ''}{summary.totalScheduleDelta} days</span>
                  <span>Plan Deviation: {summary.planDeviationPercent > 0 ? '+' : ''}{summary.planDeviationPercent}%</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-200 dark:border-slate-800">
            <CardContent className="p-4 text-center text-xs text-slate-500">
              No approved CCOs — shadow curve matches original plan.
            </CardContent>
          </Card>
        )
      })()}

      {/* EVM KPI Dashboard */}
      {analysis && (
        <div className="mt-6 space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <LineChart size={18} className="text-blue-600" />
            Earned Value Management (EVM)
          </h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card className={analysis.metrics.spi < 1 ? 'border-red-200 bg-red-50/20 dark:bg-red-950/20' : 'border-green-200 bg-green-50/20 dark:bg-green-950/20'}>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-neutral-500 tracking-wider">SPI (Schedule)</p>
                <div className="flex items-end gap-2 mt-1">
                  <p className={`text-2xl font-bold ${analysis.metrics.spi < 1 ? 'text-red-600' : 'text-green-600'}`}>{analysis.metrics.spi.toFixed(2)}</p>
                  <Badge variant="outline" className={`h-5 text-[10px] ${analysis.metrics.spi < 1 ? 'text-red-600 border-red-200 bg-red-50' : 'text-green-600 border-green-200 bg-green-50'}`}>
                    {analysis.metrics.spi < 1 ? 'LATE' : 'ON-TRACK'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card className={analysis.metrics.cpi < 1 ? 'border-red-200 bg-red-50/20 dark:bg-red-950/20' : 'border-green-200 bg-green-50/20 dark:bg-green-950/20'}>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-neutral-500 tracking-wider">CPI (Cost)</p>
                <div className="flex items-end gap-2 mt-1">
                  <p className={`text-2xl font-bold ${analysis.metrics.cpi < 1 ? 'text-red-600' : 'text-green-600'}`}>{analysis.metrics.cpi.toFixed(2)}</p>
                  <Badge variant="outline" className={`h-5 text-[10px] ${analysis.metrics.cpi < 1 ? 'text-red-600 border-red-200 bg-red-50' : 'text-green-600 border-green-200 bg-green-50'}`}>
                    {analysis.metrics.cpi < 1 ? 'OVER-BUDGET' : 'UNDER-BUDGET'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-neutral-500 tracking-wider">Planned Value (PV)</p>
                <p className="text-lg font-bold text-sky-600 mt-1">Rp {analysis.metrics.plannedValue.toLocaleString('id-ID')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-neutral-500 tracking-wider">Earned Value (EV)</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">Rp {analysis.metrics.earnedValue.toLocaleString('id-ID')}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-semibold uppercase text-neutral-500 tracking-wider">Actual Cost (AC)</p>
                <p className="text-lg font-bold text-orange-600 mt-1">Rp {analysis.metrics.actualCost.toLocaleString('id-ID')}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Config quick glance */}
      {config && (
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Budget</p>
              <p className="text-lg font-semibold">{(config.totalBudget || 0).toLocaleString('id-ID')}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Total Duration (days)</p>
              <p className="text-lg font-semibold">{config.totalDuration}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">Progress Method</p>
              <p className="text-lg font-semibold capitalize">
                {String(config.progressMethod || 'even').replace('-', ' ')}
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
