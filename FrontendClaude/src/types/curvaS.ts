/**
 * curvaS.ts
 * Type definitions for S-Curve project monitoring and analysis
 * including planned vs actual progress tracking and performance metrics
 */

import { z } from 'zod'

/** S-Curve data point with date and progress values */
export interface CurvaSDataPoint {
  /** Unique identifier */
  id: string
  /** Project identifier */
  projectId: string
  /** Date of the data point */
  date: string
  /** Planned cumulative progress percentage */
  plannedProgress: number
  /** Actual cumulative progress percentage */
  actualProgress: number
  /** Planned cumulative cost */
  plannedCost: number
  /** Actual cumulative cost */
  actualCost: number
  /** Planned cumulative volume */
  plannedVolume?: number
  /** Actual cumulative volume */
  actualVolume?: number
  /** Notes for this date */
  notes?: string
  /** When this data point was created */
  createdAt: string
  /** When this data point was last updated */
  updatedAt: string
}

/** Performance indicators for S-Curve analysis */
export interface PerformanceMetrics {
  /** Schedule Performance Index (SPI = EV/PV) */
  spi: number
  /** Cost Performance Index (CPI = EV/AC) */
  cpi: number
  /** Earned Value (EV) */
  earnedValue: number
  /** Planned Value (PV) */
  plannedValue: number
  /** Actual Cost (AC) */
  actualCost: number
  /** Schedule Variance (SV = EV - PV) */
  sv: number
  /** Cost Variance (CV = EV - AC) */
  cv: number
  /** Variance at Completion (VAC) */
  vac?: number
  /** Estimate at Completion (EAC) */
  eac?: number
  /** Estimate to Complete (ETC) */
  etc?: number
}

/** S-Curve analysis results */
export interface CurvaSAnalysis {
  /** Project identifier */
  projectId: string
  /** Current progress percentage */
  currentProgress: number
  /** Performance metrics */
  metrics: PerformanceMetrics
  /** Project status based on SPI and CPI */
  status: 'on-track' | 'ahead-schedule' | 'behind-schedule' | 'over-budget' | 'under-budget'
  /** Trend analysis */
  trend: 'improving' | 'declining' | 'stable'
  /** Key insights and recommendations */
  insights: string[]
  /** Completion date forecast */
  forecastCompletionDate?: string
  /** Total cost forecast */
  forecastTotalCost?: number
  /** Last analysis date */
  analysisDate: string
}

/** S-Curve configuration and parameters */
export interface CurvaSConfig {
  /** Project identifier */
  projectId: string
  /** Total project budget */
  totalBudget: number
  /** Total project duration in days */
  totalDuration: number
  /** S-Curve type */
  curveType: 'normal' | 'weighted' | 'custom'
  /** Progress measurement method */
  progressMethod: 'cost-based' | 'volume-based' | 'mixed'
  /** Update frequency */
  updateFrequency: 'daily' | 'weekly' | 'monthly'
  /** Alert thresholds */
  thresholds: {
    /** SPI alert threshold */
    spiThreshold: number
    /** CPI alert threshold */
    cpiThreshold: number
    /** Progress variance threshold */
    progressVarianceThreshold: number
  }
  /** Chart display settings */
  chartSettings: {
    /** Show planned curve */
    showPlanned: boolean
    /** Show actual curve */
    showActual: boolean
    /** Show forecast curve */
    showForecast: boolean
    /** Show performance indicators */
    showMetrics: boolean
  }
}

/** Zod schema for CurvaSDataPoint validation */
export const curvaSDataPointSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  date: z.string(),
  plannedProgress: z.number().min(0).max(100),
  actualProgress: z.number().min(0).max(100),
  plannedCost: z.number().min(0),
  actualCost: z.number().min(0),
  plannedVolume: z.number().min(0).optional(),
  actualVolume: z.number().min(0).optional(),
  notes: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

/** Zod schema for PerformanceMetrics validation */
export const performanceMetricsSchema = z.object({
  spi: z.number(),
  cpi: z.number(),
  earnedValue: z.number(),
  plannedValue: z.number(),
  actualCost: z.number(),
  sv: z.number(),
  cv: z.number(),
  vac: z.number().optional(),
  eac: z.number().optional(),
  etc: z.number().optional(),
})

/** Zod schema for CurvaSAnalysis validation */
export const curvaSAnalysisSchema = z.object({
  projectId: z.string(),
  currentProgress: z.number().min(0).max(100),
  metrics: performanceMetricsSchema,
  status: z.enum(['on-track', 'ahead-schedule', 'behind-schedule', 'over-budget', 'under-budget']),
  trend: z.enum(['improving', 'declining', 'stable']),
  insights: z.array(z.string()),
  forecastCompletionDate: z.string().optional(),
  forecastTotalCost: z.number().optional(),
  analysisDate: z.string(),
})

/** Zod schema for CurvaSConfig validation */
export const curvaSConfigSchema = z.object({
  projectId: z.string(),
  totalBudget: z.number().min(0),
  totalDuration: z.number().min(1),
  curveType: z.enum(['normal', 'weighted', 'custom']),
  progressMethod: z.enum(['cost-based', 'volume-based', 'mixed']),
  updateFrequency: z.enum(['daily', 'weekly', 'monthly']),
  thresholds: z.object({
    spiThreshold: z.number(),
    cpiThreshold: z.number(),
    progressVarianceThreshold: z.number(),
  }),
  chartSettings: z.object({
    showPlanned: z.boolean(),
    showActual: z.boolean(),
    showForecast: z.boolean(),
    showMetrics: z.boolean(),
  }),
})

/** Type exports */
export type CurvaSDataPointInput = Omit<CurvaSDataPoint, 'id' | 'createdAt' | 'updatedAt'>
export type CurvaSConfigInput = Omit<CurvaSConfig, 'projectId'>
export type CurvaSAnalysisInput = Omit<CurvaSAnalysis, 'projectId' | 'analysisDate'>
