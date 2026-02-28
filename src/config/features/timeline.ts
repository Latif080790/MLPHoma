import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface TimelineConfig {
  meta: ModuleMetadata
  scheduling: {
    workCalendar: '7day' | '5day' | 'custom'
    defaultWorkHoursPerDay: number
    autoCalculateCriticalPath: boolean
    allowNegativeLag: boolean
    floatPrecisionDays: number
  }
  dependencyRules: {
    allowedTypes: string[]
    maxPredecessors: number
    defaultLagDays: number
  }
  baseline: {
    keepMultipleBaselines: boolean
    baselineLimit: number
  }
  access: AccessControl
  notifications: NotificationSettings
}
