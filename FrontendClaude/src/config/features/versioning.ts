import type { FeatureModuleKey } from './featureConfig'

export const FEATURE_SCHEMA_VERSION = '1.1.0'

export const FEATURE_MODULE_KEYS: FeatureModuleKey[] = [
  'projectManagement',
  'wbs',
  'ahsp',
  'rab',
  'timeline',
  'rap',
  'curvas',
  'resources',
  'cashflow',
  'progress',
  'reporting',
]

export const FEATURE_DOMAIN_SCHEMA_VERSIONS: Record<FeatureModuleKey, string> = {
  projectManagement: FEATURE_SCHEMA_VERSION,
  wbs: FEATURE_SCHEMA_VERSION,
  ahsp: FEATURE_SCHEMA_VERSION,
  rab: FEATURE_SCHEMA_VERSION,
  timeline: FEATURE_SCHEMA_VERSION,
  rap: FEATURE_SCHEMA_VERSION,
  curvas: FEATURE_SCHEMA_VERSION,
  resources: FEATURE_SCHEMA_VERSION,
  cashflow: FEATURE_SCHEMA_VERSION,
  progress: FEATURE_SCHEMA_VERSION,
  reporting: FEATURE_SCHEMA_VERSION,
}

export function isSupportedFeatureSchemaVersion(version: string): boolean {
  return version === FEATURE_SCHEMA_VERSION
}
