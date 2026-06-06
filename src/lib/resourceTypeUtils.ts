import type { ResourceType } from '../types/ahsp'

/**
 * Normalize raw resource type string (from DB or import) to domain ResourceType.
 * DB stores uppercase ('MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCON').
 * Domain expects lowercase ('material', 'labor', 'equipment', 'subcontractor').
 */
export function normalizeResourceType(raw: string): ResourceType {
  const upper = (raw || '').toUpperCase().trim()
  if (upper === 'LABOR') return 'labor'
  if (upper === 'EQUIPMENT') return 'equipment'
  if (upper === 'SUBCON' || upper === 'SUBCONTRACTOR') return 'subcontractor'
  return 'material'
}

/**
 * Normalize raw type string from import data — handles Indonesian keywords.
 */
export function normalizeImportType(raw: string): ResourceType {
  const lower = (raw || '').toLowerCase().trim()
  if (lower.includes('labor') || lower.includes('tenaga') || lower.includes('mandor') || lower.includes('tukang')) {
    return 'labor'
  }
  if (lower.includes('equipment') || lower.includes('alat') || lower.includes('machine') || lower.includes('sewa')) {
    return 'equipment'
  }
  if (lower.includes('subcon') || lower.includes('kontraktor') || lower.includes('pihak ketiga')) {
    return 'subcontractor'
  }
  return 'material'
}

/**
 * Convert domain ResourceType to DB enum string (uppercase).
 */
export function toDbResourceType(type: ResourceType): string {
  if (type === 'subcontractor') return 'SUBCON'
  return type.toUpperCase()
}
