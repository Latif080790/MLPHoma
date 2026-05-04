import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface RABConfig {
  meta: ModuleMetadata
  calculation: {
    includeOverheadPct: number
    includeProfitPct: number
    includeTaxPct: number
    allowManualOverride: boolean
    autoRecalcOnAhspChange: boolean
  }
  itemRules: {
    minVolume: number
    maxDecimalPrecision: number
    requireAhspReference: boolean
    enableBulkEdit: boolean
  }
  costControl: {
    contingencyPct: number
    approvalThresholdAmount: number
    budgetLockOnApproval: boolean
  }
  access: AccessControl
  notifications: NotificationSettings
  auditing: {
    captureUnitPriceHistory: boolean
    priceChangeNotifyPct: number
  }
}
