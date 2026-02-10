/**
 * timeline.ts
 * Type definitions for Timeline/Gantt module with CPM support.
 */

/** Task dependency types */
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF'

/** Task status */
export type TaskStatus = 'not_started' | 'in_progress' | 'completed' | 'delayed'

/** TaskStatus enum values for backward compatibility */
export const TaskStatusValues = {
  NOT_STARTED: 'not_started' as TaskStatus,
  IN_PROGRESS: 'in_progress' as TaskStatus,
  COMPLETED: 'completed' as TaskStatus,
  DELAYED: 'delayed' as TaskStatus,
} as const

/** Single task in timeline */
export interface TimelineTask {
  /** Unique task identifier */
  id: string
  /** Project reference */
  projectId: string
  /** WBS item reference (optional) */
  wbsId?: string
  /** RAB item reference (optional) */
  rabId?: string
  /** Task name/title */
  name: string
  /** Detailed description */
  description?: string
  /** Task duration in days */
  duration: number
  /** Start date (YYYY-MM-DD) */
  startDate: string
  /** End date (YYYY-MM-DD) - calculated from start + duration */
  endDate: string
  /** Current progress percentage (0-100) */
  progress: number
  /** Task status */
  status: TaskStatus
  /** Task dependencies */
  dependencies: TaskDependency[]
  /** Assigned resources */
  assignedResources?: string[]
  /** Task priority */
  priority: 'low' | 'medium' | 'high'
  /** Calculated critical path data */
  earliestStart?: string
  earliestFinish?: string
  latestStart?: string
  latestFinish?: string
  /** Total float (slack) in days */
  totalFloat?: number
  /** Free float in days */
  freeFloat?: number
  /** Whether task is on critical path */
  isCritical?: boolean
  /** Task color for Gantt visualization */
  color?: string
  /** Creation timestamp */
  createdAt: string
  /** Last update timestamp */
  updatedAt: string
}

/** Task dependency relationship */
export interface TaskDependency {
  /** Dependency unique identifier */
  id: string
  /** Source task (predecessor) */
  predecessorId: string
  /** Target task (successor) */
  successorId: string
  /** Dependency type */
  type: DependencyType
  /** Lag time in days (positive for lag, negative for lead) */
  lag: number
}

/** Gantt chart data point */
export interface GanttBar {
  /** Task identifier */
  taskId: string
  /** Task name */
  taskName: string
  /** Start date for rendering */
  startOffset: number // Days from project start
  /** Duration for rendering */
  duration: number
  /** Progress percentage */
  progress: number
  /** Task status */
  status: TaskStatus
  /** Whether on critical path */
  isCritical: boolean
  /** Bar color */
  color: string
  /** WBS code for grouping */
  wbsCode?: string
}

/** Timeline milestone */
export interface TimelineMilestone {
  /** Milestone identifier */
  id: string
  /** Project reference */
  projectId: string
  /** Milestone name */
  name: string
  /** Target date */
  targetDate: string
  /** Description */
  description?: string
  /** Whether milestone is achieved */
  achieved: boolean
  /** Actual achievement date */
  actualDate?: string
  /** Associated tasks */
  linkedTaskIds: string[]
  /** Creation timestamp */
  createdAt: string
}

/** Critical path analysis result */
export interface CriticalPathResult {
  /** List of critical task IDs */
  criticalTasks: string[]
  /** Total project duration in days */
  projectDuration: number
  /** Project start date */
  projectStart: string
  /** Project end date */
  projectEnd: string
  /** Critical path duration in days */
  criticalPathDuration: number
}

/** Timeline project summary */
export interface TimelineSummary {
  /** Total tasks */
  totalTasks: number
  /** Completed tasks */
  completedTasks: number
  /** Tasks in progress */
  inProgressTasks: number
  /** Overall progress percentage */
  overallProgress: number
  /** Project start date */
  projectStart: string
  /** Project end date */
  projectEnd: string
  /** Days until project end */
  daysRemaining: number
  /** Number of critical tasks */
  criticalTasks: number
  /** Whether project is on schedule */
  onSchedule: boolean
}
