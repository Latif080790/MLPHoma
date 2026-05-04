/**
 * projectStore.test.ts
 * Unit tests for project store — focuses on key business logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sync service BEFORE importing store
vi.mock('../../lib/supabaseSyncService', () => ({
  syncProject: vi.fn(() => 'queue-id'),
  syncDelete: vi.fn(() => 'queue-id'),
}))

vi.mock('../../lib/supabaseClient', () => ({
  fetchProjects: vi.fn(),
  supabase: null,
  assertSupabase: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  })),
}))

vi.mock('../../lib/validationMiddleware', () => ({
  validate: vi.fn((_schema: any, data: any) => ({ success: true, data })),
}))

vi.mock('../../lib/validationSchemas', () => ({
  projectInputSchema: {},
  projectUpdateSchema: {},
}))

vi.mock('sonner', () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock('../authStore', () => ({
  useAuthStore: { getState: () => ({ user: { id: 'user-1' } }) },
}))

import { useProjectStore } from '../projectStore'

describe('projectStore', () => {
  beforeEach(() => {
    useProjectStore.setState({
      projects: {
        'P-001': { id: 'P-001', name: 'Test Project', budget: 1_000_000, status: 'Active' },
        'P-002': { id: 'P-002', name: 'Other Project', budget: 2_000_000, status: 'Planning' },
      },
      activeProjectId: 'P-001',
    })
    vi.clearAllMocks()
  })

  it('should get project by id', () => {
    const project = useProjectStore.getState().getProject('P-001')
    expect(project?.name).toBe('Test Project')
  })

  it('should get active project', () => {
    const project = useProjectStore.getState().getActiveProject()
    expect(project?.id).toBe('P-001')
  })

  it('should set active project', () => {
    useProjectStore.getState().setActiveProject('P-002')
    expect(useProjectStore.getState().activeProjectId).toBe('P-002')
  })

  it('should set active project to undefined', () => {
    useProjectStore.getState().setActiveProject(undefined)
    expect(useProjectStore.getState().activeProjectId).toBeUndefined()
  })

  it('getProjects should return stable array', () => {
    const projects1 = useProjectStore.getState().getProjects()
    const projects2 = useProjectStore.getState().getProjects()
    expect(projects1).toBe(projects2) // Same reference (cached)
    expect(projects1).toHaveLength(2)
  })

  describe('archiveProject', () => {
    it('should mark project as ARCHIVED optimistically', async () => {
      await useProjectStore.getState().archiveProject('P-001')
      const project = useProjectStore.getState().projects['P-001']
      expect(project.status).toBe('ARCHIVED')
    })

    it('should call syncProject with archived data', async () => {
      const { syncProject } = await import('../../lib/supabaseSyncService')
      await useProjectStore.getState().archiveProject('P-001')
      expect(syncProject).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'P-001',
          status: 'ARCHIVED',
          archived_at: expect.any(String),
        })
      )
    })

    it('should not archive if projectId is empty', async () => {
      const { syncProject } = await import('../../lib/supabaseSyncService')
      await useProjectStore.getState().archiveProject('')
      expect(syncProject).not.toHaveBeenCalled()
    })

    it('should not crash for non-existent project', async () => {
      const { syncProject } = await import('../../lib/supabaseSyncService')
      await useProjectStore.getState().archiveProject('NONEXISTENT')
      // syncProject should not be called since project doesn't exist
      expect(syncProject).not.toHaveBeenCalled()
    })
  })

  describe('removeProject', () => {
    it('should remove project from store', () => {
      useProjectStore.getState().removeProject('P-001')
      expect(useProjectStore.getState().projects['P-001']).toBeUndefined()
    })

    it('should switch active project when removing active', () => {
      useProjectStore.getState().removeProject('P-001')
      // Should auto-select next available project
      const state = useProjectStore.getState()
      expect(state.activeProjectId).not.toBe('P-001')
    })

    it('should call syncDelete', async () => {
      const { syncDelete } = await import('../../lib/supabaseSyncService')
      useProjectStore.getState().removeProject('P-001')
      expect(syncDelete).toHaveBeenCalledWith('projects', 'P-001')
    })
  })
})
