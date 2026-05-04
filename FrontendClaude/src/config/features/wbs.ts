import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface WBSConfig {
  meta: ModuleMetadata
  codeRules: {
    useDotNotation: boolean
    maxLevels: number
    autoNumbering: boolean
    segmentPadLength: number
  }
  tree: {
    allowDragDrop: boolean
    maxChildrenPerNode?: number
    collapseDepthDefault: number
    showEstimatedHours: boolean
  }
  validation: {
    requireDescription: boolean
    maxNameLength: number
    uniqueCodeAcrossProject: boolean
  }
  access: AccessControl
  notifications: NotificationSettings
}
