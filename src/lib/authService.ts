/**
 * authService.ts
 * 
 * Supabase Auth service wrapper for authentication operations.
 * Provides methods for sign in, sign up, sign out, password reset, and profile management.
 */

import { supabase } from './supabaseClient'
import type { User, Session, AuthError } from '@supabase/supabase-js'

/**
 * ProfileData interface matching the profiles table
 */
export interface ProfileData {
  id: string
  full_name?: string | null
  avatar_url?: string | null
  role?: 'admin' | 'manager' | 'user'
  company?: string | null
  phone?: string | null
  created_at?: string
  updated_at?: string
}

/**
 * Auth service result types
 */
interface AuthResult {
  user?: User | null
  session?: Session | null
  error?: AuthError | Error | null
}

interface ProfileResult {
  profile?: ProfileData | null
  error?: Error | null
}

/**
 * authService
 * Provides authentication and profile management operations
 */
export const authService = {
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<AuthResult> {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return { error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      return {
        user: data?.user,
        session: data?.session,
        error: error || null,
      }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error('Sign in failed'),
      }
    }
  },

  /**
   * Sign up with email, password, full name, and role
   */
  async signUp(email: string, password: string, fullName?: string, role?: string): Promise<AuthResult> {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return { error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName || email.split('@')[0],
            role: role || 'ENGINEER', // Store role in metadata which trigger reads
          },
        },
      })

      return {
        user: data?.user,
        session: data?.session,
        error: error || null,
      }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error('Sign up failed'),
      }
    }
  },

  /**
   * Sign out current user
   */
  async signOut(): Promise<{ error?: AuthError | Error | null }> {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return { error: new Error('Supabase not configured') }
    }

    try {
      const { error } = await supabase.auth.signOut()
      return { error: error || null }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error('Sign out failed'),
      }
    }
  },

  /**
   * Get current session
   */
  async getSession(): Promise<{ session?: Session | null; error?: AuthError | Error | null }> {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return { session: null, error: null }
    }

    try {
      const { data, error } = await supabase.auth.getSession()
      return {
        session: data?.session,
        error: error || null,
      }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error('Get session failed'),
      }
    }
  },

  /**
   * Get current user
   */
  async getUser(): Promise<{ user?: User | null; error?: AuthError | Error | null }> {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return { user: null, error: null }
    }

    try {
      const { data, error } = await supabase.auth.getUser()
      return {
        user: data?.user,
        error: error || null,
      }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error('Get user failed'),
      }
    }
  },

  /**
   * Send password reset email
   */
  async resetPassword(email: string): Promise<{ error?: AuthError | Error | null }> {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return { error: new Error('Supabase not configured') }
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/#/reset-password`,
      })
      return { error: error || null }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error('Password reset failed'),
      }
    }
  },

  /**
   * Update password for current user
   */
  async updatePassword(newPassword: string): Promise<{ error?: AuthError | Error | null }> {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return { error: new Error('Supabase not configured') }
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })
      return { error: error || null }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error('Password update failed'),
      }
    }
  },

  /**
   * Get profile data for a user
   */
  async getProfile(userId: string): Promise<ProfileResult> {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return { profile: null, error: null }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // 404/PGRST116 means no row found – not a hard error, profile may not exist yet
        if (error.code === 'PGRST116' || error.message?.includes('not found')) {
          console.warn('Profile not found for user', userId)
          return { profile: null, error: null }
        }
        throw error
      }

      return { profile: data as ProfileData, error: null }
    } catch (err) {
      console.warn('getProfile failed:', err)
      return {
        profile: null,
        error: err instanceof Error ? err : new Error('Get profile failed'),
      }
    }
  },

  /**
   * Update profile data for a user
   */
  async updateProfile(
    userId: string,
    updates: Partial<ProfileData>
  ): Promise<ProfileResult> {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return { error: new Error('Supabase not configured') }
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', userId)
        .select()
        .single()

      if (error) throw error

      return { profile: data as ProfileData, error: null }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error('Update profile failed'),
      }
    }
  },

  /**
   * Listen to auth state changes
   * Returns unsubscribe function
   */
  onAuthStateChange(callback: (user: User | null, session: Session | null) => void): () => void {
    if (!supabase) {
      console.warn('Supabase not configured, auth disabled')
      return () => { }
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      callback(session?.user ?? null, session)
    })

    return () => {
      subscription.unsubscribe()
    }
  },
}
