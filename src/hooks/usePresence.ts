/**
 * usePresence.ts
 * 
 * Custom hook to manage presence tracking for a project or module.
 * Automatically handles subscription, tracking, and peer discovery.
 */

import { useEffect, useState, useMemo } from 'react'
import { useAuthStore } from '../store/authStore'
import { presenceService, type PresenceUser } from '../services/realtime/presenceService'

export function usePresence(projectId: string | null, moduleId?: string) {
  const { user, profile } = useAuthStore()
  const [peers, setPeers] = useState<PresenceUser[]>([])

  const currentUserPresence = useMemo<PresenceUser | null>(() => {
    if (!user) return null
    return {
      user_id: user.id,
      full_name: profile?.full_name || user.email?.split('@')[0] || 'Unknown User',
      avatar_url: profile?.avatar_url || (user.user_metadata?.avatar_url as string),
      role: profile?.role || 'user',
      last_seen_at: new Date().toISOString(),
      current_module: moduleId,
      status: 'online',
    }
  }, [user, profile, moduleId])

  useEffect(() => {
    if (!projectId || !currentUserPresence) return

    const channel = presenceService.subscribe(
      projectId,
      currentUserPresence,
      (users) => {
        // Filter out current user from peers if needed, but usually we show all
        setPeers(users)
      }
    )

    return () => {
      presenceService.unsubscribe(projectId).catch(console.error)
    }
  }, [projectId, currentUserPresence])

  /**
   * Update status manually (e.g., when starting to edit)
   */
  const setStatus = async (status: PresenceUser['status']) => {
    if (!projectId || !currentUserPresence) return
    await presenceService.track(`project_presence:${projectId}`, {
      ...currentUserPresence,
      status,
      last_seen_at: new Date().toISOString(),
    })
  }

  return {
    peers,
    currentUser: currentUserPresence,
    setStatus,
  }
}
