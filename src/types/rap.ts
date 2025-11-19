/**
 * rap.ts
 * Type definitions for RAP (Rencana Anggaran Periodik) module
 * Handles time-phased budget distribution from RAB + Timeline
 */

import { RABItem } from './rab'
import { TimelineTask } from './timeline'

/** RAP item represents budget item distributed across time periods */
export interface RAPItem {
  /** Unique identifier */
  id: string
  
  /** Project reference */
  projectId: string
  
  /** RAB item reference */
  rabId: string
  
  /** Timeline task reference */
  taskId: string
  
  /** Period key (e.g., "2024-01", "2024-W01", "2024-Q1") */
  periodKey: string
  
  /** Period type */
  periodType: 'monthly' | 'weekly' | 'quarterly'
  
  /** Planned volume for this period */
  plannedVolume: number
  
  /** Planned cost for this period */
  plannedCost: number
  
  /** Actual volume (from progress tracking) */
  actualVolume?: number
  
  /** Actual cost (from progress tracking) */
  actualCost?: number
  
  /** Accumulated planned cost up to this period */
  cumulativePlannedCost: number
  
  /** Accumulated actual cost up to this period */
  cumulativeActualCost: number
  
  /** Variance (planned - actual) */
  variance: number
  
  /** Variance percentage */
  variancePercentage: number
  
  /** Status of this period */
  status: 'not_started' | 'in_progress' | 'completed' | 'overdue'
  
  /** Additional notes */
  notes?: string
  
  /** Creation timestamp */
  createdAt: string
  
  /** Last update timestamp */
  updatedAt: string
}

/** RAP configuration for generation */
export interface RAPConfig {
  /** Project identifier */
  projectId: string
  
  /** Distribution method */
  distributionMethod: 'even' | 'front_loaded' | 'back_loaded' | 'task_based'
  
  /** Period type */
  periodType: 'monthly' | 'weekly' | 'quarterly'
  
  /** Start date for RAP */
  startDate: string
  
  /** End date for RAP */
  endDate: string
  
  /** Include overhead in distribution */
  includeOverhead: boolean
  
  /** Include profit in distribution */
  includeProfit: boolean
  
  /** Include tax in distribution */
  includeTax: boolean
  
  /** Custom distribution weights */
  customWeights?: Record<string, number>
}

/** RAP Summary for reporting */
export interface RAPSummary {
  /** Project identifier */
  projectId: string
  
  /** Total planned budget */
  totalPlannedBudget: number
  
  /** Total actual cost */
  totalActualCost: number
  
  /** Total variance */
  totalVariance: number
  
  /** Variance percentage */
  variancePercentage: number
  
  /** Period breakdown */
  periodBreakdown: RAPPeriodSummary[]
  
  /** Cost breakdown by category */
  costBreakdown: RAPCostBreakdown
  
  /** Progress percentage */
  progressPercentage: number
  
  /** Forecast completion cost */
  forecastCompletionCost: number
  
  /** Estimate at completion (EAC) */
  estimateAtCompletion: number
  
  /** Estimate to complete (ETC) */
  estimateToComplete: number
  
  /** Cash flow projection */
  cashFlowProjection: RAPCashFlowItem[]
}

/** Period summary */
export interface RAPPeriodSummary {
  /** Period key */
  periodKey: string
  
  /** Period display name */
  periodName: string
  
  /** Planned cost for period */
  plannedCost: number
  
  /** Actual cost for period */
  actualCost: number
  
  /** Variance for period */
  variance: number
  
  /** Cumulative planned cost */
  cumulativePlannedCost: number
  
  /** Cumulative actual cost */
  cumulativeActualCost: number
  
  /** Progress percentage */
  progressPercentage: number
  
  /** Number of tasks in this period */
  taskCount: number
  
  /** Completed tasks in this period */
  completedTasks: number
}

/** Cost breakdown by category */
export interface RAPCostBreakdown {
  /** Material costs */
  materialCost: number
  
  /** Labor costs */
  laborCost: number
  
  /** Equipment costs */
  equipmentCost: number
  
  /** Overhead costs */
  overheadCost: number
  
  /** Profit margin */
  profitMargin: number
  
  /** Tax amount */
  taxAmount: number
}

/** Cash flow projection item */
export interface RAPCashFlowItem {
  /** Period key */
  periodKey: string
  
  /** Period name */
  periodName: string
  
  /** Inflow (income) */
  inflow: number
  
  /** Outflow (expenses) */
  outflow: number
  
  /** Net flow */
  netFlow: number
  
  /** Cumulative cash */
  cumulativeCash: number
}

/** RAP generation result */
export interface RAPGenerationResult {
  /** Success status */
  success: boolean
  
  /** Generated RAP items */
  rapItems: RAPItem[]
  
  /** RAP summary */
  summary: RAPSummary
  
  /** Errors if any */
  errors?: string[]
  
  /** Warnings if any */
  warnings?: string[]
}

/** Distribution calculation input */
export interface RAPDistributionInput {
  /** RAB item */
  rabItem: RABItem
  
  /** Timeline task */
  timelineTask: TimelineTask
  
  /** Total duration in days */
  totalDuration: number
  
  /** Task duration in days */
  taskDuration: number
  
  /** Distribution method */
  method: 'even' | 'front_loaded' | 'back_loaded' | 'task_based'
  
  /** Period type */
  periodType: 'monthly' | 'weekly' | 'quarterly'
  
  /** Start date */
  startDate: string
  
  /** End date */
  endDate: string
}

/** Distribution result */
export interface RAPDistributionResult {
  /** Period distributions */
  distributions: {
    /** Period key */
    periodKey: string
    
    /** Volume for this period */
    volume: number
    
    /** Cost for this period */
    cost: number
    
    /** Percentage of total */
    percentage: number
  }[]
  
  /** Total distributed volume */
  totalVolume: number
  
  /** Total distributed cost */
  totalCost: number
  
  /** Validation status */
  isValid: boolean
  
  /** Validation errors */
  errors: string[]
}
