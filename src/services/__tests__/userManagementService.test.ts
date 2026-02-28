import { beforeEach, describe, expect, it, vi } from 'vitest'

let tableResults: Record<string, any> = {}

function makeChain(result: any) {
  const c: any = {}
  c.select = () => c
  c.eq = () => c
  c.order = () => c
  c.maybeSingle = () => Promise.resolve(result)
  c.single = () => Promise.resolve(result)
  c.then = (res: any) => Promise.resolve(result).then(res)
  return c
}

vi.mock('../../lib/supabaseClient', () => ({
  assertSupabase: () => ({ from: (table: string) => makeChain(tableResults[table] ?? { data: null, error: null }) }),
}))

vi.mock('../auditService', () => ({
  auditService: { log: vi.fn().mockResolvedValue(undefined) },
}))

import { userManagementService } from '../userManagementService'

describe('userManagementService', () => {
  beforeEach(() => {
    tableResults = {}
  })

  it('returns permission matrix correctly', () => {
    expect(userManagementService.hasPermission('admin', 'canDelete')).toBe(true)
    expect(userManagementService.hasPermission('viewer', 'canEdit')).toBe(false)
    expect(userManagementService.getPermissions('manager').canApprove).toBe(true)
  })

  it('maps user rows into UserProfile shape', async () => {
    tableResults.profiles = {
      data: [{ id: 'u1', email: 'a@x.com', full_name: 'A User', role: 'manager', is_active: true, created_at: '2026-01-01' }],
      error: null,
    }

    const users = await userManagementService.getUsers()
    expect(users).toHaveLength(1)
    expect(users[0].fullName).toBe('A User')
    expect(users[0].role).toBe('manager')
  })
})
