/**
 * idGenerator.ts
 * Centralized ID generation utility using crypto.randomUUID()
 * for cryptographically secure unique identifiers.
 */

/**
 * Generate a unique ID using crypto.randomUUID()
 * 
 * @param prefix - Optional prefix to prepend to the UUID (e.g., 'wbs', 'rab', 'task')
 * @returns A unique ID string, optionally prefixed
 * 
 * @example
 * generateId() // '550e8400-e29b-41d4-a716-446655440000'
 * generateId('wbs') // 'wbs-550e8400-e29b-41d4-a716-446655440000'
 * generateId('task') // 'task-550e8400-e29b-41d4-a716-446655440000'
 */
export function generateId(prefix: string = ''): string {
  const uuid = crypto.randomUUID()
  return prefix ? `${prefix}-${uuid}` : uuid
}
