import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface RAPConfig {
  meta: ModuleMetadata
  distribution: {
    defaultPeriod: 'daily' | 'weekly' | 'monthly'
    roundingMethod: 'round' | 'ceil' | 'floor'
    allowManualAdjustPerPeriod: boolean
    minPeriodAllocationPct: number
  }
  generation: {
    autoGenerateFromRab: boolean
    useTimelineWeights: boolean
    smoothingWindowPeriods: number
  }
  access: AccessControl
  notifications: NotificationSettings
}
