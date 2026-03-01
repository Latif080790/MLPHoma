/**
 * RAB Version Store
 * Manages version history, comparisons, and restoration for RAB items
 */

import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'
import type { RABVersion, RABChangeLog, RABVersionSnapshot, RABVersionComparison } from '../types/rabVersion'
import { generateId } from '../lib/idGenerator'
import { toast } from 'sonner'
import { supabase } from '../lib/supabaseClient'

interface RABVersionState {
  versionsByProject: Record<string, RABVersion[]>
  currentVersion: Record<string, number>
  loading: boolean

  // Actions
  createVersion: (projectId: string, description: string, changeType: RABVersion['changeType'], changes: RABChangeLog[], snapshot: RABVersionSnapshot, tags?: string[]) => Promise<void>
  getScenarios: (projectId: string) => RABVersion[]
  getVersionHistory: (projectId: string) => RABVersion[]
  getVersion: (projectId: string, version: number) => RABVersion | null
  compareVersions: (projectId: string, version1: number, version2: number) => RABVersionComparison
  restoreVersion: (projectId: string, version: number) => Promise<void>
  deleteVersion: (projectId: string, versionId: string) => void
  fetchVersionsFromSupabase: (projectId: string) => Promise<void>
}

export const useRABVersionStore = create<RABVersionState>()(
  devtools(
    persist(
      (set, get) => ({
        versionsByProject: {},
        currentVersion: {},
        loading: false,

        createVersion: async (projectId, description, changeType, changes, snapshot, tags = []) => {
          const state = get()
          const projectVersions = state.versionsByProject[projectId] || []
          const currentVer = state.currentVersion[projectId] || 0
          const newVersion = currentVer + 1

          const version: RABVersion = {
            id: generateId('rab-ver'),
            projectId,
            version: newVersion,
            createdAt: new Date().toISOString(),
            createdBy: 'current-user', // TODO: Get from auth store
            createdByName: 'Current User',
            description,
            changeType,
            changes,
            snapshot,
            status: 'draft',
            tags
          }

          // Update local state
          set(state => ({
            versionsByProject: {
              ...state.versionsByProject,
              [projectId]: [...projectVersions, version]
            },
            currentVersion: {
              ...state.currentVersion,
              [projectId]: newVersion
            }
          }))

          // Sync to Supabase
          if (supabase) {
            try {
              const { error } = await supabase.from('rab_versions').insert({
                id: version.id,
                project_id: projectId,
                version: newVersion,
                created_by: version.createdBy,
                created_by_name: version.createdByName,
                description,
                change_type: changeType,
                changes: JSON.stringify(changes),
                snapshot: JSON.stringify(snapshot),
                status: 'draft',
                tags,
                created_at: version.createdAt
              })

              if (error) {
                console.error('Failed to sync version to Supabase:', error)
              }
            } catch (err) {
              console.error('Error syncing version:', err)
            }
          }

          toast.success(`Version ${newVersion} created`)
        },

        getScenarios: (projectId) => {
          const versions = get().versionsByProject[projectId] || []
          return versions.filter(v => v.tags?.includes('scenario'))
        },

        getVersionHistory: (projectId) => {
          return get().versionsByProject[projectId] || []
        },

        getVersion: (projectId, version) => {
          const versions = get().versionsByProject[projectId] || []
          return versions.find(v => v.version === version) || null
        },

        compareVersions: (projectId, version1, version2) => {
          const v1 = get().getVersion(projectId, version1)
          const v2 = get().getVersion(projectId, version2)

          if (!v1 || !v2) {
            return {
              added: [],
              removed: [],
              modified: [],
              summary: {
                totalChanges: 0,
                itemsAdded: 0,
                itemsRemoved: 0,
                itemsModified: 0,
                costDifference: 0
              }
            }
          }

          const items1 = new Map(v1.snapshot.items.map(item => [item.id, item]))
          const items2 = new Map(v2.snapshot.items.map(item => [item.id, item]))

          const added: RABItem[] = []
          const removed: RABItem[] = []
          const modified: Array<{ item1: RABItem; item2: RABItem; changes: Array<{ field: string; from: unknown; to: unknown }> }> = []

          // Find added items
          items2.forEach((item, id) => {
            if (!items1.has(id)) {
              added.push(item)
            }
          })

          // Find removed items
          items1.forEach((item, id) => {
            if (!items2.has(id)) {
              removed.push(item)
            }
          })

          // Find modified items
          items1.forEach((item1, id) => {
            const item2 = items2.get(id)
            if (item2) {
              const changes: Array<{ field: string; from: unknown; to: unknown }> = []

              // Check key fields for changes
              const fieldsToCheck = ['name', 'volume', 'unit_price', 'cost_material', 'cost_labor', 'cost_equipment', 'cost_subcon']

              fieldsToCheck.forEach(field => {
                if (item1[field] !== item2[field]) {
                  changes.push({
                    field,
                    oldValue: item1[field],
                    newValue: item2[field]
                  })
                }
              })

              if (changes.length > 0) {
                modified.push({ item: item2, changes })
              }
            }
          })

          const costDiff = v2.snapshot.totalCost - v1.snapshot.totalCost

          return {
            added,
            removed,
            modified,
            summary: {
              totalChanges: added.length + removed.length + modified.length,
              itemsAdded: added.length,
              itemsRemoved: removed.length,
              itemsModified: modified.length,
              costDifference: costDiff
            }
          }
        },

        restoreVersion: async (projectId, version) => {
          const versionData = get().getVersion(projectId, version)
          if (!versionData) {
            toast.error('Version not found')
            return
          }

          // Create a restore version entry
          await get().createVersion(
            projectId,
            `Restored from version ${version}`,
            'restore',
            [{
              itemId: 'restore',
              itemCode: 'RESTORE',
              itemName: 'Version Restore',
              field: 'version',
              oldValue: get().currentVersion[projectId],
              newValue: version,
              changeDescription: `Restored to version ${version}`
            }],
            versionData.snapshot
          )

          toast.success(`Restored to version ${version}`)
        },

        deleteVersion: (projectId, versionId) => {
          set(state => ({
            versionsByProject: {
              ...state.versionsByProject,
              [projectId]: (state.versionsByProject[projectId] || []).filter(v => v.id !== versionId)
            }
          }))

          // Sync to Supabase
          if (supabase) {
            supabase.from('rab_versions').delete().eq('id', versionId).then(({ error }) => {
              if (error) {
                console.error('Failed to delete version from Supabase:', error)
              }
            })
          }

          toast.success('Version deleted')
        },

        fetchVersionsFromSupabase: async (projectId) => {
          if (!supabase) return

          set({ loading: true })

          try {
            const { data, error } = await supabase
              .from('rab_versions')
              .select('*')
              .eq('project_id', projectId)
              .order('version', { ascending: true })

            if (error) throw error

            if (data) {
              const versions: RABVersion[] = data.map(row => ({
                id: row.id,
                projectId: row.project_id,
                version: row.version,
                createdAt: row.created_at,
                createdBy: row.created_by,
                createdByName: row.created_by_name,
                description: row.description,
                changeType: row.change_type,
                changes: JSON.parse(row.changes),
                snapshot: JSON.parse(row.snapshot),
                status: row.status,
                tags: row.tags || []
              }))

              const maxVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version)) : 0

              set(state => ({
                versionsByProject: {
                  ...state.versionsByProject,
                  [projectId]: versions
                },
                currentVersion: {
                  ...state.currentVersion,
                  [projectId]: maxVersion
                },
                loading: false
              }))
            }
          } catch (error) {
            console.error('Error fetching versions:', error)
            set({ loading: false })
          }
        }
      }),
      {
        name: 'rab-version-storage',
        partialize: (state) => ({
          versionsByProject: state.versionsByProject,
          currentVersion: state.currentVersion
        })
      }
    )
  )
)
