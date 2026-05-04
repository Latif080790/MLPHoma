import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface CurvaSConfig {
  meta: ModuleMetadata
  metrics: {
    spiTolerance: number
    cpiTolerance: number
    performanceWindowDays: number
    baselineSmoothingEnabled: boolean
  }
  actuals: {
    allowManualActuals: boolean
    photoEvidenceRequiredForActuals: boolean
    actualsLockAfterDays: number
  }
  analytics: {
    runDailyAnalysis: boolean
    anomalyDetectionEnabled: boolean
    anomalyThresholdPct: number
  }
  access: AccessControl
  notifications: NotificationSettings
  reporting: {
    defaultChartRangeMonths: number
    showDeviationBands: boolean
  }
}
