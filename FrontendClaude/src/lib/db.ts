/**
 * db.ts
 * 
 * Enterprise-grade local persistence layer using Dexie (IndexedDB).
 * Provides high-performance storage for large datasets (10k+ items) 
 * that exceeds localStorage limits.
 */

import Dexie, { Table } from 'dexie'
import type { AHSPItem, Resource, AHSPComponent } from '../types/ahsp'
import type { RABItem } from '@/types/rab'
import type { TimelineTask } from '@/types/timeline'

export class MLPHomaDB extends Dexie {
  // Tables
  ahsp!: Table<AHSPItem>
  resources!: Table<Resource>
  components!: Table<AHSPComponent>
  rabItems!: Table<RABItem>
  tasks!: Table<TimelineTask>
  projects!: Table<any> // Generic project metadata cache
  auditLogs!: Table<any>

  constructor() {
    super('MLPHomaDB')
    
    // Define schema
    // Primary key is the first field, following fields are indices
    this.version(1).stores({
      ahsp: 'id, code, category, tags',
      resources: 'id, code, type',
      components: 'id, ahspId, resourceId',
      rabItems: 'id, project_id, wbs_id',
      tasks: 'id, projectId, wbsId, status',
      projects: 'id, code, status',
      auditLogs: '++id, timestamp, entityId, type'
    })
  }

  /**
   * Clear all local data (useful for logout or cache reset)
   */
  async clearAll() {
    await Promise.all([
      this.ahsp.clear(),
      this.resources.clear(),
      this.components.clear(),
      this.rabItems.clear(),
      this.tasks.clear(),
      this.projects.clear(),
      this.auditLogs.clear()
    ])
  }
}

export const db = new MLPHomaDB()
