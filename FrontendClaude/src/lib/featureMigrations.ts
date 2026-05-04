/**
 * featureMigrations.ts
 *
 * Utilities to migrate FeatureConfig objects between schemaVersion.
 * - Provides migrateConfig which performs lightweight, idempotent transforms.
 * - Designed to be extended as schema evolves.
 */

import {
  FEATURE_MODULE_KEYS,
  FEATURE_SCHEMA_VERSION,
} from '../config/features'
import type { FeatureConfig } from '../config/features'

/**
 * migrateConfig
 * If config has older schemaVersion or missing, bring it to the latest shape.
 *
 * @param cfg - incoming FeatureConfig (possibly old)
 * @returns migrated FeatureConfig
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function migrateConfig(cfg: any): FeatureConfig {
  try {
    if (!cfg || typeof cfg !== 'object') throw new Error('invalid config')
    const version = String(cfg?.projectManagement?.meta?.schemaVersion || cfg?.schemaVersion || '1.0.0')
    // current version for this app (bump when making breaking changes)
    const CURRENT = FEATURE_SCHEMA_VERSION

    // For now only ensure meta fields exist and version set. Extendable.
    if (!cfg.projectId && cfg.projectId !== '') {
      // if projectId was at top-level, keep it; otherwise fallback to nested meta
      if (cfg?.projectManagement?.meta?.projectId) cfg.projectId = cfg.projectManagement.meta.projectId
    }

    if (!cfg.projectManagement?.meta) cfg.projectManagement = cfg.projectManagement || { meta: { projectId: cfg.projectId || '', schemaVersion: CURRENT, updatedAt: new Date().toISOString(), updatedBy: 'migration' } }

    // If older version, run specific migrations (no-op currently)
    if (version !== CURRENT) {
      // Example placeholder: if version === '0.9.0' -> do something
      // eslint-disable-next-line no-console
      console.info(`featureMigrations: migrating ${cfg.projectId || '?'} from ${version} -> ${CURRENT}`)
    }

    // Ensure schemaVersion set across modules
    const ensureMeta = (key: string) => {
      if (!cfg[key]) {
         cfg[key] = { meta: { projectId: cfg.projectId || '', name: '', schemaVersion: CURRENT, updatedAt: new Date().toISOString(), updatedBy: 'migration' } }
      } else if (!cfg[key].meta) {
        cfg[key].meta = { projectId: cfg.projectId || '', name: '', schemaVersion: CURRENT, updatedAt: new Date().toISOString(), updatedBy: 'migration' }
      } else {
        cfg[key].meta.schemaVersion = cfg[key].meta.schemaVersion || CURRENT
      }
    }

    // apply for known module keys
    FEATURE_MODULE_KEYS.forEach((k) => {
      ensureMeta(k)
    })

    // final canonical fields
    cfg.schemaVersion = CURRENT
    return cfg as FeatureConfig
  } catch (e) {
    // fallback: create minimal default shaped object
    const fallback: FeatureConfig = {
      projectId: cfg?.projectId || 'unknown',
      projectManagement: {
        meta: { projectId: cfg?.projectId || 'unknown', name: 'fallback', schemaVersion: FEATURE_SCHEMA_VERSION, updatedAt: new Date().toISOString(), updatedBy: 'migration' },
        workflow: { enableMultiStage: true, stages: ['Init', 'Plan', 'Execute', 'Close'], autoArchiveAfterDays: 365 },
        templates: { enableProjectTemplates: false, defaultTemplateId: undefined, preserveWbsOnClone: true, preserveBudgetOnClone: false },
        numbering: { prefix: 'PRJ', counterStart: 1, useYearInCode: true },
        kpis: { budgetVarianceTolerancePct: 5, scheduleVarianceToleranceDays: 7, criticalPathNotifyDays: 14 },
        access: { readRoles: ['admin'], writeRoles: ['admin'] },
        notifications: { enabled: true, channels: ['inapp'], thresholds: {} },
        audit: { enableAuditLog: true, retentionDays: 365 },
      },
      /* eslint-disable @typescript-eslint/no-explicit-any */
      wbs: { meta: { projectId: cfg?.projectId || 'unknown' } as any, codeRules: { useDotNotation: true, maxLevels: 5, autoNumbering: true, segmentPadLength: 2 }, tree: { allowDragDrop: true, maxChildrenPerNode: 50, collapseDepthDefault: 2, showEstimatedHours: true }, validation: { requireDescription: false, maxNameLength: 120, uniqueCodeAcrossProject: true }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} } } as any,
      ahsp: { meta: { projectId: cfg?.projectId || 'unknown' } as any, pricing: { includeEquipmentCost: true, rounding: { enabled: true, toNearest: 100 }, escalationRateAnnualPct: 5, currency: 'IDR' }, componentRules: { allowedTypes: ['material', 'labor', 'equipment'], maxComponentsPerItem: 40, requireResourceLinking: true }, importExport: { allowedFormats: ['xlsx', 'csv'], validateOnImport: true, importMaxRows: 20000 }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} } } as any,
      rab: { meta: { projectId: cfg?.projectId || 'unknown' } as any, calculation: { includeOverheadPct: 10, includeProfitPct: 8, includeTaxPct: 11, allowManualOverride: true, autoRecalcOnAhspChange: true }, itemRules: { minVolume: 0.0001, maxDecimalPrecision: 4, requireAhspReference: true, enableBulkEdit: true }, costControl: { contingencyPct: 3, approvalThresholdAmount: 50000000, budgetLockOnApproval: true }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} }, auditing: { captureUnitPriceHistory: true, priceChangeNotifyPct: 2 } } as any,
      timeline: { meta: { projectId: cfg?.projectId || 'unknown' } as any, scheduling: { workCalendar: '5day', defaultWorkHoursPerDay: 8, autoCalculateCriticalPath: true, allowNegativeLag: false, floatPrecisionDays: 0.01 }, dependencyRules: { allowedTypes: ['FS', 'FF', 'SS', 'SF'], maxPredecessors: 10, defaultLagDays: 0 }, baseline: { keepMultipleBaselines: true, baselineLimit: 5 }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} } } as any,
      rap: { meta: { projectId: cfg?.projectId || 'unknown' } as any, distribution: { defaultPeriod: 'monthly', roundingMethod: 'round', allowManualAdjustPerPeriod: true, minPeriodAllocationPct: 0.1 }, generation: { autoGenerateFromRab: true, useTimelineWeights: true, smoothingWindowPeriods: 1 }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} } } as any,
      curvas: { meta: { projectId: cfg?.projectId || 'unknown' } as any, metrics: { spiTolerance: 0.95, cpiTolerance: 0.95, performanceWindowDays: 30, baselineSmoothingEnabled: true }, actuals: { allowManualActuals: true, photoEvidenceRequiredForActuals: false, actualsLockAfterDays: 30 }, analytics: { runDailyAnalysis: true, anomalyDetectionEnabled: true, anomalyThresholdPct: 10 }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} }, reporting: { defaultChartRangeMonths: 6, showDeviationBands: true } } as any,
      resources: { meta: { projectId: cfg?.projectId || 'unknown' } as any, histogram: { bucketSizeDays: 7, normalizeByWorkingDays: true, showSkillLevels: true }, procurement: { leadTimeDaysDefault: 14, reorderPointPct: 20, vendorPreferredList: [] }, shortages: { alertWhenShortagePct: 10, autoSuggestSubstitutes: true }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} } } as any,
      cashflow: { meta: { projectId: cfg?.projectId || 'unknown' } as any, projection: { cashflowPeriod: 'monthly', includeRetentionPct: 5, earlyPaymentDiscountPct: 0, paymentTermsDays: 30 }, whatIf: { enableWhatIf: true, maxScenariosStored: 12, scenarioComparisonColumns: ['planned', 'actual', 'variance'] }, alerts: { deficitAlertPct: 10, liquidityReservePct: 5 }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} }, export: { defaultExportFormat: 'xlsx', includeChartsInExport: true } } as any,
      progress: { meta: { projectId: cfg?.projectId || 'unknown' } as any, capture: { allowPhotoUpload: true, maxPhotosPerTask: 5, requireCommentOnUpdate: false }, autoUpdate: { enableAutoUpdateFromCurva: true, syncIntervalMinutes: 60 }, quality: { defectThresholdPerTask: 2, requireQCApproval: true }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} } } as any,
      reporting: { meta: { projectId: cfg?.projectId || 'unknown' } as any, dashboard: { widgets: ['kpiBudget', 'curvaS', 'cashflow', 'resourceHistogram'], refreshIntervalSeconds: 30, defaultDateRangeDays: 90 }, exports: { enableExcelExport: true, enablePdfExport: true, defaultPaperSize: 'A4' }, retention: { keepReportHistoryDays: 365, archivedReportsOn: 'monthly' }, access: { readRoles: ['admin'], writeRoles: ['admin'] }, notifications: { enabled: true, channels: ['inapp'], thresholds: {} } } as any,
      /* eslint-enable @typescript-eslint/no-explicit-any */
    }
    return fallback
  }
}