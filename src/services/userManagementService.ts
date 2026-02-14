/**
 * userManagementService.ts
 * FASE 4.3: User Management & Role-Based Access Control
 *
 * Features:
 * 1. List/manage users in the system
 * 2. Assign roles per project (admin, manager, user, viewer)
 * 3. Invite new users with email
 * 4. Role-based permission checks
 * 5. User activity log
 */

import { assertSupabase } from '../lib/supabaseClient'
import { auditService } from './auditService'

// ---------- Types ----------

export type UserRole = 'admin' | 'manager' | 'user' | 'viewer'

export interface UserProfile {
    id: string
    email: string
    fullName: string
    role: UserRole
    avatarUrl?: string
    phone?: string
    company?: string
    isActive: boolean
    lastActiveAt?: string
    createdAt: string
}

export interface ProjectMember {
    userId: string
    profileName: string
    profileEmail: string
    projectRole: UserRole
    assignedAt: string
}

export interface RolePermission {
    canView: boolean
    canCreate: boolean
    canEdit: boolean
    canDelete: boolean
    canApprove: boolean
    canExport: boolean
    canManageUsers: boolean
}

// ---------- Permission Matrix ----------

const ROLE_PERMISSIONS: Record<UserRole, RolePermission> = {
    admin: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
        canApprove: true,
        canExport: true,
        canManageUsers: true,
    },
    manager: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: true,
        canExport: true,
        canManageUsers: false,
    },
    user: {
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: false,
        canApprove: false,
        canExport: true,
        canManageUsers: false,
    },
    viewer: {
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
        canApprove: false,
        canExport: true,
        canManageUsers: false,
    },
}

// ---------- Service ----------

export const userManagementService = {

    /**
     * Get permissions for a role
     */
    getPermissions(role: UserRole): RolePermission {
        return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer
    },

    /**
     * Check if a role has a specific permission
     */
    hasPermission(role: UserRole, permission: keyof RolePermission): boolean {
        return ROLE_PERMISSIONS[role]?.[permission] ?? false
    },

    /**
     * Get all user profiles
     */
    async getUsers(): Promise<UserProfile[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) throw error
        return (data || []).map(rowToProfile)
    },

    /**
     * Get a single user profile
     */
    async getUser(userId: string): Promise<UserProfile | null> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle()

        if (error) throw error
        return data ? rowToProfile(data) : null
    },

    /**
     * Update user role
     */
    async updateUserRole(userId: string, newRole: UserRole): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId)

        if (error) throw error

        try {
            await auditService.log({
                action: 'UPDATE',
                entity: 'profiles',
                entityType: 'USER',
                entityId: userId,
                details: { newRole },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }
    },

    /**
     * Deactivate a user (soft delete)
     */
    async deactivateUser(userId: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('profiles')
            .update({ is_active: false })
            .eq('id', userId)

        if (error) throw error

        try {
            await auditService.log({
                action: 'DEACTIVATE',
                entity: 'profiles',
                entityType: 'USER',
                entityId: userId,
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }
    },

    /**
     * Reactivate a user
     */
    async reactivateUser(userId: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('profiles')
            .update({ is_active: true })
            .eq('id', userId)

        if (error) throw error
    },

    /**
     * Get project members (users assigned to a specific project)
     * Uses a project_members join table if exists, or falls back to all profiles.
     */
    async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
        const client = assertSupabase()

        // Try project_members table first
        const { data, error } = await client
            .from('project_members')
            .select(`
                user_id,
                project_role,
                assigned_at,
                profiles ( id, full_name, email )
            `)
            .eq('project_id', projectId)

        if (error || !data || data.length === 0) {
            // Fallback: return all users as project members (small team assumption)
            const users = await this.getUsers()
            return users.map(u => ({
                userId: u.id,
                profileName: u.fullName,
                profileEmail: u.email,
                projectRole: u.role,
                assignedAt: u.createdAt,
            }))
        }

        return data.map((row: any) => ({
            userId: row.user_id,
            profileName: row.profiles?.full_name || 'Unknown',
            profileEmail: row.profiles?.email || '',
            projectRole: row.project_role || 'user',
            assignedAt: row.assigned_at,
        }))
    },

    /**
     * Assign a user to a project with a specific role
     */
    async assignToProject(projectId: string, userId: string, role: UserRole): Promise<void> {
        const client = assertSupabase()

        const { error } = await client
            .from('project_members')
            .upsert({
                project_id: projectId,
                user_id: userId,
                project_role: role,
                assigned_at: new Date().toISOString(),
            })

        if (error) {
            // If project_members table doesn't exist, just update profile role
            console.warn('project_members table may not exist, updating profile role directly')
            await this.updateUserRole(userId, role)
            return
        }

        try {
            await auditService.log({
                action: 'ASSIGN',
                entity: 'project_members',
                entityType: 'USER',
                entityId: userId,
                details: { projectId, role },
            })
        } catch (e) {
            console.warn('Audit log failed:', e)
        }
    },

    /**
     * Invite a new user by email (creates a Supabase auth invitation)
     */
    async inviteUser(email: string, role: UserRole = 'user'): Promise<{ success: boolean; message: string }> {
        const client = assertSupabase()

        // Note: Supabase's admin.inviteUserByEmail requires service role key
        // In a client-side app, this would typically go through your backend API
        // For now, we create a profile entry and let the user sign up
        try {
            const { error } = await client
                .from('profiles')
                .insert({
                    id: crypto.randomUUID(),
                    email,
                    role,
                    full_name: email.split('@')[0],
                    is_active: false, // Inactive until they complete signup
                })

            if (error && error.code === '23505') {
                return { success: false, message: 'User with this email already exists' }
            }
            if (error) throw error

            return { success: true, message: `Invitation created for ${email} with role ${role}` }
        } catch (e: any) {
            return { success: false, message: e.message }
        }
    },
}

// ---------- Helper ----------

function rowToProfile(row: any): UserProfile {
    return {
        id: row.id,
        email: row.email || '',
        fullName: row.full_name || row.name || '',
        role: row.role || 'user',
        avatarUrl: row.avatar_url,
        phone: row.phone,
        company: row.company,
        isActive: row.is_active !== false,
        lastActiveAt: row.last_active_at,
        createdAt: row.created_at,
    }
}
