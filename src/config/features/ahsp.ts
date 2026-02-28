import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface AHSPConfig {
  meta: ModuleMetadata
  pricing: {
    includeEquipmentCost: boolean
    rounding: {
      enabled: boolean
      toNearest: number
    }
    escalationRateAnnualPct: number
    currency: string
  }
  componentRules: {
    allowedTypes: string[]
    maxComponentsPerItem: number
    requireResourceLinking: boolean
  }
  importExport: {
    allowedFormats: string[]
    validateOnImport: boolean
    importMaxRows: number
  }
  access: AccessControl
  notifications: NotificationSettings
}
