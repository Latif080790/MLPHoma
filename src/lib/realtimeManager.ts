/**
 * realtimeManager.ts
 * Centralized Supabase Realtime subscription manager.
 * Subscribes to postgres_changes across key tables and invalidates React Query
 * caches so UI components auto-refresh without polling.
 */

import { QueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

/**
 * Subscribe to project-scoped realtime changes on:
 *   - approval_requests  → invalidates ['approvals', projectId]
 *   - timeline_tasks     → invalidates ['timeline', projectId]
 *   - finance_invoices   → invalidates ['invoices', projectId]
 *   - notifications      → invalidates ['notifications', projectId]
 *
 * All events (INSERT / UPDATE / DELETE) are captured.
 *
 * @returns unsubscribe function — call it on component unmount / project change.
 */
export function subscribeToProjectRealtime(
    projectId: string,
    queryClient: QueryClient
): () => void {
    if (!supabase) return () => {}

    const channel = supabase
        .channel(`project-${projectId}`)
        // approval_requests
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'approval_requests',
                filter: `project_id=eq.${projectId}`,
            },
            () => {
                queryClient.invalidateQueries({ queryKey: ['approvals', projectId] })
            }
        )
        // timeline_tasks
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'timeline_tasks',
                filter: `project_id=eq.${projectId}`,
            },
            () => {
                queryClient.invalidateQueries({ queryKey: ['timeline', projectId] })
            }
        )
        // finance_invoices
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'finance_invoices',
                filter: `project_id=eq.${projectId}`,
            },
            () => {
                queryClient.invalidateQueries({ queryKey: ['invoices', projectId] })
            }
        )
        // notifications
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `project_id=eq.${projectId}`,
            },
            () => {
                queryClient.invalidateQueries({ queryKey: ['notifications', projectId] })
            }
        )
        .subscribe()

    return () => {
        supabase!.removeChannel(channel)
    }
}

/**
 * Subscribe to user-scoped realtime changes on:
 *   - notifications filtered by user_id → invalidates ['notifications', userId]
 *
 * Use this in global layouts where no single projectId is in scope but the
 * notification bell still needs to stay current.
 *
 * @returns unsubscribe function — call it on unmount / user sign-out.
 */
export function subscribeToUserRealtime(
    userId: string,
    queryClient: QueryClient
): () => void {
    if (!supabase) return () => {}

    const channel = supabase
        .channel(`user-${userId}`)
        .on(
            'postgres_changes',
            {
                event: '*',
                schema: 'public',
                table: 'notifications',
                filter: `user_id=eq.${userId}`,
            },
            () => {
                queryClient.invalidateQueries({ queryKey: ['notifications', userId] })
            }
        )
        .subscribe()

    return () => {
        supabase!.removeChannel(channel)
    }
}
