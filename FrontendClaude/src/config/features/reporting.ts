import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface ReportingConfig {
  meta: ModuleMetadata
  dashboard: {
    widgets: string[]
    refreshIntervalSeconds: number
    defaultDateRangeDays: number
  }
  exports: {
    enableExcelExport: boolean
    enablePdfExport: boolean
    defaultPaperSize: 'A4' | 'Letter'
  }
  retention: {
    keepReportHistoryDays: number
    archivedReportsOn?: 'close' | 'monthly' | 'manual'
  }
  access: AccessControl
  notifications: NotificationSettings
}
