/**
 * timelineStore.test.ts
 * Comprehensive tests for Timeline Store
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTimelineStore } from '../timelineStore'
import type { TimelineTask } from '../timelineStore'
import * as supabaseSyncService from '@/lib/supabaseSyncService'
import * as sonner from 'sonner'

// Mock dependencies
vi.mock('@/lib/supabaseSyncService', () => ({
  syncTimelineTask: vi.fn().mockResolvedValue({ success: true }),
  syncDelete: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}))

describe('timelineStore', () => {
  const projectId = 'test-project'

  beforeEach(() => {
    // Reset store to initial state
    useTimelineStore.setState({
      tasksByProject: {},
    })
    vi.clearAllMocks()
  })

  describe('addTask', () => {
    it('should add a task with auto-calculated duration', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      expect(taskId).toBeTruthy()
      
      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].name).toBe('Task 1')
      expect(tasks[0].duration).toBe(5) // Inclusive: 01-01 to 01-05 = 5 days
      expect(tasks[0].startDate).toBe('2024-01-01')
      expect(tasks[0].endDate).toBe('2024-01-05')
    })

    it('should calculate endDate from duration if not provided', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 2',
        startDate: '2024-01-01',
        duration: 10,
        progress: 0,
        status: 'not_started',
        priority: 'high',
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks).toHaveLength(1)
      expect(tasks[0].duration).toBe(10)
      expect(tasks[0].endDate).toBe('2024-01-10') // 1 + 10 - 1 = 10
    })

    it('should validate required fields', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: '', // Invalid: empty name
        startDate: '2024-01-01',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      } as any)

      expect(taskId).toBe('') // Should return empty string on validation failure
      expect(sonner.toast.error).toHaveBeenCalled()
      
      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks).toHaveLength(0)
    })

    it('should add task with dependencies', () => {
      // Add predecessor task
      const task1Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      // Add successor task with dependency
      const task2Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 2',
        startDate: '2024-01-06',
        endDate: '2024-01-10',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
        dependencies: [
          {
            id: 'dep-1',
            predecessorId: task1Id,
            successorId: 'temp', // Will be replaced with task2Id
            type: 'FS',
            lag: 0,
          },
        ],
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks).toHaveLength(2)
      
      const task2 = tasks.find(t => t.id === task2Id)
      expect(task2?.dependencies).toHaveLength(1)
      expect(task2?.dependencies?.[0].type).toBe('FS')
    })

    it('should sync new task to Supabase', () => {
      useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      expect(supabaseSyncService.syncTimelineTask).toHaveBeenCalled()
    })

    it('should persist progress evidence metadata when provided', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Task with Evidence',
        startDate: '2024-01-01',
        endDate: '2024-01-02',
        progress: 20,
        status: 'in_progress',
        priority: 'medium',
        progressEvidence: {
          photoUrl: 'https://example.com/photo.jpg',
          capturedAt: '2024-01-01T10:00:00.000Z',
          latitude: -6.2,
          longitude: 106.8,
          hasPhoto: true,
          hasTimestamp: true,
          hasLocation: true,
        },
      })

      const task = useTimelineStore.getState().getTasks(projectId).find((t) => t.id === taskId)
      expect(task?.progressEvidence?.photoUrl).toBe('https://example.com/photo.jpg')
      expect(task?.progressEvidence?.hasLocation).toBe(true)
    })
  })

  describe('updateTask', () => {
    it('should update task properties', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Original Name',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      useTimelineStore.getState().updateTask(projectId, taskId, {
        name: 'Updated Name',
        progress: 50,
        status: 'in_progress',
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      const task = tasks.find(t => t.id === taskId)
      
      expect(task?.name).toBe('Updated Name')
      expect(task?.progress).toBe(50)
      expect(task?.status).toBe('in_progress')
    })

    it('should recalculate duration when dates are updated', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      useTimelineStore.getState().updateTask(projectId, taskId, {
        startDate: '2024-01-01',
        endDate: '2024-01-10',
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      const task = tasks.find(t => t.id === taskId)
      
      expect(task?.duration).toBe(10) // Recalculated
    })

    it('should validate update data', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      useTimelineStore.getState().updateTask(projectId, taskId, {
        progress: 150, // Invalid: >100
      })

      expect(sonner.toast.error).toHaveBeenCalled()
    })

    it('should sync updated task to Supabase', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      vi.clearAllMocks()

      useTimelineStore.getState().updateTask(projectId, taskId, {
        name: 'Updated Name',
      })

      expect(supabaseSyncService.syncTimelineTask).toHaveBeenCalled()
    })
  })

  describe('updateTaskDates', () => {
    it('should update task dates via dedicated method', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      useTimelineStore.getState().updateTaskDates(projectId, taskId, {
        startDate: '2024-01-10',
        endDate: '2024-01-20',
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      const task = tasks.find(t => t.id === taskId)
      
      expect(task?.startDate).toBe('2024-01-10')
      expect(task?.endDate).toBe('2024-01-20')
      expect(task?.duration).toBe(11)
    })
  })

  describe('removeTask', () => {
    it('should remove a task', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Task to delete',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      useTimelineStore.getState().removeTask(projectId, taskId)

      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks).toHaveLength(0)
      expect(supabaseSyncService.syncDelete).toHaveBeenCalledWith('timeline_tasks', taskId)
    })

    it('should clean up dependencies when task is removed', () => {
      // Add two tasks with dependency
      const task1Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      const task2Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 2',
        startDate: '2024-01-06',
        endDate: '2024-01-10',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
        dependencies: [
          {
            id: 'dep-1',
            predecessorId: task1Id,
            successorId: 'temp', // Will use actual task2Id
            type: 'FS',
            lag: 0,
          },
        ],
      })

      // Remove task 1
      useTimelineStore.getState().removeTask(projectId, task1Id)

      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks).toHaveLength(1)
      
      const task2 = tasks.find(t => t.id === task2Id)
      expect(task2?.dependencies).toHaveLength(0) // Dependency should be cleaned up
    })
  })

  describe('setBaseline', () => {
    it('should set baseline dates for all tasks', () => {
      useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      useTimelineStore.getState().setBaseline(projectId)

      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks[0].baselineStartDate).toBe('2024-01-01')
      expect(tasks[0].baselineEndDate).toBe('2024-01-05')
    })

    it('should not overwrite existing baseline when overwrite=false', () => {
      const taskId = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      // Set initial baseline
      useTimelineStore.getState().setBaseline(projectId)

      // Update dates
      useTimelineStore.getState().updateTask(projectId, taskId, {
        startDate: '2024-01-10',
        endDate: '2024-01-15',
      })

      // Set baseline again with overwrite=false
      useTimelineStore.getState().setBaseline(projectId, false)

      const tasks = useTimelineStore.getState().getTasks(projectId)
      // Baseline should remain original
      expect(tasks[0].baselineStartDate).toBe('2024-01-01')
      expect(tasks[0].baselineEndDate).toBe('2024-01-05')
      // Actual dates should be updated
      expect(tasks[0].startDate).toBe('2024-01-10')
      expect(tasks[0].endDate).toBe('2024-01-15')
    })
  })

  describe('getTasks', () => {
    it('should return tasks sorted by startDate', () => {
      useTimelineStore.getState().addTask(projectId, {
        name: 'Task C',
        startDate: '2024-01-15',
        endDate: '2024-01-20',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      useTimelineStore.getState().addTask(projectId, {
        name: 'Task A',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      useTimelineStore.getState().addTask(projectId, {
        name: 'Task B',
        startDate: '2024-01-10',
        endDate: '2024-01-14',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks).toHaveLength(3)
      expect(tasks[0].name).toBe('Task A')
      expect(tasks[1].name).toBe('Task B')
      expect(tasks[2].name).toBe('Task C')
    })

    it('should sort by name when startDate is the same', () => {
      useTimelineStore.getState().addTask(projectId, {
        name: 'Zebra Task',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      useTimelineStore.getState().addTask(projectId, {
        name: 'Alpha Task',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks[0].name).toBe('Alpha Task')
      expect(tasks[1].name).toBe('Zebra Task')
    })
  })

  describe('setTasks', () => {
    it('should replace all tasks for a project', () => {
      const newTasks: TimelineTask[] = [
        {
          id: 'task-1',
          projectId,
          name: 'Task 1',
          startDate: '2024-01-01',
          endDate: '2024-01-05',
          duration: 5,
          progress: 0,
          status: 'not_started',
          priority: 'medium',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
        {
          id: 'task-2',
          projectId,
          name: 'Task 2',
          startDate: '2024-01-10',
          endDate: '2024-01-15',
          duration: 6,
          progress: 50,
          status: 'in_progress',
          priority: 'high',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ]

      useTimelineStore.getState().setTasks(projectId, newTasks)

      const tasks = useTimelineStore.getState().getTasks(projectId)
      expect(tasks).toHaveLength(2)
      expect(tasks[0].name).toBe('Task 1')
      expect(tasks[1].name).toBe('Task 2')
    })
  })

  describe('dependency types', () => {
    it('should support FS (Finish-to-Start) dependency', () => {
      const task1Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Predecessor',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      const task2Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Successor',
        startDate: '2024-01-06',
        endDate: '2024-01-10',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
        dependencies: [
          {
            id: 'dep-1',
            predecessorId: task1Id,
            successorId: 'temp',
            type: 'FS',
            lag: 0,
          },
        ],
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      const successor = tasks.find(t => t.id === task2Id)
      
      expect(successor?.dependencies?.[0].type).toBe('FS')
    })

    it('should support SS (Start-to-Start) dependency', () => {
      const task1Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      const task2Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 2',
        startDate: '2024-01-01',
        endDate: '2024-01-10',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
        dependencies: [
          {
            id: 'dep-1',
            predecessorId: task1Id,
            successorId: 'temp',
            type: 'SS',
            lag: 0,
          },
        ],
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      const task2 = tasks.find(t => t.id === task2Id)
      
      expect(task2?.dependencies?.[0].type).toBe('SS')
    })

    it('should support lag time in dependencies', () => {
      const task1Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 1',
        startDate: '2024-01-01',
        endDate: '2024-01-05',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
      })

      const task2Id = useTimelineStore.getState().addTask(projectId, {
        name: 'Task 2',
        startDate: '2024-01-08',
        endDate: '2024-01-10',
        progress: 0,
        status: 'not_started',
        priority: 'medium',
        dependencies: [
          {
            id: 'dep-1',
            predecessorId: task1Id,
            successorId: 'temp',
            type: 'FS',
            lag: 2, // 2 days lag
          },
        ],
      })

      const tasks = useTimelineStore.getState().getTasks(projectId)
      const task2 = tasks.find(t => t.id === task2Id)
      
      expect(task2?.dependencies?.[0].lag).toBe(2)
    })
  })
})
