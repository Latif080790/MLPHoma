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
import CurvaSChart from '../../components/charts/CurvaSChart'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { Card, CardContent } from '../../components/ui/card'
import { Alert, AlertDescription } from '../../components/ui/alert'
import { Download, LineChart, Play, Rocket, RefreshCw, AlertTriangle, Rows } from 'lucide-react'
import { downloadCSV, formatDate } from '../../lib/utils'

/** Stable empty array reference to avoid new [] creation in selectors/defaults. */
const EMPTY_POINTS: any[] = Object.freeze([]) as unknown as any[]

/**
 * CurvaSPage
 * Page-level component orchestrating Curva-S data and analysis.
 */
export default function CurvaSPage() {
  const activeProject = useProjectStore((s) => s.getActiveProject())
  const projectId = activeProject?.id || ''
  const projectName = activeProject?.name || '—'
  const projectBudget = activeProject?.budget || 0

  // Curva-S store selections (do not create new arrays/objects)
  const dataPoints = useCurvaSStore((s) => (projectId ? s.dataPoints[projectId] : undefined)) || EMPTY_POINTS
  const analysis = useCurvaSStore((s) => (projectId ? s.analyses[projectId] || null : null))
  const config = useCurvaSStore((s) => (projectId ? s.configs[projectId] || null : null))

  const generateBaseline = useCurvaSStore((s) => s.generateBaseline)
  const analyzeProject = useCurvaSStore((s) => s.analyzeProject)
  const setPlannedFromRap = useCurvaSStore((s) => s.setPlannedFromRap)

  // RAP store accessor
  const getRapPlan = useRapStore((s) => s.getPlan)

  // UI state toggles
  const [type, setType] = useState<'progress' | 'cost'>('progress')
  const [showPlanned, setShowPlanned] = useState(true)
  const [showActual, setShowActual] = useState(true)
  const [showForecast, setShowForecast] = useState(true)
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

  /** Import planned/actual curve from RAP monthly schedule, then analyze once */
  const handleImportFromRAP = () => {
    if (!projectId) return
    const rapPlan = getRapPlan(projectId)
    if (!rapPlan || rapPlan.length === 0) return
    const fallbackBudget = rapPlan.reduce((sum: number, p: any) => sum + (p.planned || 0), 0)
    setPlannedFromRap(projectId, rapPlan as any, projectBudget || fallbackBudget)
    setTimeout(() => analyzeProject(projectId), 0)
  }

  /** Export current series to CSV */
  const handleExport = () => {
    if (!projectId || !dataPoints.length) return
    downloadCSV(
      dataPoints.map((d: any) => ({
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
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => handleImportFromRAP()}>
              Import from RAP
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
            No baseline found. Click "Import from RAP" to load planned curve from RAP schedule, or use "Generate Baseline".
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
      </div>

      <CurvaSChart
        data={dataPoints}
        analysis={analysis}
        showPlanned={showPlanned}
        showActual={showActual}
        showForecast={showForecast}
        height={420}
        type={type}
        theme="default"
        denseMode={denseMode}
      />

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
