import type { AHSPConfig } from './ahsp'
import type { CashFlowConfig } from './cashflow'
import type { CurvaSConfig } from './curvaS'
import type { ProgressTrackingConfig } from './progressTracking'
import type { ProjectManagementConfig } from './projectManagement'
import type { RABConfig } from './rab'
import type { RAPConfig } from './rap'
import type { ReportingConfig } from './reporting'
import type { ResourcePlanningConfig } from './resourcePlanning'
import type { TimelineConfig } from './timeline'
import type { WBSConfig } from './wbs'

export interface FeatureConfig {
  projectId: string
  projectManagement: ProjectManagementConfig
  wbs: WBSConfig
  ahsp: AHSPConfig
  rab: RABConfig
  timeline: TimelineConfig
  rap: RAPConfig
  curvas: CurvaSConfig
  resources: ResourcePlanningConfig
  cashflow: CashFlowConfig
  progress: ProgressTrackingConfig
  reporting: ReportingConfig
}

export type FeatureModuleKey = Exclude<keyof FeatureConfig, 'projectId'>
