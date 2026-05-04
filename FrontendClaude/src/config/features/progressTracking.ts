import type { AccessControl, ModuleMetadata, NotificationSettings } from './shared'

export interface ProgressTrackingConfig {
  meta: ModuleMetadata
  capture: {
    allowPhotoUpload: boolean
    maxPhotosPerTask: number
    requireCommentOnUpdate: boolean
  }
  autoUpdate: {
    enableAutoUpdateFromCurva: boolean
    syncIntervalMinutes: number
  }
  quality: {
    defectThresholdPerTask: number
    requireQCApproval: boolean
  }
  access: AccessControl
  notifications: NotificationSettings
}
