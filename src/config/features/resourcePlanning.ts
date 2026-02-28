import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface ResourcePlanningConfig {
  meta: ModuleMetadata
  histogram: {
    bucketSizeDays: number
    normalizeByWorkingDays: boolean
    showSkillLevels: boolean
  }
  procurement: {
    leadTimeDaysDefault: number
    reorderPointPct: number
    vendorPreferredList: string[]
  }
  shortages: {
    alertWhenShortagePct: number
    autoSuggestSubstitutes: boolean
  }
  access: AccessControl
  notifications: NotificationSettings
}
