import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface CashFlowConfig {
  meta: ModuleMetadata
  projection: {
    cashflowPeriod: 'monthly' | 'weekly' | 'daily'
    includeRetentionPct: number
    earlyPaymentDiscountPct?: number
    paymentTermsDays: number
  }
  whatIf: {
    enableWhatIf: boolean
    maxScenariosStored: number
    scenarioComparisonColumns: string[]
  }
  alerts: {
    deficitAlertPct: number
    liquidityReservePct: number
  }
  access: AccessControl
  notifications: NotificationSettings
  export: {
    defaultExportFormat: 'csv' | 'xlsx' | 'pdf'
    includeChartsInExport: boolean
  }
}
