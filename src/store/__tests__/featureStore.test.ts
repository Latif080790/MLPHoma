/**
 * featureStore.test.ts
 *
 * Unit tests for featureStore behaviors:
 * - loadConfig / setConfig
 * - snapshot save / list / restore / delete
 *
 * Note: tests use vitest/jest style. If your CI uses a different runner, adapt accordingly.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useFeatureStore } from '../featureStore'
import { generateDefaultFeatureConfig } from '../../lib/featureDefaults'

describe('featureStore basic operations', () => {
  const pid = 'test-project-1'
  beforeEach(() => {
    // clear localStorage keys for a clean slate
    localStorage.removeItem(`featureConfig:${pid}`)
    localStorage.removeItem(`featureConfigSnapshots:${pid}`)
    // reset in-memory store
    useFeatureStore.setState({ configs: {} } as any)
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
})