/**
 * routes.ts
 * Centralized route mapping by module key for consistent navigation.
 * Ensures type-safe paths across modules.
 */

/**
 * ModuleKey
 * Union of all supported module keys used across the app.
 */
export type ModuleKey =
  | 'projects'
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

/**
 * MODULE_ROUTES
 * Map module key -> route path used by HashRouter.
 * Keep a plain object for maximum compatibility with esbuild.
 */
export const MODULE_ROUTES: Record<ModuleKey, string> = {
  projects: '/projects',
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
}
