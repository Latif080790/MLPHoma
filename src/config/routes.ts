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
  | 'project-overview'
  | 'finance'
  | 'supply-chain'
  | 'change-order'
  | 'documents'
  | 'command-center'
  | 'costing'
  | 'schedule'
  | 'handover'
  | 'tkdn'
  | 'settings'
  | 'features'

export const MODULE_ROUTES: Record<ModuleKey, string> = {
  projects: '/projects',
  'project-overview': '/project-overview',
  finance: '/finance',
  'supply-chain': '/supply-chain',
  'change-order': '/change-management',
  documents: '/documents',
  'command-center': '/',
  costing: '/costing',
  schedule: '/schedule',
  handover: '/handover',
  tkdn: '/tkdn',
  settings: '/settings',
  features: '/features',
}
