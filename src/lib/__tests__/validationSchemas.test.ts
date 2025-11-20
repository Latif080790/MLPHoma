/**
 * validationSchemas.test.ts
 * 
 * Comprehensive tests for all Zod validation schemas
 * Tests edge cases, invalid inputs, and schema refinements
 */

import { describe, it, expect } from 'vitest'
import {
  // Resource schemas
  resourceInputSchema,
  resourceUpdateSchema,
  // AHSP schemas
  ahspItemInputSchema,
  ahspItemUpdateSchema,
  ahspComponentInputSchema,
  // RAB schemas
  rabItemInputSchema,
  rabItemUpdateSchema,
  // Project schemas
  projectInputSchema,
  projectUpdateSchema,
  // WBS schemas
  wbsItemInputSchema,
  wbsItemUpdateSchema,
  // Timeline schemas
  timelineTaskInputSchema,
  timelineTaskUpdateSchema,
  // RAP schemas
  rapItemInputSchema,
  rapConfigSchema,
  // Feature schemas
  featureSnapshotInputSchema,
  moduleConfigUpdateSchema,
  // Curva-S schemas
  curvaSDataPointInputSchema,
  curvaSBaselineConfigSchema,
  curvaSScenarioSchema,
  // Enums
  unitEnum,
  resourceTypeEnum,
  projectStatusEnum,
} from '@/lib/validationSchemas'

describe('validationSchemas', () => {
  describe('Resource Schemas', () => {
    describe('resourceInputSchema', () => {
      it('should validate valid resource input', () => {
        const validResource = {
          code: 'RES-001',
          name: 'Cement',
          type: 'material' as const,
          unit: 'kg' as const,
          unitPrice: 50000,
        }

        const result = resourceInputSchema.safeParse(validResource)
        expect(result.success).toBe(true)
      })

      it('should reject negative unit price', () => {
        const invalidResource = {
          code: 'RES-001',
          name: 'Cement',
          type: 'material' as const,
          unit: 'kg' as const,
          unitPrice: -1000,
        }

        const result = resourceInputSchema.safeParse(invalidResource)
        expect(result.success).toBe(false)
      })

      it('should reject invalid resource type', () => {
        const invalidResource = {
          code: 'RES-001',
          name: 'Cement',
          type: 'invalid_type',
          unit: 'kg' as const,
          unitPrice: 50000,
        }

        const result = resourceInputSchema.safeParse(invalidResource)
        expect(result.success).toBe(false)
      })

      it('should reject missing required fields', () => {
        const invalidResource = {
          code: 'RES-001',
          // Missing name, type, unit, unitPrice
        }

        const result = resourceInputSchema.safeParse(invalidResource)
        expect(result.success).toBe(false)
      })
    })

    describe('resourceUpdateSchema', () => {
      it('should allow partial updates', () => {
        const partialUpdate = {
          unitPrice: 55000,
        }

        const result = resourceUpdateSchema.safeParse(partialUpdate)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('AHSP Schemas', () => {
    describe('ahspItemInputSchema', () => {
      it('should validate valid AHSP item', () => {
        const validItem = {
          code: 'AHSP-001',
          name: 'Pekerjaan Beton',
          description: 'Beton K-300',
          unit: 'm3' as const,
          overheadPercent: 10,
          profitPercent: 15,
        }

        const result = ahspItemInputSchema.safeParse(validItem)
        expect(result.success).toBe(true)
      })

      it('should reject invalid percentage (> 100)', () => {
        const invalidItem = {
          code: 'AHSP-001',
          name: 'Pekerjaan Beton',
          unit: 'm3' as const,
          overheadPercent: 150, // Invalid
          profitPercent: 15,
        }

        const result = ahspItemInputSchema.safeParse(invalidItem)
        expect(result.success).toBe(false)
      })

      it('should reject invalid percentage (< 0)', () => {
        const invalidItem = {
          code: 'AHSP-001',
          name: 'Pekerjaan Beton',
          unit: 'm3' as const,
          overheadPercent: -5, // Invalid
          profitPercent: 15,
        }

        const result = ahspItemInputSchema.safeParse(invalidItem)
        expect(result.success).toBe(false)
      })
    })

    describe('ahspComponentInputSchema', () => {
      it('should validate valid component', () => {
        const validComponent = {
          ahspId: 'ahsp-123',
          resourceId: 'res-456',
          coefficient: 1.5,
        }

        const result = ahspComponentInputSchema.safeParse(validComponent)
        expect(result.success).toBe(true)
      })

      it('should reject zero coefficient', () => {
        const invalidComponent = {
          ahspId: 'ahsp-123',
          resourceId: 'res-456',
          coefficient: 0,
        }

        const result = ahspComponentInputSchema.safeParse(invalidComponent)
        expect(result.success).toBe(false)
      })

      it('should reject negative coefficient', () => {
        const invalidComponent = {
          ahspId: 'ahsp-123',
          resourceId: 'res-456',
          coefficient: -1,
        }

        const result = ahspComponentInputSchema.safeParse(invalidComponent)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('RAB Schemas', () => {
    describe('rabItemInputSchema', () => {
      it('should validate valid RAB item', () => {
        const validItem = {
          projectId: 'proj-1',
          code: 'RAB-001',
          name: 'Item Pekerjaan',
          unit: 'm3' as const,
          volume: 100,
          unitPrice: 500000,
        }

        const result = rabItemInputSchema.safeParse(validItem)
        expect(result.success).toBe(true)
      })

      it('should reject negative volume', () => {
        const invalidItem = {
          projectId: 'proj-1',
          code: 'RAB-001',
          name: 'Item Pekerjaan',
          unit: 'm3' as const,
          volume: -10,
          unitPrice: 500000,
        }

        const result = rabItemInputSchema.safeParse(invalidItem)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Project Schemas', () => {
    describe('projectInputSchema', () => {
      it('should validate valid project', () => {
        const validProject = {
          name: 'Project ABC',
          location: 'Jakarta',
          status: 'Planning' as const,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        }

        const result = projectInputSchema.safeParse(validProject)
        expect(result.success).toBe(true)
      })

      it('should reject end date before start date', () => {
        const invalidProject = {
          name: 'Project ABC',
          location: 'Jakarta',
          status: 'Planning' as const,
          startDate: '2025-12-31',
          endDate: '2025-01-01', // Before start date
        }

        const result = projectInputSchema.safeParse(invalidProject)
        expect(result.success).toBe(false)
      })

      it('should accept same start and end date', () => {
        const validProject = {
          name: 'Project ABC',
          location: 'Jakarta',
          status: 'Planning' as const,
          startDate: '2025-06-15',
          endDate: '2025-06-15',
        }

        const result = projectInputSchema.safeParse(validProject)
        expect(result.success).toBe(true)
      })
    })
  })

  describe('WBS Schemas', () => {
    describe('wbsItemInputSchema', () => {
      it('should validate valid WBS item', () => {
        const validItem = {
          projectId: 'proj-1',
          code: '1.0',
          name: 'Phase 1',
          level: 1,
          sortOrder: 0,
        }

        const result = wbsItemInputSchema.safeParse(validItem)
        expect(result.success).toBe(true)
      })

      it('should reject invalid level (zero)', () => {
        const invalidItem = {
          projectId: 'proj-1',
          code: '1.0',
          name: 'Phase 1',
          level: 0,
          sortOrder: 0,
        }

        const result = wbsItemInputSchema.safeParse(invalidItem)
        expect(result.success).toBe(false)
      })

      it('should reject negative sort order', () => {
        const invalidItem = {
          projectId: 'proj-1',
          code: '1.0',
          name: 'Phase 1',
          level: 1,
          sortOrder: -1,
        }

        const result = wbsItemInputSchema.safeParse(invalidItem)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Timeline Schemas', () => {
    describe('timelineTaskInputSchema', () => {
      it('should validate valid task', () => {
        const validTask = {
          projectId: 'proj-1',
          name: 'Task 1',
          duration: 10,
          startDate: '2025-01-01',
          endDate: '2025-01-10',
          progress: 0,
          status: 'not_started' as const,
        }

        const result = timelineTaskInputSchema.safeParse(validTask)
        expect(result.success).toBe(true)
      })

      it('should reject end date before start date', () => {
        const invalidTask = {
          projectId: 'proj-1',
          name: 'Task 1',
          duration: 10,
          startDate: '2025-01-10',
          endDate: '2025-01-01',
          progress: 0,
          status: 'not_started' as const,
        }

        const result = timelineTaskInputSchema.safeParse(invalidTask)
        expect(result.success).toBe(false)
      })

      it('should reject invalid progress (> 100)', () => {
        const invalidTask = {
          projectId: 'proj-1',
          name: 'Task 1',
          duration: 10,
          startDate: '2025-01-01',
          endDate: '2025-01-10',
          progress: 150,
          status: 'not_started' as const,
        }

        const result = timelineTaskInputSchema.safeParse(invalidTask)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('RAP Schemas', () => {
    describe('rapConfigSchema', () => {
      it('should validate valid RAP config', () => {
        const validConfig = {
          projectId: 'proj-1',
          distributionMethod: 'even' as const,
          periodType: 'monthly' as const,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        }

        const result = rapConfigSchema.safeParse(validConfig)
        expect(result.success).toBe(true)
      })

      it('should reject end date before start date', () => {
        const invalidConfig = {
          projectId: 'proj-1',
          distributionMethod: 'even' as const,
          periodType: 'monthly' as const,
          startDate: '2025-12-31',
          endDate: '2025-01-01',
        }

        const result = rapConfigSchema.safeParse(invalidConfig)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Feature Config Schemas', () => {
    describe('featureSnapshotInputSchema', () => {
      it('should validate valid snapshot', () => {
        const validSnapshot = {
          projectId: 'proj-1',
          name: 'Snapshot 1',
          config: { projectId: 'proj-1' },
        }

        const result = featureSnapshotInputSchema.safeParse(validSnapshot)
        expect(result.success).toBe(true)
      })

      it('should reject empty name', () => {
        const invalidSnapshot = {
          projectId: 'proj-1',
          name: '',
          config: { projectId: 'proj-1' },
        }

        const result = featureSnapshotInputSchema.safeParse(invalidSnapshot)
        expect(result.success).toBe(false)
      })

      it('should reject name longer than 100 characters', () => {
        const invalidSnapshot = {
          projectId: 'proj-1',
          name: 'A'.repeat(101),
          config: { projectId: 'proj-1' },
        }

        const result = featureSnapshotInputSchema.safeParse(invalidSnapshot)
        expect(result.success).toBe(false)
      })
    })

    describe('moduleConfigUpdateSchema', () => {
      it('should validate valid module update', () => {
        const validUpdate = {
          moduleKey: 'wbs',
          patch: { enabled: true },
        }

        const result = moduleConfigUpdateSchema.safeParse(validUpdate)
        expect(result.success).toBe(true)
      })

      it('should reject empty patch', () => {
        const invalidUpdate = {
          moduleKey: 'wbs',
          patch: {},
        }

        const result = moduleConfigUpdateSchema.safeParse(invalidUpdate)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Curva-S Schemas', () => {
    describe('curvaSDataPointInputSchema', () => {
      it('should validate valid data point', () => {
        const validPoint = {
          projectId: 'proj-1',
          date: '2025-01-01',
          plannedProgress: 25.5,
          actualProgress: 20.0,
          plannedCost: 100000000,
          actualCost: 95000000,
        }

        const result = curvaSDataPointInputSchema.safeParse(validPoint)
        expect(result.success).toBe(true)
      })

      it('should reject progress > 100', () => {
        const invalidPoint = {
          projectId: 'proj-1',
          date: '2025-01-01',
          plannedProgress: 150,
        }

        const result = curvaSDataPointInputSchema.safeParse(invalidPoint)
        expect(result.success).toBe(false)
      })

      it('should reject negative cost', () => {
        const invalidPoint = {
          projectId: 'proj-1',
          date: '2025-01-01',
          plannedCost: -1000,
        }

        const result = curvaSDataPointInputSchema.safeParse(invalidPoint)
        expect(result.success).toBe(false)
      })

      it('should require at least one metric', () => {
        const invalidPoint = {
          projectId: 'proj-1',
          date: '2025-01-01',
          // No metrics provided
        }

        const result = curvaSDataPointInputSchema.safeParse(invalidPoint)
        expect(result.success).toBe(false)
      })
    })

    describe('curvaSBaselineConfigSchema', () => {
      it('should validate valid baseline config', () => {
        const validConfig = {
          projectId: 'proj-1',
          totalBudget: 1000000000,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        }

        const result = curvaSBaselineConfigSchema.safeParse(validConfig)
        expect(result.success).toBe(true)
      })

      it('should reject negative budget', () => {
        const invalidConfig = {
          projectId: 'proj-1',
          totalBudget: -100,
          startDate: '2025-01-01',
          endDate: '2025-12-31',
        }

        const result = curvaSBaselineConfigSchema.safeParse(invalidConfig)
        expect(result.success).toBe(false)
      })

      it('should reject end date before start date', () => {
        const invalidConfig = {
          projectId: 'proj-1',
          totalBudget: 1000000000,
          startDate: '2025-12-31',
          endDate: '2025-01-01',
        }

        const result = curvaSBaselineConfigSchema.safeParse(invalidConfig)
        expect(result.success).toBe(false)
      })
    })

    describe('curvaSScenarioSchema', () => {
      it('should validate valid scenario', () => {
        const validScenario = {
          id: 'scenario-1',
          name: 'Optimistic',
          dpPercent: 0.3,
          billingPercent: 0.9,
          retentionRate: 0.05,
          bufferAmount: 50000000,
        }

        const result = curvaSScenarioSchema.safeParse(validScenario)
        expect(result.success).toBe(true)
      })

      it('should reject percentage > 1', () => {
        const invalidScenario = {
          id: 'scenario-1',
          name: 'Invalid',
          dpPercent: 1.5,
        }

        const result = curvaSScenarioSchema.safeParse(invalidScenario)
        expect(result.success).toBe(false)
      })

      it('should reject negative buffer amount', () => {
        const invalidScenario = {
          id: 'scenario-1',
          name: 'Invalid',
          bufferAmount: -1000,
        }

        const result = curvaSScenarioSchema.safeParse(invalidScenario)
        expect(result.success).toBe(false)
      })
    })
  })

  describe('Enum Validations', () => {
    it('should validate unit enum', () => {
      const validUnits = ['m3', 'm2', 'm', 'kg', 'ltr', 'bh', 'oh', 'jam', 'hr', 'hari', 'unit']
      
      validUnits.forEach(unit => {
        const result = unitEnum.safeParse(unit)
        expect(result.success).toBe(true)
      })
    })

    it('should reject invalid unit', () => {
      const result = unitEnum.safeParse('invalid_unit')
      expect(result.success).toBe(false)
    })

    it('should validate resource type enum', () => {
      const validTypes = ['material', 'labor', 'equipment', 'subcontractor']
      
      validTypes.forEach(type => {
        const result = resourceTypeEnum.safeParse(type)
        expect(result.success).toBe(true)
      })
    })

    it('should validate project status enum', () => {
      const validStatuses = ['Planning', 'Active', 'Completed', 'On Hold', 'Cancelled']
      
      validStatuses.forEach(status => {
        const result = projectStatusEnum.safeParse(status)
        expect(result.success).toBe(true)
      })
    })
  })
})
