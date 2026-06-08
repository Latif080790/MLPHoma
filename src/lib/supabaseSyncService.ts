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
import { toDbResourceType } from './resourceTypeUtils'
import { toast } from 'sonner'
import { get, set, del } from 'idb-keyval'

/**
 * Sync operation types
 */
export type SyncOperation = 'insert' | 'update' | 'delete' | 'upsert'

/**
 * Sync task interface
 */
export interface SyncTask {
  id: string
  correlationId: string
  operation: SyncOperation
  table: string
  data: Record<string, unknown> | Array<Record<string, unknown>>
  timestamp: number
  retryCount: number
  maxRetries: number
  onConflict?: string // Optional conflict resolution column (default: 'id')
}

/**
 * Sync result interface
 */
export interface SyncResult {
  success: boolean
  error?: string
  data?: unknown
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
  private maxQueueSize: number = 2000 // Significantly increased for IndexedDB
  private failedTaskCount: number = 0 // Cached synchronous failed count
  private statusSubscribers: Set<() => void> = new Set()

  /**
   * Subscribe to status changes (failedCount, queueLength).
   * Returns an unsubscribe function.
   */
  subscribe(fn: () => void): () => void {
    this.statusSubscribers.add(fn)
    return () => this.statusSubscribers.delete(fn)
  }

  private notifySubscribers() {
    this.statusSubscribers.forEach(fn => fn())
  }

  /**
   * Add task to sync queue
   */
  enqueue(task: Omit<SyncTask, 'id' | 'timestamp' | 'retryCount' | 'correlationId'> & Partial<Pick<SyncTask, 'correlationId'>>): string {
    // Check queue size to prevent quota exceeded
    if (this.queue.length >= this.maxQueueSize) {
      this.clearProcessedTasks()
    }

    const id = this.generateTaskId()
    const fullTask: SyncTask = {
      ...task,
      id,
      correlationId: task.correlationId || this.generateCorrelationId(),
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: task.maxRetries || this.maxRetries,
    }

    this.queue.push(fullTask)
    this.saveQueue()
    this.notifySubscribers()

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
          if (process.env.NODE_ENV === 'development') {
            console.debug(`[SyncQueue][${task.correlationId}] ${task.operation.toUpperCase()} ${task.table} success`)
          }
          // Remove successful task
          this.queue.shift()
          this.saveQueue()
          this.notifySubscribers()
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
      let result: { error?: { message: string } | null; data?: unknown } | null = null

      switch (task.operation) {
        case 'insert':
          result = await supabase.from(task.table).insert(task.data)
          break

        case 'update': {
          const updateData = Array.isArray(task.data) ? task.data[0] : task.data
          result = await supabase.from(task.table)
            .update(updateData)
            .eq('id', updateData.id)
          break
        }

        case 'delete': {
          const deleteData = Array.isArray(task.data) ? task.data[0] : task.data
          result = await supabase.from(task.table)
            .delete()
            .eq('id', deleteData.id)
          break
        }

        case 'upsert':
          result = await supabase.from(task.table)
            .upsert(task.data, { onConflict: task.onConflict || 'id' })
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
        .upsert(task.data, { onConflict: task.onConflict || 'id' })

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
    const correlationLabel = task.correlationId.slice(-8)

    if (task.retryCount >= task.maxRetries) {
      // Max retries reached, move to failed queue
      toast.error(`Sync failed (${correlationLabel}): ${error || 'Unknown error'}. Please check your connection.`)

      // Remove from queue
      this.queue.shift()
      this.saveQueue()

      // Optionally save to failed queue for manual retry
      this.saveToFailedQueue(task)
    } else {
      // Retry with exponential backoff
      const delay = this.retryDelay * Math.pow(2, task.retryCount - 1)
      await this.delay(delay)
      this.saveQueue()
    }
  }

  /**
   * Save queue to IndexedDB for persistence
   */
  private saveQueue() {
    try {
      // Limit queue size before saving, though IDB handles much more than localStorage
      if (this.queue.length > this.maxQueueSize) {
        this.queue = this.queue.slice(-this.maxQueueSize)
      }
      set('supabase-sync-queue', this.queue).catch(error => {
        console.error('Failed to save sync queue to IndexedDB:', error)
      })
    } catch (error) {
      console.error('Critical error triggering idb-keyval set:', error)
    }
  }

  /**
   * Load queue from IndexedDB (with localStorage migration fallback)
   */
  async loadQueue() {
    try {
      // 1. Check legacy localStorage for pending tasks to prevent data loss
      const legacyQueueStr = localStorage.getItem('supabase-sync-queue')
      if (legacyQueueStr && legacyQueueStr !== '[]') {
        try {
          const legacyParsed = JSON.parse(legacyQueueStr)
          this.queue = (Array.isArray(legacyParsed) ? legacyParsed : []).map((task: SyncTask) => ({
            ...task,
            correlationId: task.correlationId || this.generateCorrelationId(),
          }))
          console.warn('Migrated legacy sync queue from localStorage.', this.queue.length, 'items found.')
          this.saveQueue()
          localStorage.removeItem('supabase-sync-queue')
        } catch (e) {
          console.error('Failed parsing legacy queue', e)
        }
      } else {
        // 2. Load from IndexedDB
        const saved = await get<SyncTask[]>('supabase-sync-queue')
        if (saved) {
          this.queue = (Array.isArray(saved) ? saved : []).map((task: SyncTask) => ({
            ...task,
            correlationId: task.correlationId || this.generateCorrelationId(),
          }))
        }
      }

      // Migrate failed queue if it exists
      const legacyFailedStr = localStorage.getItem('supabase-failed-queue')
      if (legacyFailedStr && legacyFailedStr !== '[]') {
         try {
           const failed = JSON.parse(legacyFailedStr)
           await set('supabase-failed-queue', failed)
           this.failedTaskCount = failed.length
           localStorage.removeItem('supabase-failed-queue')
           localStorage.removeItem('supabase-sync-failed-queue')
         } catch (e) {
           console.error('Failed parsing legacy failed queue', e)
         }
      } else {
         const modernFailed = await get<SyncTask[]>('supabase-failed-queue')
         this.failedTaskCount = modernFailed ? modernFailed.length : 0
      }

      if (this.queue.length > 0) {
        this.processQueue()
      }
    } catch (error) {
      console.error('Failed to load sync queue:', error)
      // Do not clear corrupted data aggressively yet, let IDB handle it naturally
    }
  }

  /**
   * Clear processed tasks to free up memory (IDB handles deep storage)
   */
  private clearProcessedTasks() {
    if (this.queue.length > 500) {
      this.queue = this.queue.slice(0, 500)
      this.saveQueue()
    }
  }

  /**
   * Save failed task for manual retry
   */
  private async saveToFailedQueue(task: SyncTask) {
    try {
      const failed = await get<SyncTask[]>('supabase-failed-queue') || []
      failed.push(task)
      await set('supabase-failed-queue', failed)
      this.failedTaskCount = failed.length
      this.notifySubscribers()
    } catch (error) {
      console.error('Failed to save to failed queue:', error)
    }
  }

  /**
   * Get failed tasks count (Synchronous via memory cache)
   */
  getFailedCount(): number {
    return this.failedTaskCount
  }

  /**
   * Clear failed queue
   */
  async clearFailedQueue() {
    try {
      await del('supabase-failed-queue')
      this.failedTaskCount = 0
      this.notifySubscribers()
    } catch (err) {
      console.error('Failed to clear failed queue:', err)
    }
  }

  /**
   * Retry all failed tasks
   */
  async retryFailedTasks() {
    try {
      const failed = await get<SyncTask[]>('supabase-failed-queue') || []
      
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
   * Utility: Generate correlation ID for tracing sync lifecycle
   */
  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`
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

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ===========================
 * HIGH-LEVEL SYNC FUNCTIONS
 * ===========================
 */

/**
 * Sync single AHSP item (upsert — for new items)
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
      subcategory: item.subcategory || '',
      base_price: item.basePrice,
      final_price: item.finalPrice,
      overhead_percentage: item.overheadPercentage,
      profit_percentage: item.profitPercentage,
      price_material: item.price_material || 0,
      price_labor: item.price_labor || 0,
      price_equipment: item.price_equipment || 0,
      price_subcon: item.price_subcon || 0,
      status: item.status || 'draft',
      created_at: item.createdAt,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Update single AHSP item (UPDATE only — avoids RLS INSERT block for existing catalog items)
 */
export function syncAHSPItemUpdate(item: any): string {
  return syncQueue.enqueue({
    operation: 'update',
    table: 'ahsp_items',
    data: {
      id: item.id,
      base_price: item.basePrice,
      final_price: item.finalPrice,
      overhead_percentage: item.overheadPercentage,
      profit_percentage: item.profitPercentage,
      subcategory: item.subcategory || '',
      price_material: item.price_material || 0,
      price_labor: item.price_labor || 0,
      price_equipment: item.price_equipment || 0,
      price_subcon: item.price_subcon || 0,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync multiple AHSP items
 */
export function syncAHSPItems(items: any[]): string {
  if (!items.length) return ''

  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'ahsp_items',
    data: items.map(item => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      unit: item.unit,
      category: item.category,
      subcategory: item.subcategory || '',
      base_price: item.basePrice,
      final_price: item.finalPrice,
      overhead_percentage: item.overheadPercentage,
      profit_percentage: item.profitPercentage,
      price_material: item.price_material || 0,
      price_labor: item.price_labor || 0,
      price_equipment: item.price_equipment || 0,
      price_subcon: item.price_subcon || 0,
      status: item.status || 'draft',
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    maxRetries: 3,
    onConflict: 'code', // Use code as unique identifier to prevent duplicates
  })
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
      type: toDbResourceType(resource.type || 'material'),
      unit: resource.unit,
      unit_price: resource.unitPrice,
      supplier: resource.supplier,
      specifications: resource.specifications,
      is_active: resource.isActive,
      created_at: resource.createdAt,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync multiple resources (Batch)
 */
export function syncResources(resources: any[]): string {
  if (!resources.length) return ''

  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'resources',
    data: resources.map(resource => ({
      id: resource.id,
      code: resource.code,
      name: resource.name,
      type: toDbResourceType(resource.type || 'material'),
      unit: resource.unit,
      unit_price: resource.unitPrice,
      supplier: resource.supplier,
      specifications: resource.specifications,
      is_active: resource.isActive ?? true,
      created_at: resource.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
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
      type: toDbResourceType(component.type),
      coefficient: component.coefficient,
      unit: component.unit,
      unit_price: component.unitPrice,
      subtotal: component.subtotal,
      sort_order: component.sortOrder ?? 0,
      created_at: component.createdAt,
      updated_at: new Date().toISOString(),
    },
    maxRetries: 3,
  })
}

/**
 * Sync multiple AHSP components (Batch)
 */
export function syncAHSPComponents(components: any[]): string {
  if (!components.length) return ''

  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'ahsp_components',
    data: components.map(component => ({
      id: component.id,
      ahsp_id: component.ahspId,
      resource_id: component.resourceId,
      type: toDbResourceType(component.type),
      coefficient: component.coefficient,
      unit: component.unit,
      unit_price: component.unitPrice,
      subtotal: component.subtotal,
      sort_order: component.sortOrder ?? 0,
      created_at: component.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })),
    maxRetries: 3,
  })
}

/**
 * Sync AHSP Items with Components (Sequential)
 * This ensures parent AHSP items are synced BEFORE their components
 * to avoid foreign key constraint violations
 */
export async function syncAHSPItemsWithComponents(items: any[], components: any[]): Promise<void> {
  if (!items.length) return

  try {
    // Step 1: Sync all AHSP items first
    const itemsData = items.map(item => ({
      id: item.id,
      code: item.code,
      name: item.name,
      description: item.description,
      unit: item.unit,
      category: item.category,
      subcategory: item.subcategory || '',
      base_price: item.basePrice,
      final_price: item.finalPrice,
      overhead_percentage: item.overheadPercentage,
      profit_percentage: item.profitPercentage,
      price_material: item.price_material || 0,
      price_labor: item.price_labor || 0,
      price_equipment: item.price_equipment || 0,
      price_subcon: item.price_subcon || 0,
      status: item.status || 'draft',
      created_at: item.createdAt || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }))

    if (!supabase) {
      throw new Error('Supabase not initialized')
    }

    const { error: itemsError } = await supabase
      .from('ahsp_items')
      .upsert(itemsData, { onConflict: 'code' })

    if (itemsError) {
      throw new Error(`Failed to sync AHSP items: ${itemsError.message}`)
    }

    // Step 2: Only after items are synced, sync their components
    if (components.length > 0) {
      const componentsData = components.map(component => ({
        id: component.id,
        ahsp_id: component.ahspId,
        resource_id: component.resourceId,
        type: toDbResourceType(component.type),
        coefficient: component.coefficient,
        unit: component.unit,
        unit_price: component.unitPrice,
        subtotal: component.subtotal,
        sort_order: component.sortOrder ?? 0,
        created_at: component.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }))

      const { error: componentsError } = await supabase
        .from('ahsp_components')
        .upsert(componentsData, { onConflict: 'id' })

      if (componentsError) {
        throw new Error(`Failed to sync AHSP components: ${componentsError.message}`)
      }
    }

    toast.success(`Synced ${items.length} AHSP items with ${components.length} components`)
  } catch (error) {
    console.error('Failed to sync AHSP items with components:', error)
    toast.error(error instanceof Error ? error.message : 'Failed to sync AHSP data')
    throw error
  }
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
      base_price: item.base_price ?? null,
      unit_price: item.unit_price || item.unitPrice,
      cost_material: item.cost_material || 0,
      cost_labor: item.cost_labor || 0,
      cost_equipment: item.cost_equipment || 0,
      cost_subcon: item.cost_subcon || 0,
      markup_percentage: item.markup_percentage || 0,
      weight_percentage: item.weight_percentage || 0,
      final_total: item.final_total || item.finalTotal || item.finalPrice,
      is_domestic: item.is_domestic ?? true,
      tkdn_percentage: item.tkdn_percentage ?? 100,
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
      start_date: item.start_date || null,
      end_date: item.end_date || null,
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
      start_date: item.start_date || null,
      end_date: item.end_date || null,
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

import { useOfflineQueueStore } from '@/store/offlineQueueStore'

/**
 * Sync Progress Log with Evidence (Phase 11)
 */
export function syncProgressLog(log: any): string {
  if (!navigator.onLine) {
    useOfflineQueueStore.getState().addLog(log)
    return 'offline-queued'
  }
  return syncQueue.enqueue({
    operation: 'upsert',
    table: 'progress_logs',
    data: {
      id: log.id || `${log.projectId}-${log.date}`,
      project_id: log.projectId,
      date: log.date,
      progress_percentage: log.progress,
      actual_cost: log.actualCost,
      notes: log.notes,
      volume_daily: log.volume,
      evidence_url: log.photoUrl,
      gps_coordinates: log.gpsCoords ? `${log.gpsCoords.latitude},${log.gpsCoords.longitude}` : null,
      weather_condition: log.weather,
      delay_reason: log.delayReason,
      updated_at: new Date().toISOString(),
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
 * Sync component sort_order after drag-drop reorder.
 * Batch update: one syncQueue entry per component with its new position.
 */
export function syncComponentOrder(componentIds: string[]): void {
  componentIds.forEach((id, index) => {
    syncQueue.enqueue({
      operation: 'update',
      table: 'ahsp_components',
      data: { id, sort_order: index },
      maxRetries: 2,
    })
  })
}

/* eslint-enable @typescript-eslint/no-explicit-any */
/**
 * ===========================
 * EXPORTS
 * ===========================
 */

export default {
  syncQueue,
  syncAHSPItem,
  syncAHSPItems,
  syncAHSPItemsWithComponents,
  syncResource,
  syncAHSPComponent,
  syncAHSPComponents,
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
  syncProgressLog,
}
