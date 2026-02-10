/**
 * useSession.ts
 * 
 * Convenience hook for accessing authentication state from authStore.
 * Uses individual selectors for optimal performance.
 */

import { useAuthStore } from '../store/authStore'

/**
 * useSession hook
 * Returns auth state and actions
 */
export function useSession() {
  const user = useAuthStore((state) => state.user)
  const session = useAuthStore((state) => state.session)
  const profile = useAuthStore((state) => state.profile)
  const loading = useAuthStore((state) => state.loading)
  const initialized = useAuthStore((state) => state.initialized)
  const error = useAuthStore((state) => state.error)
  const signIn = useAuthStore((state) => state.signIn)
  const signUp = useAuthStore((state) => state.signUp)
  const signOut = useAuthStore((state) => state.signOut)
  const resetPassword = useAuthStore((state) => state.resetPassword)
  const clearError = useAuthStore((state) => state.clearError)

  const isAuthenticated = !!user && !!session

  return {
    user,
    session,
    profile,
    loading,
    initialized,
    error,
    isAuthenticated,
    signIn,
    signUp,
    signOut,
    resetPassword,
    clearError,
  }
}
