/**
 * src/lib/unifiedSchedule.ts
 *
 * The "Powerful" Logic Core.
 *
 * This module provides a unified calculator that derives the Resource Schedule (RAP)
 * directly from:
 * 1. RAB Items (Budget & Resources)
 * 2. Timeline Tasks (Schedule)
 * 3. AHSP Data (Resource Coefficients)
 *
 * It eliminates the need for a separate "RAP Plan" state.
 * If you change the Timeline, this recalculates.
 * If you change the RAB, this recalculates.
 */

import { RABItem } from '../store/rabStore'
import { TimelineTask } from '../store/timelineStore'
import { AHSPItem, AHSPComponent } from '../types/ahsp'

export interface TimePhasedResource {
  period: string // YYYY-MM-DD or YYYY-WW or YYYY-MM
  resourceId: string
  resourceName: string
  resourceType: string
  unit: string
  volume: number
  cost: number
}

export interface TimePhasedCost {
  period: string
  totalCost: number
  materialCost: number
  laborCost: number
  equipmentCost: number
  otherCost: number
}

/**
 * Helper to generate daily date range
 */
function getDatesInRange(startDate: string, endDate: string): string[] {
  const dates: string[] = []
  const curr = new Date(startDate)
  const end = new Date(endDate)
  
  while (curr <= end) {
    dates.push(curr.toISOString().split('T')[0])
    curr.setDate(curr.getDate() + 1)
  }
  return dates
}

/**
 * Calculate Unified Schedule
 * 
 * @param rabItems List of RAB items
 * @param tasks List of Timeline tasks
 * @param ahspMap Map of AHSP Code -> AHSP Item
 * @param componentsByAHSP Map of AHSP ID -> Components[]
 * @param periodType 'day' | 'week' | 'month'
 */
export function calculateUnifiedSchedule(
  rabItems: RABItem[],
  tasks: TimelineTask[],
  ahspMap: Map<string, AHSPItem>,
  componentsByAHSP: Record<string, AHSPComponent[]>,
  periodType: 'day' | 'week' | 'month' = 'week'
): {
  resourceSchedule: TimePhasedResource[]
  costSchedule: TimePhasedCost[]
} {
  // 1. Map Tasks by ID for quick lookup
  const taskMap = new Map(tasks.map(t => [t.id, t]))

  // 2. Prepare daily buckets
  // We calculate daily first, then aggregate
  const dailyResources: Record<string, Record<string, TimePhasedResource>> = {}
  const dailyCosts: Record<string, TimePhasedCost> = {}

  // 3. Iterate RAB Items
  rabItems.forEach(item => {
    // Skip if no volume or no linked task
    if (!item.volume || item.volume <= 0) return
    
    // If item has a direct taskId, use it. 
    // Fallback: If we implement "Auto-Link" later based on name matching, do it here.
    // For now, we rely on explicit link.
    if (!item.taskId) return 

    const task = taskMap.get(item.taskId)
    if (!task) return // Task might be deleted

    // Get duration in days
    const dates = getDatesInRange(task.startDate, task.endDate)
    const duration = dates.length
    if (duration === 0) return

    // Daily Volume for this item
    const dailyItemVolume = item.volume / duration

    // Find AHSP components
    const ahspCode = item.item_code || item.code
    const ahsp = ahspCode ? ahspMap.get(ahspCode) : undefined
    
    if (ahsp) {
      const components = componentsByAHSP[ahsp.id] || []
      
      if (components.length === 0) {
        // AHSP exists but no components? Treat as "Other"
        const dailyCost = (item.finalTotal || (item.volume * (item.unit_price || 0))) / duration
        dates.forEach(date => {
          if (!dailyCosts[date]) {
            dailyCosts[date] = { 
              period: date, 
              totalCost: 0, 
              materialCost: 0, 
              laborCost: 0, 
              equipmentCost: 0, 
              otherCost: 0 
            }
          }
          dailyCosts[date].totalCost += dailyCost
          dailyCosts[date].otherCost += dailyCost
        })
      } else {
        // Distribute components over days
        dates.forEach(date => {
          if (!dailyCosts[date]) {
            dailyCosts[date] = { 
              period: date, 
              totalCost: 0, 
              materialCost: 0, 
              laborCost: 0, 
              equipmentCost: 0, 
              otherCost: 0 
            }
          }

          components.forEach(comp => {
            const resId = comp.resourceId
            const resVol = dailyItemVolume * comp.coefficient
            const resCost = resVol * comp.unitPrice

            // Aggregate Resource
            if (!dailyResources[date]) dailyResources[date] = {}
            if (!dailyResources[date][resId]) {
              dailyResources[date][resId] = {
                period: date,
                resourceId: resId,
                resourceName: comp.resource?.name || 'Unknown',
                resourceType: comp.resource?.type || comp.type || 'material',
                unit: comp.unit,
                volume: 0,
                cost: 0
              }
            }
            dailyResources[date][resId].volume += resVol
            dailyResources[date][resId].cost += resCost

            // Aggregate Cost
            dailyCosts[date].totalCost += resCost
            const type = (comp.resource?.type || comp.type || 'other').toLowerCase()
            if (type === 'material') dailyCosts[date].materialCost += resCost
            else if (type === 'labor') dailyCosts[date].laborCost += resCost
            else if (type === 'equipment') dailyCosts[date].equipmentCost += resCost
            else dailyCosts[date].otherCost += resCost
          })
        })
      }
    } else {
      // No AHSP? Treat as "Other" lump sum
      const dailyCost = (item.finalTotal || (item.volume * (item.unit_price || 0))) / duration
      dates.forEach(date => {
        if (!dailyCosts[date]) {
          dailyCosts[date] = { 
            period: date, 
            totalCost: 0, 
            materialCost: 0, 
            laborCost: 0, 
            equipmentCost: 0, 
            otherCost: 0 
          }
        }
        dailyCosts[date].totalCost += dailyCost
        dailyCosts[date].otherCost += dailyCost
      })
    }
  })

  // 4. Aggregate by Period (Week/Month)
  // Simple aggregation logic
  const aggregatedResources: Record<string, Record<string, TimePhasedResource>> = {}
  const aggregatedCosts: Record<string, TimePhasedCost> = {}

  const getPeriodKey = (dateStr: string) => {
    if (periodType === 'day') return dateStr
    const d = new Date(dateStr)
    if (periodType === 'month') return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    // Week: simple approximation or ISO week
    const onejan = new Date(d.getFullYear(), 0, 1)
    const week = Math.ceil((((d.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7)
    return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
  }

  Object.keys(dailyCosts).sort().forEach(date => {
    const period = getPeriodKey(date)
    
    // Aggregate Costs
    if (!aggregatedCosts[period]) {
      aggregatedCosts[period] = { 
        period, 
        totalCost: 0, 
        materialCost: 0, 
        laborCost: 0, 
        equipmentCost: 0, 
        otherCost: 0 
      }
    }
    const dc = dailyCosts[date]
    aggregatedCosts[period].totalCost += dc.totalCost
    aggregatedCosts[period].materialCost += dc.materialCost
    aggregatedCosts[period].laborCost += dc.laborCost
    aggregatedCosts[period].equipmentCost += dc.equipmentCost
    aggregatedCosts[period].otherCost += dc.otherCost

    // Aggregate Resources
    if (dailyResources[date]) {
      if (!aggregatedResources[period]) aggregatedResources[period] = {}
      Object.values(dailyResources[date]).forEach(dr => {
        if (!aggregatedResources[period][dr.resourceId]) {
          aggregatedResources[period][dr.resourceId] = { ...dr, period, volume: 0, cost: 0 }
        }
        aggregatedResources[period][dr.resourceId].volume += dr.volume
        aggregatedResources[period][dr.resourceId].cost += dr.cost
      })
    }
  })

  // Flatten results
  const flatResources: TimePhasedResource[] = []
  Object.values(aggregatedResources).forEach(resMap => {
    flatResources.push(...Object.values(resMap))
  })

  const flatCosts = Object.values(aggregatedCosts).sort((a, b) => a.period.localeCompare(b.period))

  return {
    resourceSchedule: flatResources,
    costSchedule: flatCosts
  }
}
