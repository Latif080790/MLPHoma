export interface ModuleMetadata {
  projectId: string
  name?: string
  schemaVersion?: string
  updatedAt?: string
  updatedBy?: string
}

export interface AccessControl {
  readRoles: string[]
  writeRoles: string[]
  restrictedToOwner?: boolean
  requireApproval?: boolean
  approverRoles?: string[]
}

export interface NotificationSettings {
  enabled: boolean
  channels: string[]
  thresholds: Record<string, number>
  dailyDigest?: boolean
  escalationMinutes?: number
}
