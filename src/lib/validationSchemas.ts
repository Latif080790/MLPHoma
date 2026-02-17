/**
 * validationSchemas.ts
 * Central zod schemas for all entities with runtime validation.
 * 
 * Phase 2 Enhancement: Comprehensive validation for all store operations.
 */
import { z } from 'zod'

// ==========================================
// COMMON ENUMS & HELPERS
// ==========================================

/** Common units for AHSP and resources */
export const unitEnum = z.enum([
  'm3', 'm2', 'm', "m'", 'kg', 'ltr', 'bh', 'oh', 'jam', 'hr', 'hari', 'unit'
])

/** Resource types */
export const resourceTypeEnum = z.enum([
  'material', 'labor', 'equipment', 'subcontractor'
])

/** Project status */
export const projectStatusEnum = z.enum([
  'Planning', 'Active', 'Completed', 'On Hold', 'Cancelled'
])

/** Common validation helpers */
export const commonValidations = {
  code: z.string()
    .min(1, 'Code is required')
    .regex(/^[A-Za-z0-9\.\-]+$/, 'Code must contain only letters, numbers, dots, and dashes'),

  name: z.string()
    .min(1, 'Name is required')
    .max(200, 'Name must be less than 200 characters'),

  description: z.string().optional().or(z.literal('')),

  percentage: z.number()
    .min(0, 'Minimum 0%')
    .max(100, 'Maximum 100%'),

  positiveNumber: z.number()
    .min(0, 'Cannot be negative'),

  price: z.number()
    .min(0, 'Price cannot be negative')
    .max(999999999999, 'Price too large'),

  coefficient: z.number()
    .min(0, 'Coefficient cannot be negative')
    .max(99999, 'Coefficient too large'),

  volume: z.number()
    .min(0, 'Volume cannot be negative')
    .max(999999999, 'Volume too large'),

  isoDate: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in ISO format YYYY-MM-DD'),
}

// ==========================================
// RESOURCE SCHEMAS
// ==========================================

/** Resource input schema (for addResource) */
export const resourceInputSchema = z.object({
  code: commonValidations.code,
  name: commonValidations.name,
  type: resourceTypeEnum,
  unit: unitEnum,
  unitPrice: commonValidations.price,
  supplier: z.string().optional().or(z.literal('')),
  specifications: z.string().optional().or(z.literal('')),
  isActive: z.boolean().default(true),
})

/** Resource update schema (all fields optional) */
export const resourceUpdateSchema = resourceInputSchema.partial()

export type ResourceInput = z.infer<typeof resourceInputSchema>
export type ResourceUpdate = z.infer<typeof resourceUpdateSchema>

// ==========================================
// AHSP ITEM SCHEMAS
// ==========================================

/** AHSP Item input schema (for addAHSPItem) */
export const ahspItemInputSchema = z.object({
  code: commonValidations.code,
  name: commonValidations.name,
  description: commonValidations.description,
  unit: unitEnum,
  category: z.string().min(1, 'Category is required'),
  overheadPercentage: commonValidations.percentage.optional().default(0),
  profitPercentage: commonValidations.percentage.optional().default(0),
  isActive: z.boolean().default(true),
  basePrice: commonValidations.price.optional().default(0),
  finalPrice: commonValidations.price.optional().default(0),
  price_material: commonValidations.price.optional().default(0),
  price_labor: commonValidations.price.optional().default(0),
  price_equipment: commonValidations.price.optional().default(0),
  price_subcon: commonValidations.price.optional().default(0),
})

/** AHSP Item update schema */
export const ahspItemUpdateSchema = ahspItemInputSchema.partial()

export type AHSPItemInput = z.infer<typeof ahspItemInputSchema>
export type AHSPItemUpdate = z.infer<typeof ahspItemUpdateSchema>

// ==========================================
// AHSP COMPONENT SCHEMAS
// ==========================================

/** AHSP Component input schema */
export const ahspComponentInputSchema = z.object({
  type: resourceTypeEnum,
  resourceId: z.string().min(1, 'Resource ID is required'),
  coefficient: commonValidations.coefficient,
  notes: z.string().optional().or(z.literal('')),
})

/** AHSP Component update schema */
export const ahspComponentUpdateSchema = ahspComponentInputSchema.partial()

export type AHSPComponentInput = z.infer<typeof ahspComponentInputSchema>
export type AHSPComponentUpdate = z.infer<typeof ahspComponentUpdateSchema>

// ==========================================
// RAB ITEM SCHEMAS
// ==========================================

/** RAB Item input schema */
export const rabItemInputSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  item_code: z.string().optional().or(z.literal('')),
  item_name: commonValidations.name.optional(),
  name: commonValidations.name.optional(),
  unit: unitEnum.optional(),
  volume: commonValidations.volume.optional().default(0),
  unit_price: commonValidations.price.optional().default(0),
  cost_material: commonValidations.price.optional().default(0),
  cost_labor: commonValidations.price.optional().default(0),
  cost_equipment: commonValidations.price.optional().default(0),
  cost_subcon: commonValidations.price.optional().default(0),
  markup_percentage: commonValidations.percentage.optional().default(0),
  weight_percentage: commonValidations.percentage.optional().default(0),
  taskId: z.string().optional(),
})

/** RAB Item update schema */
export const rabItemUpdateSchema = rabItemInputSchema.partial()

export type RABItemInput = z.infer<typeof rabItemInputSchema>
export type RABItemUpdate = z.infer<typeof rabItemUpdateSchema>

// ==========================================
// PROJECT SCHEMAS
// ==========================================

/** Project input schema */
export const projectInputSchema = z.object({
  code: commonValidations.code.optional(),
  name: commonValidations.name,
  clientName: z.string().optional().or(z.literal('')),
  location: z.string().optional().or(z.literal('')),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  budget: commonValidations.price.optional(),
  status: projectStatusEnum.optional().default('Planning'),
  paymentTerms: z.object({
    downPaymentPercent: commonValidations.percentage.optional(),
    billingPercent: commonValidations.percentage.optional(),
    retentionRate: commonValidations.percentage.optional(),
    loanInterestRate: commonValidations.percentage.optional(),
    taxRate: commonValidations.percentage.optional(),
  }).optional(),
  meta: z.record(z.any()).optional(),
})

/** Project update schema */
export const projectUpdateSchema = projectInputSchema.partial()

export type ProjectInput = z.infer<typeof projectInputSchema>
export type ProjectUpdate = z.infer<typeof projectUpdateSchema>

// ==========================================
// WBS ITEM SCHEMAS
// ==========================================

/** WBS Item input schema */
export const wbsItemInputSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  code: commonValidations.code,
  name: commonValidations.name,
  description: commonValidations.description,
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().min(0).default(0),
  level: z.number().int().min(0).max(10).default(0),
  budget: commonValidations.price.optional(),
  progress: commonValidations.percentage.optional().default(0),
  qc_status: z.enum(['PENDING', 'PASSED', 'FAILED', 'NOT_REQUIRED']).optional().default('NOT_REQUIRED'),
})

/** WBS Item update schema */
export const wbsItemUpdateSchema = wbsItemInputSchema.partial()

export type WBSItemInput = z.infer<typeof wbsItemInputSchema>
export type WBSItemUpdate = z.infer<typeof wbsItemUpdateSchema>

// ==========================================
// TIMELINE/GANTT SCHEMAS
// ==========================================

/** Timeline task dependency type enum */
export const dependencyTypeEnum = z.enum(['FS', 'SS', 'FF', 'SF'])

/** Task status enum */
export const taskStatusEnum = z.enum(['not_started', 'in_progress', 'completed', 'delayed'])

/** Task priority enum */
export const taskPriorityEnum = z.enum(['low', 'medium', 'high'])

/** Task dependency schema */
export const taskDependencySchema = z.object({
  id: commonValidations.code,
  predecessorId: z.string().min(1, 'Predecessor ID required'),
  successorId: z.string().min(1, 'Successor ID required'),
  type: dependencyTypeEnum,
  lag: z.number().default(0), // Can be negative (lead) or positive (lag)
})

/** Timeline task base schema (without refinement) */
export const timelineTaskBaseSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  wbsId: z.string().optional(),
  rabId: z.string().optional(),
  name: z.string().min(1, 'Task name required').max(200),
  description: z.string().max(1000).optional(),
  duration: commonValidations.positiveNumber,
  startDate: commonValidations.isoDate,
  endDate: commonValidations.isoDate,
  progress: commonValidations.percentage.default(0),
  status: taskStatusEnum.default('not_started'),
  dependencies: z.array(taskDependencySchema).default([]),
  assignedResources: z.array(z.string()).optional(),
  priority: taskPriorityEnum.default('medium'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

/** Timeline task input schema (for creating new tasks) */
export const timelineTaskInputSchema = timelineTaskBaseSchema.refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be after or equal to start date', path: ['endDate'] }
)

/** Timeline task update schema (partial) - all fields optional */
export const timelineTaskUpdateSchema = z.object({
  projectId: z.string().min(1, 'Project ID required').optional(),
  wbsId: z.string().optional(),
  rabId: z.string().optional(),
  name: z.string().min(1, 'Task name required').max(200).optional(),
  description: z.string().max(1000).optional(),
  duration: commonValidations.positiveNumber.optional(),
  startDate: commonValidations.isoDate.optional(),
  endDate: commonValidations.isoDate.optional(),
  progress: commonValidations.percentage.optional(),
  status: taskStatusEnum.optional(),
  dependencies: z.array(taskDependencySchema).optional(),
  assignedResources: z.array(z.string()).optional(),
  priority: taskPriorityEnum.optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
})

/** Timeline milestone schema */
export const timelineMilestoneSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  name: z.string().min(1, 'Milestone name required').max(200),
  targetDate: commonValidations.isoDate,
  description: z.string().max(500).optional(),
  achieved: z.boolean().default(false),
  actualDate: commonValidations.isoDate.optional(),
  linkedTaskIds: z.array(z.string()).default([]),
})

export type TimelineTaskInput = z.infer<typeof timelineTaskInputSchema>
export type TimelineTaskUpdate = z.infer<typeof timelineTaskUpdateSchema>
export type TimelineMilestone = z.infer<typeof timelineMilestoneSchema>

// ==========================================
// RAP SCHEMAS
// ==========================================

/** Period type enum */
export const periodTypeEnum = z.enum(['monthly', 'weekly', 'quarterly'])

/** RAP status enum */
export const rapStatusEnum = z.enum(['not_started', 'in_progress', 'completed', 'overdue'])

/** Distribution method enum */
export const distributionMethodEnum = z.enum(['even', 'front_loaded', 'back_loaded', 'task_based'])

/** RAP item input schema */
export const rapItemInputSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  rabId: z.string().min(1, 'RAB ID required'),
  taskId: z.string().min(1, 'Task ID required'),
  periodKey: z.string().min(1, 'Period key required'), // e.g., "2024-01", "2024-W01"
  periodType: periodTypeEnum,
  plannedVolume: commonValidations.positiveNumber,
  plannedCost: commonValidations.positiveNumber,
  actualVolume: commonValidations.positiveNumber.optional(),
  actualCost: commonValidations.positiveNumber.optional(),
  status: rapStatusEnum.default('not_started'),
  notes: z.string().max(500).optional(),
})

/** RAP item update schema (partial) */
export const rapItemUpdateSchema = rapItemInputSchema.partial()

/** RAP configuration schema */
export const rapConfigSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  distributionMethod: distributionMethodEnum,
  periodType: periodTypeEnum,
  startDate: commonValidations.isoDate,
  endDate: commonValidations.isoDate,
  includeOverhead: z.boolean().default(true),
  includeProfit: z.boolean().default(true),
  includeTax: z.boolean().default(true),
  customWeights: z.record(z.number().min(0).max(1)).optional(),
}).refine(
  (data) => new Date(data.endDate) >= new Date(data.startDate),
  { message: 'End date must be after or equal to start date', path: ['endDate'] }
)

export type RAPItemInput = z.infer<typeof rapItemInputSchema>
export type RAPItemUpdate = z.infer<typeof rapItemUpdateSchema>
export type RAPConfig = z.infer<typeof rapConfigSchema>

// ==========================================
// BACKWARD COMPATIBILITY
// ==========================================

/** @deprecated Use ahspItemInputSchema instead */
export const ahspItemSchema = ahspItemInputSchema

/** @deprecated Use rabItemInputSchema instead */
export const rabItemSchema = rabItemInputSchema

/** @deprecated Use validate() from validationMiddleware instead */
export function validateAHSPItem(data: unknown) {
  return ahspItemInputSchema.safeParse(data)
}

/** @deprecated Use validate() from validationMiddleware instead */
export function validateRABItem(data: unknown) {
  return rabItemInputSchema.safeParse(data)
}

// ==========================================
// 8. FEATURE CONFIG SCHEMAS (Phase 4)
// ==========================================

/**
 * Access Control schemas
 */
export const accessControlSchema = z.object({
  readRoles: z.array(z.string()).min(1, 'At least one read role required'),
  writeRoles: z.array(z.string()).min(1, 'At least one write role required'),
  restrictedToOwner: z.boolean().optional(),
  requireApproval: z.boolean().optional(),
  approverRoles: z.array(z.string()).optional(),
})

/**
 * Notification Settings schemas
 */
export const notificationSettingsSchema = z.object({
  enabled: z.boolean(),
  channels: z.array(z.string()),
  thresholds: z.record(z.number()),
  dailyDigest: z.boolean().optional(),
  escalationMinutes: z.number().min(0).optional(),
})

/**
 * Module Metadata schemas
 */
export const moduleMetadataSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  name: z.string().optional(),
  schemaVersion: z.string().optional(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().optional(),
})

/**
 * Feature Snapshot schemas
 */
export const featureSnapshotInputSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  name: z.string().min(1, 'Snapshot name required').max(100),
  config: z.any(), // Full FeatureConfig object
})

export const featureSnapshotUpdateSchema = featureSnapshotInputSchema.partial()

/**
 * Simplified module config update schema
 * For updateModuleConfig operations
 */
export const moduleConfigUpdateSchema = z.object({
  moduleKey: z.string().min(1, 'Module key required'),
  patch: z.record(z.any()).refine((data) => Object.keys(data).length > 0, {
    message: 'Patch must contain at least one field',
  }),
})

// ==========================================
// 9. CURVA-S SCHEMAS (Phase 4)
// ==========================================

/**
 * Curva-S status enum
 */
export const curvaSStatusEnum = z.enum([
  'on-track',
  'behind-schedule',
  'ahead-schedule',
  'over-budget',
  'under-budget',
  'at-risk',
])

/**
 * Curva-S data point schema (baseline)
 */
const curvaSDataPointBaseSchema = z.object({
  projectId: z.string().min(1, 'Project ID required'),
  date: commonValidations.isoDate,
  plannedProgress: z.number().min(0).max(100).optional(),
  actualProgress: z.number().min(0).max(100).optional(),
  plannedCost: z.number().min(0).optional(),
  actualCost: z.number().min(0).optional(),
})

/**
 * Curva-S data point input schema (with date validation)
 */
export const curvaSDataPointInputSchema = curvaSDataPointBaseSchema.refine(
  (data) => {
    // At least one planned or actual value must be provided
    return (
      data.plannedProgress !== undefined ||
      data.actualProgress !== undefined ||
      data.plannedCost !== undefined ||
      data.actualCost !== undefined
    )
  },
  {
    message: 'At least one metric (progress or cost) must be provided',
  }
)

/**
 * Curva-S data point update schema
 */
export const curvaSDataPointUpdateSchema = curvaSDataPointBaseSchema.partial()

/**
 * Curva-S baseline generation config
 */
export const curvaSBaselineConfigSchema = z
  .object({
    projectId: z.string().min(1, 'Project ID required'),
    totalBudget: z.number().min(0, 'Total budget must be non-negative'),
    startDate: commonValidations.isoDate,
    endDate: commonValidations.isoDate,
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: 'End date must be after or equal to start date',
  })

/**
 * Curva-S saved scenario schema
 */
export const curvaSScenarioSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Scenario name required').max(100),
  dpPercent: z.number().min(0).max(1).optional(),
  billingPercent: z.number().min(0).max(1).optional(),
  retentionRate: z.number().min(0).max(1).optional(),
  bufferAmount: z.number().min(0).optional(),
})

// ==========================================
// EXPORTS
// ==========================================

export default {
  // Resource schemas
  resourceInputSchema,
  resourceUpdateSchema,

  // AHSP schemas
  ahspItemInputSchema,
  ahspItemUpdateSchema,
  ahspComponentInputSchema,
  ahspComponentUpdateSchema,

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
  timelineMilestoneSchema,
  dependencyTypeEnum,
  taskStatusEnum,
  taskPriorityEnum,
  taskDependencySchema,

  // RAP schemas
  rapItemInputSchema,
  rapItemUpdateSchema,
  rapConfigSchema,
  periodTypeEnum,
  rapStatusEnum,
  distributionMethodEnum,

  // Feature Config schemas (Phase 4)
  accessControlSchema,
  notificationSettingsSchema,
  moduleMetadataSchema,
  featureSnapshotInputSchema,
  featureSnapshotUpdateSchema,
  moduleConfigUpdateSchema,

  // Curva-S schemas (Phase 4)
  curvaSDataPointInputSchema,
  curvaSDataPointUpdateSchema,
  curvaSBaselineConfigSchema,
  curvaSScenarioSchema,
  curvaSStatusEnum,

  // Common
  commonValidations,
  unitEnum,
  resourceTypeEnum,
  projectStatusEnum,
}
