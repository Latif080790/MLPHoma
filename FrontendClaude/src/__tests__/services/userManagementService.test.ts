
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { userManagementService } from '../../services/userManagementService'
import { auditService } from '../../services/auditService'

// --- MOCKS ---
const mockFromFn = vi.fn()

vi.mock('../../lib/supabaseClient', () => ({
    supabase: null,
    assertSupabase: () => ({
        from: (...args: any[]) => mockFromFn(...args),
        // chaining handled in tests
    }),
}))

vi.mock('../../services/auditService', () => ({
    auditService: { log: vi.fn() }
}))

// Mock crypto.randomUUID if needed
if (!global.crypto) {
    vi.stubGlobal('crypto', { randomUUID: () => 'uuid-123' })
}

describe('User Management Service Unit Tests', () => {

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('Permissions', () => {
        it('should return correct permissions for Admin', () => {
            const perms = userManagementService.getPermissions('admin')
            expect(perms.canDelete).toBe(true)
            expect(perms.canManageUsers).toBe(true)
        })

        it('should return correct permissions for Viewer', () => {
            const perms = userManagementService.getPermissions('viewer')
            expect(perms.canCreate).toBe(false)
            expect(perms.canEdit).toBe(false)
        })

        it('should check hasPermission correctly', () => {
            expect(userManagementService.hasPermission('manager', 'canApprove')).toBe(true)
            expect(userManagementService.hasPermission('user', 'canApprove')).toBe(false)
        })
    })

    describe('updateUserRole', () => {
        it('should update role and log audit', async () => {
            // Mock Update
            mockFromFn.mockReturnValueOnce({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null })
                })
            })

            await userManagementService.updateUserRole('user-1', 'manager')

            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'UPDATE',
                entity: 'profiles',
                details: { newRole: 'manager' }
            }))
        })
    })

    describe('deactivateUser', () => {
        it('should set is_active to false', async () => {
            // Mock Update
            mockFromFn.mockReturnValueOnce({
                update: vi.fn().mockReturnValue({
                    eq: vi.fn().mockResolvedValue({ error: null })
                })
            })

            await userManagementService.deactivateUser('user-1')

            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ action: 'DEACTIVATE' }))
        })
    })

    describe('assignToProject', () => {
        it('should upsert project member and log audit', async () => {
            // Mock Upsert
            mockFromFn.mockReturnValueOnce({
                upsert: vi.fn().mockResolvedValue({ error: null })
            })

            await userManagementService.assignToProject('proj-1', 'user-1', 'manager')

            expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({
                action: 'ASSIGN',
                details: { projectId: 'proj-1', role: 'manager' }
            }))
        })
    })

})
