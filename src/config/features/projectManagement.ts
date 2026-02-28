import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface ProjectManagementConfig {
  meta: ModuleMetadata
  workflow: {
    enableMultiStage: boolean
    stages: string[]
    autoArchiveAfterDays?: number
  }
  templates: {
    enableProjectTemplates: boolean
    defaultTemplateId?: string
    preserveWbsOnClone?: boolean
    preserveBudgetOnClone?: boolean
  }
  numbering: {
    prefix: string
    counterStart: number
    useYearInCode: boolean
  }
  kpis: {
    budgetVarianceTolerancePct: number
    scheduleVarianceToleranceDays: number
    criticalPathNotifyDays: number
  }
  access: AccessControl
  notifications: NotificationSettings
  audit: {
    enableAuditLog: boolean
    retentionDays: number
    exportOnClose?: boolean
  }
}
