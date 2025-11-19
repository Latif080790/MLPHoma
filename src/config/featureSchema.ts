/**
 * featureSchema.ts
 *
 * Skema konfigurasi terperinci untuk semua modul utama aplikasi.
 * Setiap interface mendeskripsikan variabel/opsi yang memungkinkan kontrol enterprise-grade.
 *
 * Tujuan:
 * - Menyediakan tipe TypeScript sebagai single source of truth untuk konfigurasi modul.
 * - Memudahkan pembuatan default, validasi, UI editor, dan persistensi ke backend.
 */

/**
 * General metadata used across module configs.
 */
export interface ModuleMetadata {
  /** Unique identifier of the project this config belongs to */
  projectId: string
  /** Human friendly name for this configuration */
  name?: string
  /** Version of the config schema to help migrations */
  schemaVersion?: string
  /** Last updated ISO timestamp */
  updatedAt?: string
  /** User id who last updated the configuration */
  updatedBy?: string
}

/**
 * Access control settings shared by modules.
 */
export interface AccessControl {
  /** Roles allowed to read this module (e.g. admin, manager, estimator) */
  readRoles: string[]
  /** Roles allowed to edit this module */
  writeRoles: string[]
  /** Boolean flag if module is restricted to project owner and admins */
  restrictedToOwner?: boolean
  /** Whether changes require approval workflow */
  requireApproval?: boolean
  /** Approval roles */
  approverRoles?: string[]
}

/**
 * Notification & alerting configuration.
 */
export interface NotificationSettings {
  /** Enable notifications for this module */
  enabled: boolean
  /** Channels: email | slack | inapp | webhook */
  channels: string[]
  /** Threshold rules that trigger alerts (keyed by metric) */
  thresholds: Record<string, number>
  /** Daily digest enabled */
  dailyDigest?: boolean
  /** Escalation policy (minutes before escalate) */
  escalationMinutes?: number
}

/**
 * Project Management configuration.
 */
export interface ProjectManagementConfig {
  /** Metadata */
  meta: ModuleMetadata
  /** Workflow settings for project lifecycle */
  workflow: {
    enableMultiStage: boolean
    stages: string[]
    autoArchiveAfterDays?: number
  }
  /** Cloning and templates */
  templates: {
    enableProjectTemplates: boolean
    defaultTemplateId?: string
    preserveWbsOnClone?: boolean
    preserveBudgetOnClone?: boolean
  }
  /** Project numbering and codes */
  numbering: {
    prefix: string
    counterStart: number
    useYearInCode: boolean
  }
  /** KPIs shown on project dashboard */
  kpis: {
    budgetVarianceTolerancePct: number
    scheduleVarianceToleranceDays: number
    criticalPathNotifyDays: number
  }
  access: AccessControl
  notifications: NotificationSettings
  /** Audit & retention policy */
  audit: {
    enableAuditLog: boolean
    retentionDays: number
    exportOnClose?: boolean
  }
}

/**
 * WBS (Work Breakdown Structure) configuration.
 */
export interface WBSConfig {
  meta: ModuleMetadata
  /** WBS code generation rules */
  codeRules: {
    useDotNotation: boolean
    maxLevels: number
    autoNumbering: boolean
    segmentPadLength: number
  }
  /** Tree behavior */
  tree: {
    allowDragDrop: boolean
    maxChildrenPerNode?: number
    collapseDepthDefault: number
    showEstimatedHours: boolean
  }
  /** Validation rules for WBS items */
  validation: {
    requireDescription: boolean
    maxNameLength: number
    uniqueCodeAcrossProject: boolean
  }
  access: AccessControl
  notifications: NotificationSettings
}

/**
 * AHSP (unit price catalog) configuration.
 */
export interface AHSPConfig {
  meta: ModuleMetadata
  /** Price calculation behavior */
  pricing: {
    includeEquipmentCost: boolean
    rounding: {
      enabled: boolean
      toNearest: number
    }
    escalationRateAnnualPct: number
    currency: string
  }
  /** Component breakdown rules */
  componentRules: {
    allowedTypes: string[] // material | labor | equipment | subcontract
    maxComponentsPerItem: number
    requireResourceLinking: boolean
  }
  /** Import/Export settings */
  importExport: {
    allowedFormats: string[]
    validateOnImport: boolean
    importMaxRows: number
  }
  access: AccessControl
  notifications: NotificationSettings
}

/**
 * RAB (Budget / Estimation) configuration.
 */
export interface RABConfig {
  meta: ModuleMetadata
  /** Calculation formula toggles */
  calculation: {
    includeOverheadPct: number
    includeProfitPct: number
    includeTaxPct: number
    allowManualOverride: boolean
    autoRecalcOnAhspChange: boolean
  }
  /** Item rules and validations */
  itemRules: {
    minVolume: number
    maxDecimalPrecision: number
    requireAhspReference: boolean
    enableBulkEdit: boolean
  }
  /** Cost control policies */
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

/**
 * Timeline / Gantt configuration.
 */
export interface TimelineConfig {
  meta: ModuleMetadata
  scheduling: {
    workCalendar: '7day' | '5day' | 'custom'
    defaultWorkHoursPerDay: number
    autoCalculateCriticalPath: boolean
    allowNegativeLag: boolean
    floatPrecisionDays: number
  }
  dependencyRules: {
    allowedTypes: string[] // FS, FF, SS, SF
    maxPredecessors: number
    defaultLagDays: number
  }
  baseline: {
    keepMultipleBaselines: boolean
    baselineLimit: number
  }
  access: AccessControl
  notifications: NotificationSettings
}

/**
 * RAP (time-phased budget) configuration.
 */
export interface RAPConfig {
  meta: ModuleMetadata
  distribution: {
    defaultPeriod: 'daily' | 'weekly' | 'monthly'
    roundingMethod: 'round' | 'ceil' | 'floor'
    allowManualAdjustPerPeriod: boolean
    minPeriodAllocationPct: number
  }
  generation: {
    autoGenerateFromRab: boolean
    useTimelineWeights: boolean
    smoothingWindowPeriods: number
  }
  access: AccessControl
  notifications: NotificationSettings
}

/**
 * Curva-S (S-Curve / Earned Value) configuration.
 */
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

/**
 * Resource Planning configuration.
 */
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

/**
 * Cash Flow configuration.
 */
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

/**
 * Progress Tracking configuration.
 */
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

/**
 * Reporting configuration.
 */
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

/**
 * Full features configuration container per project.
 */
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