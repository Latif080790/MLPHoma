/**
 * routes.ts
 * Centralized route mapping by module key for consistent navigation.
 * Ensures type-safe paths across modules.
 */

import { NAV_REGISTRY } from './navRegistry'

/**
 * ModuleKey
 * Union of all supported module keys used across the app.
 */
export type ModuleKey =
  | 'command-center'
  | 'projects'
  | 'project-overview'
  | 'cost-forecast'
  | 'change-management'
  | 'portfolio-resources'
  | 'portfolio-analytics'
  | 'strategy-simulation'
  | 'wbs'
  | 'ahsp'
  | 'rab'
  | 'timeline'
  | 'rap'
  | 'curvas'
  | 'resource'
  | 'cashflow'
  | 'progress'
  | 'reports'
  | 'finance'
  | 'supply-chain'
  | 'risk'
  | 'change-order'
  | 'documents'
  | 'command-center'
  | 'costing'
  | 'schedule'
  | 'handover'
  | 'tkdn'
  | 'settings'
  | 'features'
  | 'subcontractor'
  | 'maintenance'
  | 'qhse'
  | 'field-tasks'

/**
 * MODULE_ROUTES
 * Map module key -> route path used by HashRouter.
 * Keep a plain object for maximum compatibility with esbuild.
 */
export const MODULE_ROUTES: Record<ModuleKey, string> = {
  ...Object.fromEntries(
    NAV_REGISTRY.map((item) => [item.id, item.path])
  ) as Record<string, string>,
  'command-center': '/',
  projects: '/projects',
  'project-overview': '/project-overview',
  'cost-forecast': '/cost-forecast',
  'change-management': '/change-management',
  'portfolio-resources': '/portfolio-resources',
  'portfolio-analytics': '/portfolio-analytics',
  'strategy-simulation': '/strategy-simulation',
  wbs: '/wbs',
  ahsp: '/ahsp',
  rab: '/rab',
  timeline: '/timeline',
  rap: '/rap',
  curvas: '/curvas',
  resource: '/resource',
  cashflow: '/cashflow',
  progress: '/progress',
  reports: '/reports',
  finance: '/finance',
  'supply-chain': '/supply-chain',
  risk: '/risk',
  'change-order': '/change-management',
  documents: '/documents',
  costing: '/costing',
  schedule: '/schedule',
  handover: '/handover',
  tkdn: '/tkdn',
  settings: '/settings',
  features: '/features',
  subcontractor: '/subcontractor',
  maintenance: '/maintenance',
  qhse: '/qhse',
  'field-tasks': '/field-tasks',
}
