/**
 * featureStore.test.ts
 *
 * Unit tests for featureStore behaviors:
 * - loadConfig / setConfig
 * - snapshot save / list / restore / delete
 *
 * Note: tests use vitest/jest style. If your CI uses a different runner, adapt accordingly.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useFeatureStore } from '../featureStore'
import { useAuthStore } from '../authStore'
import { generateDefaultFeatureConfig } from '../../lib/featureDefaults'
import { auditService } from '../../services/auditService'

describe('featureStore basic operations', () => {
  const pid = 'test-project-1'
  const logSpy = vi.spyOn(auditService, 'log').mockResolvedValue(undefined)

  beforeEach(() => {
    // clear localStorage keys for a clean slate
    localStorage.removeItem(`featureConfig:${pid}`)
    localStorage.removeItem(`featureConfigSnapshots:${pid}`)
    // reset in-memory store
    useFeatureStore.setState({ configs: {} } as any)
    useAuthStore.setState({
      user: { id: 'u-feature-1', email: 'feature@audit.test' },
      profile: { full_name: 'Feature Auditor' },
    } as any)
    logSpy.mockClear()
  })

  it('loads default config when none exists', () => {
    const cfg = useFeatureStore.getState().loadConfig(pid)
    expect(cfg).toBeDefined()
    expect(cfg.projectId).toBe(pid)
  })

  it('can save and export config', () => {
    const def = generateDefaultFeatureConfig(pid)
    def.projectManagement!.meta.name = 'My project config'
    useFeatureStore.getState().setConfig(pid, def)
    const exported = useFeatureStore.getState().exportConfig(pid)
    expect(exported).not.toBeNull()
    expect(exported!.projectManagement.meta.name).toBe('My project config')
  })

  it('snapshot lifecycle: save -> list -> restore -> delete', () => {
    const store = useFeatureStore.getState()
    // ensure there is a config
    const initial = store.loadConfig(pid)
    initial.projectManagement.meta.name = 'before-snapshot'
    store.setConfig(pid, initial)

    // save snapshot
    const snap = store.saveSnapshot(pid, 'snap1')
    expect(snap).toBeDefined()
    let snaps = store.listSnapshots(pid)
    expect(snaps.length).toBeGreaterThanOrEqual(1)
    expect(snaps[0].name).toBe('snap1')

    // mutate config then restore
    const mutated = { ...initial }
    mutated.projectManagement.meta.name = 'mutated'
    store.setConfig(pid, mutated)
    expect(store.exportConfig(pid)!.projectManagement.meta.name).toBe('mutated')

    const restored = store.restoreSnapshot(pid, snap.id)
    expect(restored).not.toBeNull()
    expect(restored!.projectManagement.meta.name).toBe('before-snapshot')

    // delete snapshot
    store.deleteSnapshot(pid, snap.id)
    snaps = store.listSnapshots(pid)
    expect(snaps.find((s) => s.id === snap.id)).toBeUndefined()
  })

  it('rejects saveSnapshot when config shape is invalid', () => {
    useFeatureStore.setState({
      configs: {
        [pid]: {
          projectId: pid,
        } as any,
      },
    } as any)

    expect(() => useFeatureStore.getState().saveSnapshot(pid, 'invalid-shape')).toThrow('Invalid snapshot config')
  })

  it('ignores invalid snapshot entries during restore/list', () => {
    const invalidSnapshot = {
      id: 'broken-1',
      name: 'Broken Snapshot',
      createdAt: new Date().toISOString(),
      config: {
        projectId: pid,
      },
    }

    localStorage.setItem(`featureConfigSnapshots:${pid}`, JSON.stringify([invalidSnapshot]))

    const store = useFeatureStore.getState()
    expect(store.listSnapshots(pid)).toEqual([])
    expect(store.restoreSnapshot(pid, 'broken-1')).toBeNull()
  })

  it('logs audit trail with actor context on module updates and snapshot lifecycle', () => {
    const store = useFeatureStore.getState()
    store.loadConfig(pid)

    store.updateModuleConfig(pid, 'reporting', {
      dashboard: {
        widgets: ['kpiBudget'],
        refreshIntervalSeconds: 10,
        defaultDateRangeDays: 30,
      },
    })

    const snapshot = store.saveSnapshot(pid, 'Audit Snapshot')
    store.restoreSnapshot(pid, snapshot.id)

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-feature-1',
        userName: 'Feature Auditor',
        entity: 'feature_config',
        entityType: 'FEATURE_CONFIG',
        entityId: pid,
      })
    )

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'UPDATE',
        details: expect.objectContaining({
          operation: 'update_module',
          moduleKey: 'reporting',
        }),
      })
    )

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'SNAPSHOT',
        details: expect.objectContaining({
          operation: 'save_snapshot',
          snapshotName: 'Audit Snapshot',
        }),
      })
    )

    expect(logSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'REVERT',
        details: expect.objectContaining({
          operation: 'restore_snapshot',
        }),
      })
    )
  })
})