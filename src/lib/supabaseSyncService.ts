/**
 * supabaseSyncService.ts
 * 
 * Robust sync service for Supabase with:
 * - Optimistic updates
 * - Retry logic with exponential backoff
 * - Offline queue
 * - Conflict resolution
 * - Error recovery
 * 
 * This replaces the fire-and-forget pattern with a reliable sync mechanism.
 */

import { supabase } from './supabaseClient'
import { toast } from 'sonner'

/**
 * Sync operation types
 */
export type SyncOperation = 'insert' | 'update' | 'delete' | 'upsert'

/**
 * Sync task interface
 */
export interface SyncTask {
  id: string
  operation: SyncOperation
  table: string
  data: any
  timestamp: number
  retryCount: number
  maxRetries: number
}

/**
 * Sync result interface
 */
export interface SyncResult {
  success: boolean
  error?: string
  data?: any
}

/**
 * ===========================
 * SYNC QUEUE MANAGER
 * ===========================
 */

class SyncQueueManager {
  private queue: SyncTask[] = []
  private processing: boolean = false
  private maxRetries: number = 3
  private retryDelay: number = 1000 // Base delay in ms

  /**
   * Add task to sync queue
   */
  enqueue(task: Omit<SyncTask, 'id' | 'timestamp' | 'retryCount'>): string {
    const id = this.generateTaskId()
    const fullTask: SyncTask = {
      ...task,
      id,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: task.maxRetries || this.maxRetries,
    }

    this.queue.push(fullTask)
    this.saveQueue()

    // Start processing if not already running
    if (!this.processing) {
      this.processQueue()
    }

    return id
  }

  /**
   * Process all tasks in queue
   */
  private async processQueue() {
    if (this.processing || this.queue.length === 0) return

    this.processing = true

    while (this.queue.length > 0) {
      const task = this.queue[0]

      try {
        const result = task.operation === 'upsert' && Array.isArray(task.data)
          ? await this.executeBatchTask(task)
          : await this.executeTask(task)

        if (result.success) {
          // Remove successful task
          this.queue.shift()
          this.saveQueue()
        } else {
          // Handle failed task
          await this.handleFailedTask(task, result.error)
        }
      } catch (error) {
        await this.handleFailedTask(task, error instanceof Error ? error.message : 'Unknown error')
      }

      // Small delay between tasks
      await this.delay(100)
    }

    this.processing = false
  }

  /**
   * Execute a single sync task
   */
  private async executeTask(task: SyncTask): Promise<SyncResult> {
    if (!supabase) {
      return {
        success: false,
        error: 'Supabase not initialized',
      }
    }

    try {
      let result: any

      switch (task.operation) {
        case 'insert':
          result = await supabase.from(task.table).insert(task.data)
          break

        case 'update':
          result = await supabase.from(task.table)
            .update(task.data)
            .eq('id', task.data.id)
          break

        case 'delete':
          result = await supabase.from(task.table)
            .delete()
            .eq('id', task.data.id)
          break

        case 'upsert':
          result = await supabase.from(task.table)
            .upsert(task.data, { onConflict: 'id' })
          break

        default:
          throw new Error(`Unknown operation: ${task.operation}`)
      }

      if (result.error) {
        return {
          success: false,
          error: result.error.message,
        }
      }

      return {
        success: true,
        data: result.data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Execute a batch upsert task
   */
  private async executeBatchTask(task: SyncTask): Promise<SyncResult> {
    if (!supabase) return { success: false, error: 'Supabase not initialized' }

    try {
      const result = await supabase.from(task.table)
        .upsert(task.data, { onConflict: 'id' })

      if (result.error) return { success: false, error: result.error.message }
      return { success: true, data: result.data }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Handle failed task with retry logic
   */
  private async handleFailedTask(task: SyncTask, error?: string) {
    task.retryCount++

    if (task.retryCount >= task.maxRetries) {
      // Max retries reached, move to failed queue
      console.error(`Task ${task.id} failed after ${task.retryCount} retries:`, error)
      toast.error(`Sync failed: ${error || 'Unknown error'}. Please check your connection.`)

      // Remove from queue
      this.queue.shift()
      this.saveQueue()

      // Optionally save to failed queue for manual retry
      this.saveToFailedQueue(task)
    } else {
      // Retry with exponential backoff
      const delay = this.retryDelay * Math.pow(2, task.retryCount - 1)
      console.warn(`Retrying task ${task.id} in ${delay}ms (attempt ${task.retryCount}/${task.maxRetries})`)

      await this.delay(delay)
      this.saveQueue()
    }
  }

  /**
   * Save queue to localStorage for persistence
   */
  private saveQueue() {
    try {
      localStorage.setItem('supabase-sync-queue', JSON.stringify(this.queue))
    } catch (error) {
      console.error('Failed to save sync queue:', error)
    }
  }

  /**
   * Load queue from localStorage
   */
  loadQueue() {
    try {
      const saved = localStorage.getItem('supabase-sync-queue')
      if (saved) {
        this.queue = JSON.parse(saved)
        if (this.queue.length > 0) {
          this.processQueue()
        }
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error)
    }
  }

  /**
   * Save failed task for manual retry
   */
  private saveToFailedQueue(task: SyncTask) {
    try {
      const failed = JSON.parse(localStorage.getItem('supabase-failed-queue') || '[]')
      failed.push(task)
      localStorage.setItem('supabase-failed-queue', JSON.stringify(failed))
    } catch (error) {
      console.error('Failed to save to failed queue:', error)
    }
  }

  /**
   * Get failed tasks count
   */
  getFailedCount(): number {
    try {
      const failed = JSON.parse(localStorage.getItem('supabase-failed-queue') || '[]')
      return failed.length
    } catch {
      return 0
    }
  }

  /**
   * Clear failed queue
   */
  clearFailedQueue() {
    localStorage.removeItem('supabase-failed-queue')
  }

  /**
   * Retry all failed tasks
   */
  retryFailedTasks() {
    try {
      const failed = JSON.parse(localStorage.getItem('supabase-failed-queue') || '[]')
      failed.forEach((task: SyncTask) => {
        task.retryCount = 0 // Reset retry count
        this.queue.push(task)
      })
      this.clearFailedQueue()
      this.saveQueue()
      this.processQueue()
      toast.success(`Retrying ${failed.length} failed tasks`)
    } catch (error) {
      console.error('Failed to retry failed tasks:', error)
    }
  }

  /**
   * Utility: Generate unique task ID
   */
  private generateTaskId(): string {
    return `sync-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Utility: Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Get queue status
   */
  getStatus() {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      failedCount: this.getFailedCount(),
    }
  }

  /**
   * Clear entire queue (use with caution)
   */
  clearQueue() {
    this.queue = []
    this.saveQueue()
  }
}

/**
 * ===========================
 * SINGLETON INSTANCE
 * ===========================
 */

export const syncQueue = new SyncQueueManager()

// Load queue on startup
if (typeof window !== 'undefined') {
  syncQueue.loadQueue()
}

/**
 * ===========================
 * HIGH-LEVEL SYNC FUNCTIONS
 * ===========================
 */

/**
 * Sync single AHSP item
 */
export function syncAHSPItem(item: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'ahsp_items',
    data: {
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      unit: item.unit,
      category: item.category,
      base_price: item.basePrice,
      final_price: item.finalPrice,
      overhead_percentage: item.overheadPercentage,
      profit_percentage: item.profitPercentage,
      created_at: item.createdAt,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync multiple AHSP items
 */
export function syncAHSPItems(items: any[]): string[] {
  return items.map(item => syncAHSPItem(item))
}

/**
 * Sync single resource
 */
export function syncResource(resource: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'resources',
    data: {
      id: resource.id,
      code: resource.code,
      name: resource.name,
      type: resource.type,
      unit: resource.unit,
      unit_price: resource.unitPrice,
      created_at: resource.createdAt,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync AHSP component
 */
export function syncAHSPComponent(component: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'ahsp_components',
    data: {
      id: component.id,
      ahsp_id: component.ahspId,
      resource_id: component.resourceId,
      type: component.type,
      coefficient: component.coefficient,
      unit: component.unit,
      unit_price: component.unitPrice,
      subtotal: component.subtotal,
      created_at: component.createdAt,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync RAB item
 */
export function syncRABItem(item: any, projectId: string): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'rab_items',
    data: {
      id: item.id,
      project_id: projectId,
      ahsp_code: item.itemCode || item.item_code || item.code,
      name: item.name || item.item_name,
      unit: item.unit,
      volume: item.volume,
      unit_price: item.unitPrice || item.unit_price,
      cost_material: item.cost_material || 0,
      cost_labor: item.cost_labor || 0,
      cost_equipment: item.cost_equipment || 0,
      cost_subcon: item.cost_subcon || 0,
      markup_percentage: item.markup_percentage || 0,
      weight_percentage: item.weight_percentage || 0,
      final_total: item.finalTotal || item.final_total || item.finalPrice,
      created_at: item.createdAt,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync multiple RAB items (Batch)
 */
export function syncRABItems(items: any[], projectId: string): string {
  if (!items.length) return ''
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'rab_items',
    data: items.map(item => ({
      id: item.id,
      project_id: projectId,
      ahsp_code: item.item_code || item.itemCode || item.code,
      name: item.name || item.item_name,
      unit: item.unit,
      volume: item.volume,
      unit_price: item.unit_price || item.unitPrice,
      cost_material: item.cost_material || 0,
      cost_labor: item.cost_labor || 0,
      cost_equipment: item.cost_equipment || 0,
      cost_subcon: item.cost_subcon || 0,
      markup_percentage: item.markup_percentage || 0,
      weight_percentage: item.weight_percentage || 0,
      final_total: item.final_total || item.finalTotal || item.finalPrice,
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    maxRetries: 3,
  })
}

/**
 * Sync project
 */
export function syncProject(project: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'projects',
    data: {
      id: project.id,
      name: project.name,
      code: project.code,
      client_name: project.clientName,
      location: project.location,
      start_date: project.startDate,
      end_date: project.endDate,
      budget: project.budget,
      status: project.status,
      user_id: project.userId,
      payment_terms: project.paymentTerms,
      meta: project.meta,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Delete item with sync
 */
export function syncDelete(table: string, id: string): string {
  return syncQueue.enqueue({
    operation: 'delete',
    table,
    data: { id },
    maxRetries: 3,
  })
}

/**
 * Sync WBS item
 */
export function syncWBSItem(item: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'wbs_items',
    data: {
      id: item.id,
      project_id: item.projectId,
      code: item.code,
      name: item.name,
      description: item.description,
      level: item.level,
      parent_id: item.parentId,
      sort_order: item.sortOrder,
      created_at: item.createdAt,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync multiple WBS items (Batch)
 */
export function syncWBSItems(items: any[], projectId: string): string {
  if (!items.length) return ''
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'wbs_items',
    data: items.map(item => ({
      id: item.id,
      project_id: projectId,
      code: item.code,
      name: item.name,
      description: item.description,
      level: item.level,
      parent_id: item.parentId,
      sort_order: item.sortOrder,
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    maxRetries: 3,
  })
}

/**
 * Sync Timeline task
 */
export function syncTimelineTask(task: any): string {
  const data: Record<string, any> = {
      id: task.id,
      project_id: task.projectId,
      wbs_id: task.wbsId,
      rab_id: task.rabId,
      name: task.name,
      description: task.description,
      duration: task.duration,
      start_date: task.startDate,
      end_date: task.endDate,
      progress: task.progress,
      status: task.status,
      dependencies: JSON.stringify(task.dependencies || []),
      assigned_resources: task.assignedResources,
      priority: task.priority,
      baseline_start_date: task.baselineStartDate,
      baseline_end_date: task.baselineEndDate,
      created_at: task.createdAt,
      updated_at: task.updatedAt || new Date().toISOString(),
  }
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'timeline_tasks',
    data,
    maxRetries: 3,
  })
}

/**
 * Sync Timeline tasks (Batch)
 */
export function syncTimelineTasks(tasks: any[], projectId: string): string {
  if (!tasks.length) return ''
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'timeline_tasks',
    data: tasks.map(task => ({
      id: task.id,
      project_id: projectId,
      wbs_id: task.wbsId,
      rab_id: task.rabId,
      name: task.name,
      description: task.description,
      duration: task.duration,
      start_date: task.startDate,
      end_date: task.endDate,
      progress: task.progress,
      status: task.status,
      dependencies: JSON.stringify(task.dependencies || []),
      assigned_resources: task.assignedResources,
      priority: task.priority,
      baseline_start_date: task.baselineStartDate,
      baseline_end_date: task.baselineEndDate,
      created_at: task.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    maxRetries: 3,
  })
}

/**
 * Sync RAP item
 */
export function syncRAPItem(item: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'rap_items',
    data: {
      id: item.id,
      project_id: item.projectId || item.project_id,
      rab_item_id: item.rabId || item.rab_item_id,
      wbs_id: item.wbs_id || null,  // Never use taskId — it references timeline_tasks, not wbs_items
      ahsp_id: item.ahsp_id || null,
      name: item.name || null,
      period_key: item.periodKey,
      period_type: item.periodType,
      planned_volume: item.plannedVolume,
      planned_cost: item.plannedCost,
      actual_volume: item.actualVolume || 0,
      actual_cost: item.actualCost || 0,
      cost_material: item.cost_material || 0,
      cost_labor: item.cost_labor || 0,
      cost_equipment: item.cost_equipment || 0,
      cost_subcon: item.cost_subcon || 0,
      status: item.status || 'not_started',
      notes: item.notes,
      created_at: item.createdAt,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync multiple RAP items (Batch)
 */
export function syncRAPItems(items: any[], projectId: string): string {
  if (!items.length) return ''
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'rap_items',
    data: items.map(item => ({
      id: item.id,
      project_id: projectId,
      rab_item_id: item.rabId || item.rab_item_id,
      wbs_id: item.wbs_id || null,  // Never use taskId — it references timeline_tasks, not wbs_items
      ahsp_id: item.ahsp_id || null,
      name: item.name || null,
      period_key: item.periodKey,
      period_type: item.periodType,
      planned_volume: item.plannedVolume,
      planned_cost: item.plannedCost,
      actual_volume: item.actualVolume || 0,
      actual_cost: item.actualCost || 0,
      cost_material: item.cost_material || 0,
      cost_labor: item.cost_labor || 0,
      cost_equipment: item.cost_equipment || 0,
      cost_subcon: item.cost_subcon || 0,
      status: item.status || 'not_started',
      notes: item.notes,
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    maxRetries: 3,
  })
}

/**
 * Sync Feature Config (Phase 4)
 */
export function syncFeatureConfig(config: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'feature_configs',
    data: {
      id: config.id || config.projectId,
      project_id: config.projectId,
      config_data: config, // Store entire config as JSONB
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync Feature Snapshot (Phase 4)
 */
export function syncFeatureSnapshot(snapshot: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'feature_snapshots',
    data: {
      id: snapshot.id,
      project_id: snapshot.config?.projectId,
      name: snapshot.name,
      config_data: snapshot.config, // Store config as JSONB
      created_at: snapshot.createdAt,
    },
    maxRetries: 3,
  })
}

/**
 * Sync Curva-S Data Point (Phase 4)
 */
export function syncCurvaSDataPoint(point: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'curvas_data_points',
    data: {
      id: point.id,
      project_id: point.projectId,
      date: point.date,
      planned_progress: point.plannedProgress,
      actual_progress: point.actualProgress,
      planned_cost: point.plannedCost,
      actual_cost: point.actualCost,
      created_at: point.createdAt,
      updated_at: point.updatedAt || new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync Curva-S Analysis (Phase 4)
 */
export function syncCurvaSAnalysis(analysis: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'curvas_analyses',
    data: {
      id: `${analysis.projectId}-${analysis.analysisDate}`,
      project_id: analysis.projectId,
      current_progress: analysis.currentProgress,
      spi: analysis.metrics.spi,
      cpi: analysis.metrics.cpi,
      earned_value: analysis.metrics.earnedValue,
      planned_value: analysis.metrics.plannedValue,
      actual_cost: analysis.metrics.actualCost,
      sv: analysis.metrics.sv,
      cv: analysis.metrics.cv,
      eac: analysis.metrics.eac,
      etc: analysis.metrics.etc,
      vac: analysis.metrics.vac,
      status: analysis.status,
      forecast_completion_date: analysis.forecastCompletionDate,
      forecast_total_cost: analysis.forecastTotalCost,
      analysis_date: analysis.analysisDate,
      insights: analysis.insights || [],
      created_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync Curva-S Saved Scenario (Phase 4)
 */
export function syncCurvaSScenario(scenario: any, projectId: string): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'curvas_scenarios',
    data: {
      id: scenario.id,
      project_id: projectId,
      name: scenario.name,
      dp_percent: scenario.dpPercent,
      billing_percent: scenario.billingPercent,
      retention_rate: scenario.retentionRate,
      buffer_amount: scenario.bufferAmount,
      created_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * ===========================
 * TKDN SYNC FUNCTIONS
 * ===========================
 */

/**
 * Sync a single TKDN item (upsert)
 */
export function syncTKDNItem(item: any): string {
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'tkdn_items',
    data: {
      id: item.id,
      project_id: item.project_id,
      name: item.name,
      category: item.category,
      origin: item.origin,
      unit: item.unit,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_value: item.total_value ?? (item.quantity * item.unit_price),
      supplier: item.supplier || null,
      country_of_origin: item.country_of_origin || null,
      hs_code: item.hs_code || null,
      rab_item_id: item.rab_item_id || null,
      notes: item.notes || null,
      updated_at: item.updated_at || new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * ===========================
 * EXPORTS
 * ===========================
 */

export default {
  syncQueue,
  syncAHSPItem,
  syncAHSPItems,
  syncResource,
  syncAHSPComponent,
  syncRABItem,
  syncRABItems,
  syncProject,
  syncDelete,
  syncWBSItem,
  syncWBSItems,
  syncTimelineTask,
  syncTimelineTasks,
  syncRAPItem,
  syncRAPItems,
  syncFeatureConfig,
  syncFeatureSnapshot,
  syncCurvaSDataPoint,
  syncCurvaSAnalysis,
  syncCurvaSScenario,
  syncTKDNItem,
}
