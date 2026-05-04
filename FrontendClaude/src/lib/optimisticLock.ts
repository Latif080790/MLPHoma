/**
 * optimisticLock.ts
 *
 * Client-side helper for optimistic locking via the server-side
 * `rpc_optimistic_update` function (Migration 054).
 *
 * Usage:
 *   import { optimisticUpdate } from '@/lib/optimisticLock'
 *
 *   const result = await optimisticUpdate('rab_items', itemId, item.updatedAt, {
 *     unit_price: 50000,
 *     volume: 10,
 *   })
 *
 * Throws `OptimisticLockError` if concurrent modification detected.
 */

import { assertSupabase } from './supabaseClient'

export class OptimisticLockError extends Error {
  constructor(
    public readonly table: string,
    public readonly id: string,
    public readonly serverTimestamp: string
  ) {
    super(
      `Konflik: Data telah diubah oleh pengguna lain. Silakan muat ulang halaman dan coba lagi.`
    )
    this.name = 'OptimisticLockError'
  }
}

/**
 * Perform an optimistic update via server-side RPC.
 * Checks `updated_at` before applying changes.
 *
 * @param table - Target table name (must be whitelisted in RPC)
 * @param id - Row ID to update
 * @param expectedUpdatedAt - The `updated_at` value the client last read
 * @param updates - Partial record of fields to update
 * @returns The updated row as JSON
 * @throws OptimisticLockError if concurrent modification detected
 */
export async function optimisticUpdate<T = Record<string, unknown>>(
  table: string,
  id: string,
  expectedUpdatedAt: string | Date,
  updates: Record<string, unknown>
): Promise<T> {
  const client = assertSupabase()

  const { data, error } = await client.rpc('rpc_optimistic_update', {
    p_table_name: table,
    p_id: id,
    p_expected_updated_at:
      typeof expectedUpdatedAt === 'string'
        ? expectedUpdatedAt
        : expectedUpdatedAt.toISOString(),
    p_updates: updates,
  })

  if (error) {
    // Detect optimistic lock conflict from server error message
    if (
      error.message?.includes('OPTIMISTIC_LOCK_CONFLICT') ||
      error.message?.includes('Concurrent modification')
    ) {
      throw new OptimisticLockError(table, id, error.message)
    }
    throw error
  }

  return data as T
}
