/**
 * notificationService.ts
 * Service layer for the Notification Engine.
 * Handles CRUD + Supabase Realtime subscription for live notifications.
 */

import { assertSupabase, supabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import type { AppNotification, CreateNotificationInput } from '../types/notification'

// ------------------------------------------------------------------
// Row ↔ Domain Mappers
// ------------------------------------------------------------------

function rowToNotification(row: any): AppNotification {
    return {
        id: row.id,
        projectId: row.project_id,
        userId: row.user_id,
        type: row.type,
        severity: row.severity,
        title: row.title,
        message: row.message,
        metadata: row.metadata ?? {},
        entityType: row.entity_type,
        entityId: row.entity_id,
        isRead: row.is_read ?? false,
        readAt: row.read_at,
        createdAt: row.created_at,
    }
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

export const notificationService = {

    /**
     * Fetch all notifications for the current user
     */
    async getNotifications(userId: string, limit = 50): Promise<AppNotification[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit)

        if (error) throw error
        return (data || []).map(rowToNotification)
    },

    /**
     * Fetch unread count for badge
     */
    async getUnreadCount(userId: string): Promise<number> {
        const client = assertSupabase()
        const { count, error } = await client
            .from('notifications')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('is_read', false)

        if (error) throw error
        return count ?? 0
    },

    /**
     * Create a notification (can target a specific user)
     */
    async createNotification(input: CreateNotificationInput): Promise<AppNotification> {
        const client = assertSupabase()
        const id = generateId('notif')

        const { data, error } = await client
            .from('notifications')
            .insert({
                id,
                project_id: input.projectId || null,
                user_id: input.userId,
                type: input.type,
                severity: input.severity,
                title: input.title,
                message: input.message,
                metadata: input.metadata ?? {},
                entity_type: input.entityType || null,
                entity_id: input.entityId || null,
                is_read: false,
            })
            .select()
            .single()

        if (error) throw error
        return rowToNotification(data)
    },

    /**
     * Broadcast notification to all users with a specific role in a project
     */
    async notifyByRole(
        projectId: string,
        role: 'admin' | 'manager' | 'user',
        input: Omit<CreateNotificationInput, 'userId'>
    ): Promise<void> {
        const client = assertSupabase()

        // Find all users with the specified role
        const { data: profiles, error: profileError } = await client
            .from('profiles')
            .select('id')
            .eq('role', role)

        if (profileError) throw profileError

        // Create notification for each matching user
        const notifications = (profiles || []).map((p: any) => ({
            id: generateId('notif'),
            project_id: projectId,
            user_id: p.id,
            type: input.type,
            severity: input.severity,
            title: input.title,
            message: input.message,
            metadata: input.metadata ?? {},
            entity_type: input.entityType || null,
            entity_id: input.entityId || null,
            is_read: false,
        }))

        if (notifications.length > 0) {
            const { error } = await client.from('notifications').insert(notifications)
            if (error) throw error
        }
    },

    /**
     * Mark a single notification as read
     */
    async markAsRead(notificationId: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('id', notificationId)

        if (error) throw error
    },

    /**
     * Mark all notifications as read for a user
     */
    async markAllAsRead(userId: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('notifications')
            .update({ is_read: true, read_at: new Date().toISOString() })
            .eq('user_id', userId)
            .eq('is_read', false)

        if (error) throw error
    },

    /**
     * Delete a notification
     */
    async deleteNotification(notificationId: string): Promise<void> {
        const client = assertSupabase()
        const { error } = await client
            .from('notifications')
            .delete()
            .eq('id', notificationId)

        if (error) throw error
    },

    /**
     * Subscribe to realtime notifications for a user.
     * Returns an unsubscribe function.
     */
    subscribeToNotifications(
        userId: string,
        onNewNotification: (notification: AppNotification) => void
    ): () => void {
        if (!supabase) return () => {}

        const channel = supabase
            .channel(`notifications:${userId}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const notification = rowToNotification(payload.new)
                    onNewNotification(notification)
                }
            )
            .subscribe()

        return () => {
            supabase!.removeChannel(channel)
        }
    },
}
