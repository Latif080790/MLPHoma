/**
 * curvaSStore.test.ts
 * Comprehensive tests for Curva-S Store
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useCurvaSStore } from '../curvaSStore'
import type { SavedScenario } from '../curvaSStore'
import * as supabaseSyncService from '@/lib/supabaseSyncService'
import * as toast from '@/lib/toast'

// Mock dependencies
vi.mock('@/lib/supabaseSyncService', () => ({
  syncCurvaSDataPoint: vi.fn().mockResolvedValue({ success: true }),
  syncCurvaSAnalysis: vi.fn().mockResolvedValue({ success: true }),
  syncCurvaSScenario: vi.fn().mockResolvedValue({ success: true }),
  syncDelete: vi.fn().mockResolvedValue({ success: true }),
}))

vi.mock('@/lib/toast', () => {
  const mockNotify = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }
  return {
    notify: mockNotify,
    default: mockNotify,
  }
})

describe('curvaSStore', () => {
  const projectId = 'test-project'

  beforeEach(() => {
    // Reset store to initial state
    useCurvaSStore.setState({
      dataPoints: {},
      analyses: {},
      configs: {},
      savedScenarios: {},
    })
    vi.clearAllMocks()
  })


  describe('addDataPoint', () => {
    it('should add a data point', () => {
      useCurvaSStore.getState().addDataPoint(projectId, {
        id: 'point-1',
        projectId,
        date: '2024-01-31',
        plannedProgress: 10,
        actualProgress: 8,
        plannedCost: 100000,
        actualCost: 90000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      const dataPoints = useCurvaSStore.getState().getDataPoints(projectId)
      expect(dataPoints.length).toBeGreaterThan(0)
      
      const point = dataPoints.find(p => p.id === 'point-1')
      expect(point).toBeDefined()
      expect(point?.actualProgress).toBe(8)
      expect(point?.actualCost).toBe(90000)
    })

    it('should validate data point fields', () => {
      // Invalid: progress > 100
      useCurvaSStore.getState().addDataPoint(projectId, {
        id: 'point-invalid',
        projectId,
        date: '2024-01-31',
        plannedProgress: 150, // Invalid
        actualProgress: 0,
        plannedCost: 100000,
        actualCost: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      expect(toast.notify.error).toHaveBeenCalled()
    })

    it('should sync data point to Supabase', () => {
      useCurvaSStore.getState().addDataPoint(projectId, {
        id: 'point-1',
        projectId,
        date: '2024-01-31',
        plannedProgress: 10,
        actualProgress: 8,
        plannedCost: 100000,
        actualCost: 90000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      expect(supabaseSyncService.syncCurvaSDataPoint).toHaveBeenCalled()
    })
  })

  describe('analyzeProject', () => {
    it('should compute SPI/CPI analysis', () => {
      // Generate baseline first
      useCurvaSStore.getState().setPlannedFromRap(
        projectId,
        [{ period: '2024-01-31', planned: 1000000 }],
        1000000
      )

      // Add actual progress
      useCurvaSStore.getState().addDataPoint(projectId, {
        id: 'point-1',
        projectId,
        date: '2024-01-31',
        plannedProgress: 16.67,
        actualProgress: 15,
        plannedCost: 166700,
        actualCost: 180000,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

      // Run analysis
      useCurvaSStore.getState().analyzeProject(projectId)

      const analysis = useCurvaSStore.getState().getAnalysis(projectId)
      
      expect(analysis).toBeDefined()
      expect(analysis?.projectId).toBe(projectId)
    })

    it('should sync analysis to Supabase when analysis is valid', () => {
      useCurvaSStore.getState().setPlannedFromRap(
        projectId,
        [{ period: '2024-01-31', planned: 1000000 }],
        1000000
      )

      vi.clearAllMocks()

      useCurvaSStore.getState().analyzeProject(projectId)

      // Analysis should be created and synced even with baseline-only data
      expect(supabaseSyncService.syncCurvaSAnalysis).toHaveBeenCalled()
    })
  })

  describe('savedScenarios', () => {
    it('should add a saved scenario', () => {
      const scenario: SavedScenario = {
        id: 'scenario-1',
        name: 'Conservative Plan',
        dpPercent: 0.15,
        billingPercent: 0.35,
        retentionRate: 0.05,
        bufferAmount: 50000,
      }

      useCurvaSStore.getState().addSavedScenario(projectId, scenario)

      const scenarios = useCurvaSStore.getState().getSavedScenarios(projectId)
      expect(scenarios).toHaveLength(1)
      expect(scenarios[0].name).toBe('Conservative Plan')
      expect(scenarios[0].dpPercent).toBe(0.15)
    })

    it('should validate scenario data', () => {
      const invalidScenario = {
        id: 'scenario-invalid',
        name: '', // Invalid: empty name
        dpPercent: 1.5, // Invalid: >1
        billingPercent: 0.3,
        retentionRate: 0.05,
      }

      useCurvaSStore.getState().addSavedScenario(projectId, invalidScenario as SavedScenario)

      expect(toast.notify.error).toHaveBeenCalled()
      
      const scenarios = useCurvaSStore.getState().getSavedScenarios(projectId)
      expect(scenarios).toHaveLength(0)
    })

    it('should remove a saved scenario', () => {
      const scenario1: SavedScenario = {
        id: 'scenario-1',
        name: 'Plan A',
        dpPercent: 0.1,
        billingPercent: 0.3,
        retentionRate: 0.05,
      }

      const scenario2: SavedScenario = {
        id: 'scenario-2',
        name: 'Plan B',
        dpPercent: 0.2,
        billingPercent: 0.4,
        retentionRate: 0.05,
      }

      useCurvaSStore.getState().addSavedScenario(projectId, scenario1)
      useCurvaSStore.getState().addSavedScenario(projectId, scenario2)

      let scenarios = useCurvaSStore.getState().getSavedScenarios(projectId)
      expect(scenarios).toHaveLength(2)

      // Remove scenario 1
      useCurvaSStore.getState().removeSavedScenario(projectId, 'scenario-1')

      scenarios = useCurvaSStore.getState().getSavedScenarios(projectId)
      expect(scenarios).toHaveLength(1)
      expect(scenarios[0].id).toBe('scenario-2')
    })

    it('should return empty array for project with no scenarios', () => {
      const scenarios = useCurvaSStore.getState().getSavedScenarios('non-existent-project')
      
      expect(Array.isArray(scenarios)).toBe(true)
      expect(scenarios).toHaveLength(0)
    })
  })

  describe('getDataPoints', () => {
    it('should return data points for a project', () => {
      useCurvaSStore.getState().setPlannedFromRap(
        projectId,
        [{ period: '2024-01-31', planned: 1000000 }],
        1000000
      )

      const dataPoints = useCurvaSStore.getState().getDataPoints(projectId)
      
      expect(Array.isArray(dataPoints)).toBe(true)
      expect(dataPoints.length).toBeGreaterThan(0)
    })

    it('should return empty array for project with no data', () => {
      const dataPoints = useCurvaSStore.getState().getDataPoints('non-existent-project')
      
      expect(Array.isArray(dataPoints)).toBe(true)
      expect(dataPoints).toHaveLength(0)
    })

    it('should return stable reference when data unchanged', () => {
      useCurvaSStore.getState().setPlannedFromRap(
        projectId,
        [{ period: '2024-01-31', planned: 1000000 }],
        1000000
      )

      const dataPoints1 = useCurvaSStore.getState().getDataPoints(projectId)
      const dataPoints2 = useCurvaSStore.getState().getDataPoints(projectId)
      
      // Should return same reference
      expect(dataPoints1).toBe(dataPoints2)
    })
  })

  describe('setPlannedFromRap', () => {
    it('should set planned values from RAP data', () => {
      const rapPlan = [
        { period: '2024-01', planned: 100000, actual: 95000 },
        { period: '2024-02', planned: 150000, actual: 140000 },
        { period: '2024-03', planned: 200000, actual: 0 },
      ]

      useCurvaSStore.getState().setPlannedFromRap(projectId, rapPlan, 1000000)

      const dataPoints = useCurvaSStore.getState().getDataPoints(projectId)
      
      expect(dataPoints.length).toBeGreaterThan(0)
      // Should have data points created from RAP periods
    })
  })
})
