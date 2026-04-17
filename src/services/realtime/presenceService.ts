/**
 * presenceService.ts
 * 
 * Orchestrates Supabase Realtime Presence for multi-user collaboration.
 * Allows tracking users across project contexts and specific modules.
 */

import { RealtimeChannel } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabaseClient'

export interface PresenceUser {
  user_id: string
  full_name: string
  avatar_url?: string
  role?: string
  last_seen_at: string
  current_module?: string
  status: 'online' | 'idle' | 'editing'
}

class PresenceService {
  private channels: Map<string, RealtimeChannel> = new Map()

  /**
   * Subscribe to a presence channel for a specific project
   */
  subscribe(projectId: string, user: PresenceUser, onSync: (users: PresenceUser[]) => void) {
    if (!supabase) return null

    const channelName = `project_presence:${projectId}`
    
    // If already subscribed, just update state
    if (this.channels.has(channelName)) {
      this.track(channelName, user)
      return this.channels.get(channelName)
    }

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: user.user_id,
        },
      },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState()
        const users: PresenceUser[] = []
        
        Object.values(state).forEach((presences: any) => {
          presences.forEach((p: any) => {
            users.push(p as PresenceUser)
          })
        })
        
        onSync(users)
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track(user)
        }
      })

    this.channels.set(channelName, channel)
    return channel
  }

  /**
   * Update current user state in a specific channel
   */
  async track(channelName: string, user: Partial<PresenceUser>) {
    const channel = this.channels.get(channelName)
    if (channel) {
      await channel.track(user)
    }
  }

  /**
   * Unsubscribe from a channel
   */
  async unsubscribe(projectId: string) {
    const channelName = `project_presence:${projectId}`
    const channel = this.channels.get(channelName)
    if (channel) {
      await channel.unsubscribe()
      this.channels.delete(channelName)
    }
  }
}

export const presenceService = new PresenceService()
