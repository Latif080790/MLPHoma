/**
 * curvaSStore.ts
 *
 * Zustand store for Curva-S data and analysis.
 * - Adds stable savedScenarios API to store: getSavedScenarios/addSavedScenario/removeSavedScenario
 * - Idempotent updates to prevent render loops
 * - Baseline generation and SPI/CPI analysis with simple forecasts
 * - Stable getters (keep references when unchanged)
 *
 * Notes:
 * - All exported helpers are defensive and return default values when data is missing.
 */

import { create } from 'zustand'
import type { CurvaSDataPoint, CurvaSAnalysis } from '../types/curvaS'
import { notify as toast } from '@/lib/toast'
import { validate, mergeErrorMessages } from '@/lib/validationMiddleware'
import {
  curvaSDataPointInputSchema,
  curvaSBaselineConfigSchema,
  curvaSScenarioSchema,
} from '@/lib/validationSchemas'
import {
  syncCurvaSDataPoint,
  syncCurvaSAnalysis,
  syncCurvaSScenario,
} from '@/lib/supabaseSyncService'

/**
 * SavedScenario
 * Basic saved scenario meta used by CompareControls and CashFlow.
 */
export interface SavedScenario {
  /** Unique id */
  id: string
  /** Display name */
  name: string
  /** Down payment fraction 0..1 */
  dpPercent?: number
  /** Billing fraction 0..1 */
  billingPercent?: number
  /** Retention fraction 0..1 */
  retentionRate?: number
  /** Buffer amount in currency */
  bufferAmount?: number
}

/** Referensi stabil untuk array kosong agar selector/getter tidak membuat array baru setiap kali. */
const EMPTY_POINTS: CurvaSDataPoint[] = Object.freeze([]) as unknown as CurvaSDataPoint[]
const EMPTY_SCENARIOS: SavedScenario[] = Object.freeze([]) as unknown as SavedScenario[]

/** Store shape */
interface CurvaSState {
  dataPoints: Record<string, CurvaSDataPoint[]>
  analyses: Record<string, CurvaSAnalysis | null>
  configs: Record<string, { totalBudget: number; totalDuration: number; progressMethod?: string }>

  // Saved scenarios per project
  savedScenarios: Record<string, SavedScenario[]>

  // Actions
  generateBaseline: (projectId: string, totalBudget: number, startDate: string, endDate: string) => void
  analyzeProject: (projectId: string) => void
  addDataPoint: (projectId: string, point: CurvaSDataPoint) => void
  setPlannedFromRap: (
    projectId: string,
    rapPlan: Array<{ period: string; planned: number; actual?: number }>,
    totalBudget: number
  ) => void

  // Saved scenario actions
  addSavedScenario: (projectId: string, scenario: SavedScenario) => void
  removeSavedScenario: (projectId: string, scenarioId: string) => void

  // Getters (stable)
  getDataPoints: (projectId: string) => CurvaSDataPoint[]
  getAnalysis: (projectId: string) => CurvaSAnalysis | null
  getSavedScenarios: (projectId: string) => SavedScenario[]
}

function toDate(d: string): Date {
  return new Date(d + 'T00:00:00')
}

function generateMonthlyDates(start: string, end: string): string[] {
  const s = toDate(start)
  const e = toDate(end)
  const result: string[] = []
  const cur = new Date(s)
  cur.setDate(1)
  while (cur <= e) {
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const d = new Date(y, cur.getMonth() + 1, 0).getDate()
    result.push(`${y}-${m}-${String(d).padStart(2, '0')}`)
    cur.setMonth(cur.getMonth() + 1)
  }
  if (result.length === 0) result.push(start)
  if (result[result.length - 1] !== end) result[result.length - 1] = end
  return result
}

function isSamePoints(a: CurvaSDataPoint[], b: CurvaSDataPoint[]): boolean {
  if (a === b) return true
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) {
    const x = a[i]
    const y = b[i]
    if (
      x.date !== y.date ||
      (x.plannedProgress || 0) !== (y.plannedProgress || 0) ||
      (x.actualProgress || 0) !== (y.actualProgress || 0) ||
      (x.plannedCost || 0) !== (y.plannedCost || 0) ||
      (x.actualCost || 0) !== (y.actualCost || 0)
    ) {
      return false
    }
  }
  return true
}

function isSameAnalysis(a: CurvaSAnalysis | null, b: CurvaSAnalysis | null): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return (
    a.projectId === b.projectId &&
    a.currentProgress === b.currentProgress &&
    a.metrics.spi === b.metrics.spi &&
    a.metrics.cpi === b.metrics.cpi &&
    a.metrics.earnedValue === b.metrics.earnedValue &&
    a.metrics.plannedValue === b.metrics.plannedValue &&
    a.metrics.actualCost === b.metrics.actualCost &&
    a.status === b.status &&
    (a.forecastCompletionDate || '') === (b.forecastCompletionDate || '') &&
    (a.forecastTotalCost || 0) === (b.forecastTotalCost || 0) &&
    JSON.stringify(a.insights || []) === JSON.stringify(b.insights || [])
  )
}

function pointId(projectId: string, date: string) {
  return `${projectId}-${date}`
}

function computeAnalysis(
  projectId: string,
  points: CurvaSDataPoint[],
  config: { totalBudget: number; totalDuration: number } | undefined
): CurvaSAnalysis | null {
  if (!points || points.length === 0 || !config) return null
  const last = points[points.length - 1]
  const analysisDate = last.date
  const totalBudget = config.totalBudget || 0
  const plannedProgress = last.plannedProgress || 0
  const actualProgress = last.actualProgress || 0
  const AC = last.actualCost || 0
  const PV = (plannedProgress / 100) * (totalBudget || 1)
  const EV = (actualProgress / 100) * (totalBudget || 1)
  const spi = PV > 0 ? EV / PV : 1
  const cpi = AC > 0 ? EV / AC : 1
  const sv = EV - PV
  const cv = EV - AC
  const first = points[0]
  const daysElapsed =
    (toDate(last.date).getTime() - toDate(first.date).getTime()) / (1000 * 60 * 60 * 24)
  const progressRate = actualProgress > 0 && daysElapsed > 0 ? actualProgress / daysElapsed : 0
  const daysToGo = progressRate > 0 ? Math.ceil((100 - actualProgress) / progressRate) : 0
  const forecastDate = new Date(toDate(last.date))
  if (daysToGo > 0) forecastDate.setDate(forecastDate.getDate() + daysToGo)
  const eac = cpi > 0 ? totalBudget / cpi : totalBudget
  const etc = eac - AC
  const vac = totalBudget - eac
  let status: CurvaSAnalysis['status'] = 'on-track'
  if (cpi < 0.98) status = 'over-budget'
  else if (spi < 0.98) status = 'behind-schedule'
  else if (spi > 1.02) status = 'ahead-schedule'
  else if (cpi > 1.02) status = 'under-budget'
  const insights: string[] = []
  if (status === 'behind-schedule') insights.push('Schedule behind plan. Accelerate critical tasks.')
  if (status === 'over-budget') insights.push('Cost overrun detected. Review procurement and resource usage.')
  if (status === 'ahead-schedule') insights.push('Ahead of schedule. Re-balance resources if needed.')
  if (status === 'under-budget') insights.push('Under budget. Consider risk allowances.')
  return {
    projectId,
    currentProgress: actualProgress,
    metrics: {
      spi,
      cpi,
      earnedValue: Math.round(EV),
      plannedValue: Math.round(PV),
      actualCost: Math.round(AC),
      sv: Math.round(sv),
      cv: Math.round(cv),
      eac: Math.round(eac),
      etc: Math.max(0, Math.round(etc)),
      vac: Math.round(vac),
    },
    status,
    trend: spi > 1.01 || cpi > 1.01 ? 'improving' : spi < 0.99 || cpi < 0.99 ? 'declining' : 'stable',
    forecastCompletionDate: daysToGo > 0 ? forecastDate.toISOString().split('T')[0] : undefined,
    forecastTotalCost: Math.round(eac),
    analysisDate,
    insights,
  }
}

function periodToEndDate(period: string): string {
  const p = String(period || '').trim()
  const [y, m] = p.split('-')
  const year = Number(y)
  const month = Number(m)
  if (!Number.isFinite(year) || !Number.isFinite(month)) return p
  const lastDay = new Date(year, month, 0).getDate()
  const mm = String(month).padStart(2, '0')
  const dd = String(lastDay).padStart(2, '0')
  return `${year}-${mm}-${dd}`
}

/**
 * Create Curva-S store
 */
export const useCurvaSStore = create<CurvaSState>((set, get) => ({
  dataPoints: {},
  analyses: {},
  configs: {},

  // Saved scenarios storage (per project)
  savedScenarios: {},

  generateBaseline: (projectId, totalBudget, startDate, endDate) => {
    if (!projectId) return
    
    // Validate baseline config
    const validation = validate(curvaSBaselineConfigSchema, {
      projectId,
      totalBudget,
      startDate,
      endDate,
    })
    if (!validation.success) {
      toast.error('Baseline Validation Error', mergeErrorMessages(validation.errors))
      return
    }
    
    const dates = generateMonthlyDates(startDate, endDate)
    const stepProgress = 100 / Math.max(1, dates.length)
    const stepCost = totalBudget / Math.max(1, dates.length)
    let accProgress = 0
    let accCost = 0
    const nowIso = new Date().toISOString()
    const newPoints: CurvaSDataPoint[] = dates.map((d, idx) => {
      accProgress = idx === dates.length - 1 ? 100 : Math.min(100, accProgress + stepProgress)
      accCost = idx === dates.length - 1 ? totalBudget : accCost + stepCost
      return {
        id: pointId(projectId, d),
        projectId,
        date: d,
        plannedProgress: Number(accProgress.toFixed(2)),
        actualProgress: 0,
        plannedCost: Math.round(accCost),
        actualCost: 0,
        createdAt: nowIso,
        updatedAt: nowIso,
      }
    })
    const prevPoints = get().dataPoints[projectId] || EMPTY_POINTS
    const pointsUnchanged = isSamePoints(prevPoints, newPoints)
    const prevCfg = get().configs[projectId]
    const totalDuration =
      (toDate(endDate).getTime() - toDate(startDate).getTime()) / (1000 * 60 * 60 * 24)
    const cfgUnchanged =
      !!prevCfg &&
      prevCfg.totalBudget === totalBudget &&
      prevCfg.totalDuration === totalDuration &&
      (prevCfg.progressMethod || 'even') === 'even'
    if (pointsUnchanged && cfgUnchanged) return
    set((state) => ({
      dataPoints: {
        ...state.dataPoints,
        [projectId]: pointsUnchanged ? prevPoints : newPoints,
      },
      configs: {
        ...state.configs,
        [projectId]: { totalBudget, totalDuration, progressMethod: 'even' },
      },
    }))
    
    toast.success('Baseline generated successfully', `${newPoints.length} data points created`)
  },

  analyzeProject: (projectId) => {
    const points = get().dataPoints[projectId] || EMPTY_POINTS
    const cfg = get().configs[projectId]
    const next = computeAnalysis(projectId, points, cfg)
    const prev = get().analyses[projectId] || null
    if (isSameAnalysis(prev, next)) return
    set((state) => ({
      analyses: { ...state.analyses, [projectId]: next },
    }))
    
    // Sync analysis to Supabase if valid
    if (next) {
      syncCurvaSAnalysis(next)
    }
  },

  addDataPoint: (projectId, point) => {
    // Validate data point
    const validation = validate(curvaSDataPointInputSchema, {
      projectId,
      date: point.date,
      plannedProgress: point.plannedProgress,
      actualProgress: point.actualProgress,
      plannedCost: point.plannedCost,
      actualCost: point.actualCost,
    })
    if (!validation.success) {
      toast.error('Data Point Validation Error', mergeErrorMessages(validation.errors))
      return
    }
    
    set((state) => {
      const arr = [...(state.dataPoints[projectId] || EMPTY_POINTS)]
      const idx = arr.findIndex((p) => p.date === point.date)
      let savedPoint: CurvaSDataPoint
      if (idx >= 0) {
        savedPoint = {
          ...arr[idx],
          ...point,
          id: point.id || arr[idx].id || pointId(projectId, point.date),
          updatedAt: new Date().toISOString(),
        }
        arr[idx] = savedPoint
      } else {
        savedPoint = {
          ...point,
          id: point.id || pointId(projectId, point.date),
          createdAt: point.createdAt || new Date().toISOString(),
          updatedAt: point.updatedAt || new Date().toISOString(),
        }
        arr.push(savedPoint)
      }
      arr.sort((a, b) => a.date.localeCompare(b.date))
      if (isSamePoints(state.dataPoints[projectId] || EMPTY_POINTS, arr)) {
        return state
      }
      
      // Sync to Supabase
      syncCurvaSDataPoint(savedPoint)
      
      return {
        dataPoints: { ...state.dataPoints, [projectId]: arr },
      }
    })
  },

  setPlannedFromRap: (projectId, rapPlan, totalBudget) => {
    if (!projectId || !rapPlan || rapPlan.length === 0) return
    const plan = [...rapPlan].map((p) => ({
      period: String(p.period || '').trim(),
      planned: Number.isFinite(p.planned) ? Number(p.planned) : 0,
      actual: p.actual != null && Number.isFinite(p.actual) ? Number(p.actual) : 0,
    }))
    plan.sort((a, b) => a.period.localeCompare(b.period))
    const denominator = totalBudget > 0 ? totalBudget : plan.reduce((s, p) => s + (p.planned || 0), 0)
    let accPlanned = 0
    let accActual = 0
    const nowIso = new Date().toISOString()
    const points: CurvaSDataPoint[] = plan.map((p, idx) => {
      accPlanned += p.planned || 0
      accActual += p.actual || 0
      const date = periodToEndDate(p.period)
      const isLast = idx === plan.length - 1
      const plannedCost = isLast ? Math.max(accPlanned, denominator) : accPlanned
      const actualCost = accActual
      const plannedProgress = denominator > 0 ? Math.min(100, (plannedCost / denominator) * 100) : 0
      const actualProgress = denominator > 0 ? Math.min(100, (actualCost / denominator) * 100) : 0
      return {
        id: pointId(projectId, date),
        projectId,
        date,
        plannedProgress: Number(plannedProgress.toFixed(2)),
        actualProgress: Number(actualProgress.toFixed(2)),
        plannedCost: Math.round(plannedCost),
        actualCost: Math.round(actualCost),
        createdAt: nowIso,
        updatedAt: nowIso,
      }
    })
    const prev = get().dataPoints[projectId] || EMPTY_POINTS
    if (isSamePoints(prev, points)) return
    const start = points[0]?.date
    const end = points[points.length - 1]?.date
    const totalDuration =
      start && end ? (toDate(end).getTime() - toDate(start).getTime()) / (1000 * 60 * 60 * 24) : 0
    set((state) => ({
      dataPoints: { ...state.dataPoints, [projectId]: points },
      configs: {
        ...state.configs,
        [projectId]: { totalBudget: denominator, totalDuration: totalDuration || 1, progressMethod: 'rap' },
      },
    }))
  },

  // Saved scenario actions
  addSavedScenario: (projectId, scenario) => {
    if (!projectId || !scenario) return
    
    // Validate scenario
    const validation = validate(curvaSScenarioSchema, scenario)
    if (!validation.success) {
      toast.error('Scenario Validation Error', mergeErrorMessages(validation.errors))
      return
    }
    
    set((state) => {
      const prev = state.savedScenarios[projectId] || []
      // avoid duplicates by id
      if (prev.find((s) => s.id === scenario.id)) {
        toast.warning('Scenario already exists', scenario.name)
        return { savedScenarios: { ...state.savedScenarios, [projectId]: prev } }
      }
      const next = [...prev, scenario]
      
      // Sync to Supabase
      syncCurvaSScenario(scenario, projectId)
      
      toast.success('Scenario saved successfully', scenario.name)
      return { savedScenarios: { ...state.savedScenarios, [projectId]: next } }
    })
  },

  removeSavedScenario: (projectId, scenarioId) => {
    if (!projectId) return
    set((state) => {
      const prev = state.savedScenarios[projectId] || []
      const next = prev.filter((s) => s.id !== scenarioId)
      if (next.length === prev.length) return state
      return { savedScenarios: { ...state.savedScenarios, [projectId]: next } }
    })
  },

  getDataPoints: (projectId) => {
    return get().dataPoints[projectId] || EMPTY_POINTS
  },

  getAnalysis: (projectId) => {
    return get().analyses[projectId] || null
  },

  getSavedScenarios: (projectId) => {
    try {
      const s = get().savedScenarios[projectId]
      return Array.isArray(s) ? s : EMPTY_SCENARIOS
    } catch (e) {
      // defensive fallback
      // eslint-disable-next-line no-console
      console.warn('getSavedScenarios failed', e)
      return EMPTY_SCENARIOS
    }
  },
}))

export default useCurvaSStore