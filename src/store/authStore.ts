/**
 * authStore.ts
 * 
 * Zustand store for authentication state management.
 * Manages user, session, profile, and auth-related operations.
 */

import { create } from 'zustand'
import { authService, type ProfileData } from '../lib/authService'
import type { User, Session } from '@supabase/supabase-js'

/**
 * AuthState interface
 */
interface AuthState {
  // State
  user: User | null
  session: Session | null
  profile: ProfileData | null
  loading: boolean
  initialized: boolean
  error: string | null

  // RBAC Role
  role: 'PROJECT_MANAGER' | 'QC_ENGINEER' | 'FINANCE' | 'ADMIN' | 'ENGINEER' | null

  // Actions
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, fullName?: string, role?: string) => Promise<boolean>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<boolean>
  refreshProfile: () => Promise<void>
  clearError: () => void
}

/**
 * useAuthStore
 * Zustand store for authentication
 */
export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  session: null,
  profile: null,
  loading: false,
  initialized: false,
  error: null,
  role: null,

  /**
   * Initialize auth state
   * Gets current session and sets up auth state change listener
   */
  initialize: async () => {
    try {
      set({ loading: true, error: null })

      // Get current session
      const { session, error: sessionError } = await authService.getSession()

      if (sessionError) {
        console.warn('Auth initialization failed:', sessionError.message)
        set({ loading: false, initialized: true })
        return
      }

      // If session exists, get profile
      let profile: ProfileData | null = null
      if (session?.user) {
        const { profile: fetchedProfile, error: profileError } = await authService.getProfile(
          session.user.id
        )

        if (profileError) {
          console.warn('Failed to fetch profile:', profileError.message)
        } else {
          profile = fetchedProfile || null
        }
      }

      // Real Role Assignment
      let role: AuthState['role'] = null
      if (profile?.role) {
        role = profile.role as AuthState['role']
      } else if (session?.user?.user_metadata?.role) {
        // Fallback to user metadata
        role = session.user.user_metadata.role as AuthState['role']
      } else {
        // Fallback for older test accounts missing the role metadata
        role = 'ENGINEER'
      }

      set({
        user: session?.user ?? null,
        session: session ?? null,
        profile,
        role,
        loading: false,
        initialized: true,
      })

      // Set up auth state change listener
      authService.onAuthStateChange(async (user, session) => {
        if (user && session) {
          // User signed in, fetch profile
          const { profile: fetchedProfile } = await authService.getProfile(user.id)

          let newRole: AuthState['role'] = 'ENGINEER'
          if (fetchedProfile?.role) {
            newRole = fetchedProfile.role as AuthState['role']
          } else if (user.user_metadata?.role) {
            newRole = user.user_metadata.role as AuthState['role']
          }

          set({
            user,
            session,
            profile: fetchedProfile || null,
            role: newRole
          })
        } else {
          // User signed out
          set({
            user: null,
            session: null,
            profile: null,
          })
        }
      })
    } catch (err) {
      console.warn('Auth initialization error:', err)
      set({
        loading: false,
        initialized: true,
        error: err instanceof Error ? err.message : 'Initialization failed',
      })
    }
  },

  /**
   * Sign in with email and password
   */
  signIn: async (email: string, password: string) => {
    try {
      set({ loading: true, error: null })

      const { user, session, error } = await authService.signIn(email, password)

      if (error) {
        set({
          loading: false,
          error: error.message || 'Sign in failed',
        })
        return
      }

      // Fetch profile
      let profile: ProfileData | null = null
      let role: AuthState['role'] = 'ENGINEER'
      if (user) {
        const { profile: fetchedProfile } = await authService.getProfile(user.id)
        profile = fetchedProfile || null

        // Determine real role
        if (profile?.role) {
          role = profile.role as AuthState['role']
        } else if (user.user_metadata?.role) {
          role = user.user_metadata.role as AuthState['role']
        }
      }

      set({
        user: user ?? null,
        session: session ?? null,
        profile,
        role,
        loading: false,
        error: null,
      })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Sign in failed',
      })
    }
  },

  /**
   * Sign up with email, password, full name and role
   */
  signUp: async (email: string, password: string, fullName?: string, role?: string): Promise<boolean> => {
    try {
      set({ loading: true, error: null })

      const { user, session, error } = await authService.signUp(email, password, fullName, role)

      if (error) {
        set({
          loading: false,
          error: error.message || 'Sign up failed',
        })
        return false
      }

      // Fetch profile (will be auto-created by trigger)
      let profile: ProfileData | null = null
      if (user) {
        const { profile: fetchedProfile } = await authService.getProfile(user.id)
        profile = fetchedProfile || null
      }

      set({
        user: user ?? null,
        session: session ?? null,
        profile,
        loading: false,
        error: null,
      })
      return true
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Sign up failed',
      })
      return false
    }
  },

  /**
   * Sign out current user
   */
  signOut: async () => {
    try {
      set({ loading: true, error: null })

      const { error } = await authService.signOut()

      if (error) {
        set({
          loading: false,
          error: error.message || 'Sign out failed',
        })
        return
      }

      set({
        user: null,
        session: null,
        profile: null,
        role: null,
        loading: false,
        error: null,
      })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Sign out failed',
      })
    }
  },

  /**
   * Send password reset email
   */
  resetPassword: async (email: string): Promise<boolean> => {
    try {
      set({ loading: true, error: null })

      const { error } = await authService.resetPassword(email)

      if (error) {
        set({
          loading: false,
          error: error.message || 'Password reset failed',
        })
        return false
      }

      set({
        loading: false,
        error: null,
      })
      return true
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Password reset failed',
      })
      return false
    }
  },

  /**
   * Refresh profile data
   */
  refreshProfile: async () => {
    try {
      const { user } = get()
      if (!user) return

      const { profile, error } = await authService.getProfile(user.id)

      if (error) {
        console.warn('Failed to refresh profile:', error.message)
        return
      }

      set({ profile: profile || null })
    } catch (err) {
      console.warn('Profile refresh error:', err)
    }
  },

  /**
   * Clear error state
   */
  clearError: () => {
    set({ error: null })
  },
}))
