/**
 * featureStore.ts
 *
 * Zustand store that holds FeatureConfig per project.
 * - Persists to localStorage under key `featureConfig:{projectId}`.
 * - Adds snapshot/versioning support: saveSnapshot, listSnapshots, restoreSnapshot, deleteSnapshot.
 * - Provides helpers: getConfig, setConfig, updateModuleConfig, resetToDefault, exportConfig.
 *
 * Notes:
 * - Snapshots are stored under localStorage key `featureConfigSnapshots:{projectId}` as an
 *   array of { id, name, createdAt, config } entries.
 * - All functions are defensive and aim to avoid unnecessary re-renders.
 */

import { create } from 'zustand'
import type { FeatureConfig } from '../config/featureSchema'
import { generateDefaultFeatureConfig } from '../lib/featureDefaults'
import { migrateConfig } from '../lib/featureMigrations'
import { nanoid } from 'nanoid/non-secure'
import { notify as toast } from '@/lib/toast'
import { validate, formatZodErrors } from '@/lib/validationMiddleware'
import {
  featureSnapshotInputSchema,
  moduleConfigUpdateSchema,
} from '@/lib/validationSchemas'
import { syncFeatureConfig, syncFeatureSnapshot } from '@/lib/supabaseSyncService'

/**
 * Shape of a saved snapshot/version for a project's feature config.
 */
export interface FeatureSnapshot {
  /** Unique snapshot id */
  id: string
  /** Human friendly name for the snapshot */
  name: string
  /** ISO timestamp when snapshot was created */
  createdAt: string
  /** Deep copy of the FeatureConfig at save time */
  config: FeatureConfig
}

/**
 * Shape of the feature store state.
 */
interface FeatureStoreState {
  /** Mapping projectId -> FeatureConfig */
  configs: Record<string, FeatureConfig>
  /** Load configuration for a project (from localStorage or generate default) */
  loadConfig: (projectId: string) => FeatureConfig
  /** Replace full config for project */
  setConfig: (projectId: string, cfg: FeatureConfig) => void
  /** Update a nested module config with a partial patch */
  updateModuleConfig: (projectId: string, moduleKey: keyof FeatureConfig | string, patch: any) => void
  /** Reset config to defaults (generator) */
  resetToDefault: (projectId: string) => FeatureConfig
  /** Export config (returning deep clone) */
  exportConfig: (projectId: string) => FeatureConfig | null

  /** Snapshot / versioning support */
  listSnapshots: (projectId: string) => FeatureSnapshot[]
  saveSnapshot: (projectId: string, name?: string) => FeatureSnapshot
  restoreSnapshot: (projectId: string, snapshotId: string) => FeatureConfig | null
  deleteSnapshot: (projectId: string, snapshotId: string) => void
}

/**
 * LocalStorage key helpers
 * @param projectId - project identifier
 */
function storageKey(projectId: string) {
  return `featureConfig:${projectId}`
}
function snapshotsKey(projectId: string) {
  return `featureConfigSnapshots:${projectId}`
}

/**
 * Safe parse from localStorage
 * @param projectId - project identifier
 * @returns FeatureConfig | null
 */
function readFromStorage(projectId: string): FeatureConfig | null {
  try {
    const raw = localStorage.getItem(storageKey(projectId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as FeatureConfig
    // run migration if needed
    return migrateConfig(parsed)
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('featureStore: failed to read from storage', e)
    return null
  }
}

/**
 * Safe write to localStorage
 * @param projectId - project identifier
 * @param cfg - feature config
 */
function writeToStorage(projectId: string, cfg: FeatureConfig) {
  try {
    localStorage.setItem(storageKey(projectId), JSON.stringify(cfg))
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('featureStore: failed to write to storage', e)
  }
}

/**
 * Snapshots read/write helpers
 */
function readSnapshotsFromStorage(projectId: string): FeatureSnapshot[] {
  try {
    const raw = localStorage.getItem(snapshotsKey(projectId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as FeatureSnapshot[]
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('featureStore: failed to read snapshots', e)
    return []
  }
}
function writeSnapshotsToStorage(projectId: string, snaps: FeatureSnapshot[]) {
  try {
    localStorage.setItem(snapshotsKey(projectId), JSON.stringify(snaps))
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn('featureStore: failed to write snapshots', e)
  }
}

/**
 * Create Zustand store
 */
export const useFeatureStore = create<FeatureStoreState>((set, get) => ({
  configs: {},

  loadConfig: (projectId: string) => {
    if (!projectId) throw new Error('loadConfig requires projectId')
    // prefer in-memory if present
    const existing = get().configs[projectId]
    if (existing) return existing
    // try localStorage
    const fromStorage = readFromStorage(projectId)
    const cfg = fromStorage ?? generateDefaultFeatureConfig(projectId)
    set((s) => ({ configs: { ...s.configs, [projectId]: cfg } }))
    // persist canonical copy
    writeToStorage(projectId, cfg)
    return cfg
  },

  setConfig: (projectId: string, cfg: FeatureConfig) => {
    if (!projectId) return
    // ensure migrated
    const next = migrateConfig(cfg)
    set((s) => {
      if (s.configs[projectId] === next) return s
      const nextMap = { ...s.configs, [projectId]: next }
      return { configs: nextMap }
    })
    writeToStorage(projectId, next)
    
    // Sync to Supabase
    syncFeatureConfig(next)
  },

  updateModuleConfig: (projectId: string, moduleKey: keyof FeatureConfig | string, patch: any) => {
    if (!projectId) return
    
    // Validate module config update
    const validation = validate(moduleConfigUpdateSchema, { moduleKey, patch })
    if (!validation.success) {
      toast.error('Validation Error', formatZodErrors(validation.errors))
      return
    }
    
    set((s) => {
      const prev = s.configs[projectId] ?? generateDefaultFeatureConfig(projectId)
      const modulePrev = (prev as any)[moduleKey] ?? {}
      const moduleNext = { ...modulePrev, ...patch }
      const nextConfig = { ...prev, [moduleKey]: moduleNext }
      // persist
      writeToStorage(projectId, nextConfig)
      
      // Sync to Supabase
      syncFeatureConfig(nextConfig)
      
      return { configs: { ...s.configs, [projectId]: nextConfig } }
    })
  },

  resetToDefault: (projectId: string) => {
    if (!projectId) throw new Error('resetToDefault requires projectId')
    const def = generateDefaultFeatureConfig(projectId)
    set((s) => ({ configs: { ...s.configs, [projectId]: def } }))
    writeToStorage(projectId, def)
    return def
  },

  exportConfig: (projectId: string) => {
    const c = get().configs[projectId] ?? readFromStorage(projectId) ?? null
    if (!c) return null
    // deep clone to avoid mutation
    return JSON.parse(JSON.stringify(c)) as FeatureConfig
  },

  /* Snapshot / versioning implementations */

  listSnapshots: (projectId: string) => {
    if (!projectId) return []
    return readSnapshotsFromStorage(projectId)
  },

  saveSnapshot: (projectId: string, name?: string) => {
    if (!projectId) throw new Error('saveSnapshot requires projectId')
    const cfg = get().configs[projectId] ?? readFromStorage(projectId) ?? generateDefaultFeatureConfig(projectId)
    
    const snapshotData = {
      projectId,
      name: name?.trim() || `Snapshot ${new Date().toLocaleString()}`,
      config: cfg,
    }
    
    // Validate snapshot data
    const validation = validate(featureSnapshotInputSchema, snapshotData)
    if (!validation.success) {
      toast.error('Snapshot Validation Error', formatZodErrors(validation.errors))
      throw new Error('Invalid snapshot data')
    }
    
    const snap: FeatureSnapshot = {
      id: nanoid(),
      name: snapshotData.name,
      createdAt: new Date().toISOString(),
      config: JSON.parse(JSON.stringify(cfg)),
    }
    const snaps = readSnapshotsFromStorage(projectId)
    snaps.unshift(snap) // latest first
    // keep reasonable limit (e.g., 50)
    const bounded = snaps.slice(0, 50)
    writeSnapshotsToStorage(projectId, bounded)
    
    // Sync to Supabase
    syncFeatureSnapshot(snap)
    
    toast.success('Snapshot saved successfully', snapshotData.name)
    return snap
  },

  restoreSnapshot: (projectId: string, snapshotId: string) => {
    if (!projectId) return null
    const snaps = readSnapshotsFromStorage(projectId)
    const found = snaps.find((s) => s.id === snapshotId)
    if (!found) {
      toast.error('Snapshot not found', `Snapshot ID: ${snapshotId}`)
      return null
    }
    const cfg = migrateConfig(found.config)
    // persist restored config
    set((s) => ({ configs: { ...s.configs, [projectId]: cfg } }))
    writeToStorage(projectId, cfg)
    
    toast.success('Snapshot restored successfully', found.name)
    return cfg
  },

  deleteSnapshot: (projectId: string, snapshotId: string) => {
    if (!projectId) return
    const snaps = readSnapshotsFromStorage(projectId).filter((s) => s.id !== snapshotId)
    writeSnapshotsToStorage(projectId, snaps)
  },
}))

export default useFeatureStore