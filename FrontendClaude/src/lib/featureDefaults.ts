/**
 * featureDefaults.ts
 *
 * Generator default configuration object untuk FeatureConfig.
 * Berguna untuk inisialisasi proyek baru, testing, dan UI preview.
 */

import { FEATURE_SCHEMA_VERSION } from '../config/features'
import type { FeatureConfig } from '../config/features'

/**
 * generateDefaultFeatureConfig
 *
 * Menghasilkan konfigurasi default yang lengkap untuk sebuah project.
 *
 * @param projectId - ID project yang akan menjadi owner dari config
 * @returns FeatureConfig - konfigurasi default lengkap
 */
export function generateDefaultFeatureConfig(projectId: string): FeatureConfig {
  const now = new Date().toISOString()
  const metaBase = {
    projectId,
    name: `Default config for ${projectId}`,
    schemaVersion: FEATURE_SCHEMA_VERSION,
    updatedAt: now,
    updatedBy: 'system',
  }

  return {
    projectId,
    projectManagement: {
      meta: { ...metaBase },
      workflow: { enableMultiStage: true, stages: ['Init', 'Plan', 'Execute', 'Close'], autoArchiveAfterDays: 365 },
      templates: { enableProjectTemplates: true, defaultTemplateId: 'tpl-standard', preserveWbsOnClone: true, preserveBudgetOnClone: false },
      numbering: { prefix: 'PRJ', counterStart: 1, useYearInCode: true },
      kpis: { budgetVarianceTolerancePct: 5, scheduleVarianceToleranceDays: 7, criticalPathNotifyDays: 14 },
      access: { readRoles: ['admin', 'pm', 'estimator'], writeRoles: ['admin', 'pm'], restrictedToOwner: false, requireApproval: false },
      notifications: { enabled: true, channels: ['inapp', 'email'], thresholds: { budgetOverrunPct: 10 }, dailyDigest: true, escalationMinutes: 60 },
      audit: { enableAuditLog: true, retentionDays: 3650, exportOnClose: true },
    },
    wbs: {
      meta: { ...metaBase },
      codeRules: { useDotNotation: true, maxLevels: 6, autoNumbering: true, segmentPadLength: 2 },
      tree: { allowDragDrop: true, maxChildrenPerNode: 50, collapseDepthDefault: 2, showEstimatedHours: true },
      validation: { requireDescription: false, maxNameLength: 120, uniqueCodeAcrossProject: true },
      access: { readRoles: ['admin', 'pm', 'planner'], writeRoles: ['admin', 'pm', 'planner'] },
      notifications: { enabled: true, channels: ['inapp'], thresholds: { wbsDepthExceeded: 6 } },
    },
    ahsp: {
      meta: { ...metaBase },
      pricing: { includeEquipmentCost: true, rounding: { enabled: true, toNearest: 100 }, escalationRateAnnualPct: 5, currency: 'IDR' },
      componentRules: { allowedTypes: ['material', 'labor', 'equipment', 'subcontract'], maxComponentsPerItem: 40, requireResourceLinking: true },
      importExport: { allowedFormats: ['xlsx', 'csv'], validateOnImport: true, importMaxRows: 20000 },
      access: { readRoles: ['admin', 'estimator'], writeRoles: ['admin', 'estimator'] },
      notifications: { enabled: true, channels: ['inapp', 'email'], thresholds: { priceChangePct: 5 } },
    },
    rab: {
      meta: { ...metaBase },
      calculation: { includeOverheadPct: 10, includeProfitPct: 8, includeTaxPct: 11, allowManualOverride: true, autoRecalcOnAhspChange: true },
      itemRules: { minVolume: 0.0001, maxDecimalPrecision: 4, requireAhspReference: true, enableBulkEdit: true },
      costControl: { contingencyPct: 3, approvalThresholdAmount: 50000000, budgetLockOnApproval: true },
      access: { readRoles: ['admin', 'estimator', 'pm'], writeRoles: ['admin', 'estimator'] },
      notifications: { enabled: true, channels: ['inapp'], thresholds: { budgetThresholdPct: 90 } },
      auditing: { captureUnitPriceHistory: true, priceChangeNotifyPct: 2 },
    },
    timeline: {
      meta: { ...metaBase },
      scheduling: { workCalendar: '5day', defaultWorkHoursPerDay: 8, autoCalculateCriticalPath: true, allowNegativeLag: false, floatPrecisionDays: 0.01 },
      dependencyRules: { allowedTypes: ['FS', 'FF', 'SS', 'SF'], maxPredecessors: 10, defaultLagDays: 0 },
      baseline: { keepMultipleBaselines: true, baselineLimit: 5 },
      access: { readRoles: ['admin', 'pm', 'planner'], writeRoles: ['admin', 'pm', 'planner'] },
      notifications: { enabled: true, channels: ['inapp'], thresholds: { criticalPathChangeDays: 3 } },
    },
    rap: {
      meta: { ...metaBase },
      distribution: { defaultPeriod: 'monthly', roundingMethod: 'round', allowManualAdjustPerPeriod: true, minPeriodAllocationPct: 0.1 },
      generation: { autoGenerateFromRab: true, useTimelineWeights: true, smoothingWindowPeriods: 1 },
      access: { readRoles: ['admin', 'pm', 'finance'], writeRoles: ['admin', 'pm'] },
      notifications: { enabled: true, channels: ['inapp', 'email'], thresholds: { periodAllocationPct: 5 } },
    },
    curvas: {
      meta: { ...metaBase },
      metrics: { spiTolerance: 0.95, cpiTolerance: 0.95, performanceWindowDays: 30, baselineSmoothingEnabled: true },
      actuals: { allowManualActuals: true, photoEvidenceRequiredForActuals: false, actualsLockAfterDays: 30 },
      analytics: { runDailyAnalysis: true, anomalyDetectionEnabled: true, anomalyThresholdPct: 10 },
      access: { readRoles: ['admin', 'pm', 'supervisor'], writeRoles: ['admin', 'pm'] },
      notifications: { enabled: true, channels: ['inapp'], thresholds: { spiAlert: 0.9 } },
      reporting: { defaultChartRangeMonths: 6, showDeviationBands: true },
    },
    resources: {
      meta: { ...metaBase },
      histogram: { bucketSizeDays: 7, normalizeByWorkingDays: true, showSkillLevels: true },
      procurement: { leadTimeDaysDefault: 14, reorderPointPct: 20, vendorPreferredList: [] },
      shortages: { alertWhenShortagePct: 10, autoSuggestSubstitutes: true },
      access: { readRoles: ['admin', 'pm', 'procurement'], writeRoles: ['admin', 'procurement'] },
      notifications: { enabled: true, channels: ['inapp'], thresholds: { shortagePct: 5 } },
    },
    cashflow: {
      meta: { ...metaBase },
      projection: { cashflowPeriod: 'monthly', includeRetentionPct: 5, earlyPaymentDiscountPct: 0, paymentTermsDays: 30 },
      whatIf: { enableWhatIf: true, maxScenariosStored: 12, scenarioComparisonColumns: ['planned', 'actual', 'variance'] },
      alerts: { deficitAlertPct: 10, liquidityReservePct: 5 },
      access: { readRoles: ['admin', 'pm', 'finance'], writeRoles: ['admin', 'finance'] },
      notifications: { enabled: true, channels: ['inapp', 'email'], thresholds: { cashDeficitPct: 5 } },
      export: { defaultExportFormat: 'xlsx', includeChartsInExport: true },
    },
    progress: {
      meta: { ...metaBase },
      capture: { allowPhotoUpload: true, maxPhotosPerTask: 5, requireCommentOnUpdate: false },
      autoUpdate: { enableAutoUpdateFromCurva: true, syncIntervalMinutes: 60 },
      quality: { defectThresholdPerTask: 2, requireQCApproval: true },
      access: { readRoles: ['admin', 'pm', 'supervisor'], writeRoles: ['admin', 'supervisor', 'foreman'] },
      notifications: { enabled: true, channels: ['inapp'], thresholds: { defectRatePct: 3 } },
    },
    reporting: {
      meta: { ...metaBase },
      dashboard: { widgets: ['kpiBudget', 'curvaS', 'cashflow', 'resourceHistogram'], refreshIntervalSeconds: 30, defaultDateRangeDays: 90 },
      exports: { enableExcelExport: true, enablePdfExport: true, defaultPaperSize: 'A4' },
      retention: { keepReportHistoryDays: 365, archivedReportsOn: 'monthly' },
      access: { readRoles: ['admin', 'pm', 'reporting'], writeRoles: ['admin'] },
      notifications: { enabled: true, channels: ['inapp'], thresholds: {} },
    },
  }
}