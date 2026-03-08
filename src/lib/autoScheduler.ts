/**
 * src/lib/autoScheduler.ts
 * 
 * Logic for automatically generating a Schedule (WBS & Timeline) from RAB.
 * 
 * Logic Flow:
 * 1. Group RAB Items by AHSP Category -> Becomes WBS Level 1 (Summary Tasks).
 * 2. RAB Items -> Become WBS Level 2 (Leaf Tasks).
 * 3. Calculate Duration:
 *    - Formula: (Volume * Total Labor Coefficient) / Assumed Team Size
 *    - If no labor data, default to 1 day per certain volume unit.
 * 4. Sequence:
 *    - Categories are sequenced one after another (Finish-to-Start).
 *    - Items within a category run in parallel (Start-Start) by default, 
 *      but user can adjust later in Gantt.
 */

import { RABItem } from '../store/rabStore'
import { TimelineTask } from '../store/timelineStore'
import { AHSPItem, AHSPComponent } from '../types/ahsp'

const DEFAULT_TEAM_SIZE = 3 // Assumed number of workers per task

let _taskCounter = 0
function generateTaskId(): string {
  _taskCounter++
  return `${Date.now()}-${_taskCounter}-${Math.random().toString(36).slice(2, 6)}`
}

/**
 * Calculate rational duration based on AHSP analysis
 */
function calculateDuration(
  volume: number, 
  components: AHSPComponent[]
): number {
  // 1. Find Labor components (OH - Orang Hari or Jam)
  const laborComps = components.filter(c => c.type === 'labor')
  
  if (laborComps.length === 0) {
    // Fallback: Estimate based on volume magnitude if no analysis
    // e.g. 1 day for every 10 units, min 1 day
    return Math.max(1, Math.ceil(volume / 10))
  }

  // 2. Calculate Total Man-Days required
  // Coefficient is usually OH (Orang Hari) per Unit Volume
  // Total Man Days = Volume * Sum(Coefficients)
  const totalManDays = laborComps.reduce((sum, comp) => {
    const coef = comp.coefficient
    // Normalize units if necessary (assuming standard OH for now)
    return sum + coef
  }, 0) * volume

  // 3. Calculate Duration
  // Duration = Total Man Days / Team Size
  // Increase team size for larger volumes to keep duration reasonable
  const dynamicTeamSize = Math.max(DEFAULT_TEAM_SIZE, Math.ceil(totalManDays / 30)) // Aim for max 30 days per task
  const duration = Math.ceil(totalManDays / dynamicTeamSize)

  return Math.max(1, duration) // Minimum 1 day
}

/**
 * Add days to a date string
 */
function addDays(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().split('T')[0]
}

/**
 * Main Generator Function
 */
export function generateScheduleFromRAB(
  projectId: string,
  projectStartDate: string,
  rabItems: RABItem[],
  ahspMap: Map<string, AHSPItem>,
  componentsByAHSP: Record<string, AHSPComponent[]>
): TimelineTask[] {
  const tasks: TimelineTask[] = []
  let currentStartDate = projectStartDate

  // 1. Group by Category (WBS Structure)
  const byCategory: Record<string, RABItem[]> = {}
  
  rabItems.forEach(item => {
    const ahsp = ahspMap.get(item.item_code || item.code || '')
    const category = ahsp?.category || 'Uncategorized'
    
    if (!byCategory[category]) {
      byCategory[category] = []
    }
    byCategory[category].push(item)
  })

  // 2. Process each Category
  Object.entries(byCategory).forEach(([_category, items]) => {
    // Items within a category run in parallel (Start-Start) as documented
    const categoryStartDate = currentStartDate
    let maxCategoryEnd = currentStartDate
    
    items.forEach(item => {
      const ahsp = ahspMap.get(item.item_code || item.code || '')
      const components = ahsp ? (componentsByAHSP[ahsp.id] || []) : []
      
      const duration = calculateDuration(item.volume || 0, components)
      
      // All items in the same category start at the same date (parallel)
      const endDate = addDays(categoryStartDate, duration - 1)

      // Create Task with unique ID
      const task: TimelineTask = {
        id: item.taskId || `task-${generateTaskId()}`, // Use unique ID
        projectId,
        name: item.name || item.item_name || 'Untitled Task',
        description: `Generated from RAB Item: ${item.item_code}`,
        startDate: categoryStartDate,
        endDate: endDate,
        duration: duration,
        progress: 0,
        status: 'not_started',
        priority: 'medium',
        rabId: item.id, // Link back to RAB
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dependencies: [] // Initialize empty dependencies
      }

      tasks.push(task)

      // Track the longest task in this category
      if (endDate > maxCategoryEnd) maxCategoryEnd = endDate
    })

    // Next category starts after the longest task in this category ends
    currentStartDate = addDays(maxCategoryEnd, 1)
  })

  return tasks
}
