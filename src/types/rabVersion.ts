/**
 * RAB Versioning Types
 * Track changes, revisions, and history for RAB items
 */

export interface RABVersion {
  id: string
  projectId: string
  version: number
  createdAt: string
  createdBy: string
  createdByName: string
  description: string
  changeType: 'create' | 'update' | 'delete' | 'bulk_update' | 'import' | 'restore'
  changes: RABChangeLog[]
  snapshot: RABVersionSnapshot
  status: 'draft' | 'published'
  tags?: string[]
}

export interface RABChangeLog {
  itemId: string
  itemCode: string
  itemName: string
  field: string
  oldValue: any
  newValue: any
  changeDescription: string
}

export interface RABVersionSnapshot {
  items: any[] // Full RAB items at this version
  totalItems: number
  totalCost: number
  metadata: {
    createdAt: string
    zone?: string
    categories: string[]
  }
}

export interface RABVersionComparison {
  added: any[]
  removed: any[]
  modified: Array<{
    item: any
    changes: {
      field: string
      oldValue: any
      newValue: any
    }[]
  }>
  summary: {
    totalChanges: number
    itemsAdded: number
    itemsRemoved: number
    itemsModified: number
    costDifference: number
  }
}

export interface RABVersionStore {
  versionsByProject: Record<string, RABVersion[]>
  currentVersion: Record<string, number> // projectId -> version number
  
  // Actions
  createVersion: (projectId: string, description: string, changeType: RABVersion['changeType'], changes: RABChangeLog[]) => Promise<void>
  getVersionHistory: (projectId: string) => RABVersion[]
  getVersion: (projectId: string, version: number) => RABVersion | null
  compareVersions: (projectId: string, version1: number, version2: number) => RABVersionComparison
  restoreVersion: (projectId: string, version: number) => Promise<void>
  deleteVersion: (projectId: string, versionId: string) => void
}
