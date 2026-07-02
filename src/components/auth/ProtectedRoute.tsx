/**
 * ProtectedRoute.tsx
 * 
 * Route protection component that ensures users are authenticated.
 * Shows loading skeleton while auth is initializing.
 * Redirects to login page if user is not authenticated.
 * Optionally supports role-based access control.
 */

import React from 'react'
import { Navigate, useLocation } from 'react-router'
import { useSession } from '../../hooks/useSession'
import { supabase } from '../../lib/supabaseClient'
import { PageSkeleton } from '../common/PageSkeleton'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRoles?: string[]
}

/**
 * ProtectedRoute component
 * Wraps routes that require authentication
 */
export function ProtectedRoute({ children, requiredRoles }: ProtectedRouteProps) {
  const { isAuthenticated, loading, initialized, profile } = useSession()
  const location = useLocation()

  // Show loading skeleton while auth is initializing or loading
  if (!initialized || loading) {
    return <PageSkeleton />
  }

  // If Supabase is not configured: allow access only in dev builds.
  // Production builds fail closed — a missing/misread env must never
  // expose protected pages without authentication.
  if (!supabase) {
    if (import.meta.env.DEV) {
      return <>{children}</>
    }
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <h1 className="text-lg font-semibold text-foreground">Konfigurasi aplikasi tidak lengkap</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Koneksi ke server autentikasi tidak tersedia (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
          tidak terbaca). Demi keamanan, akses ditolak. Hubungi administrator.
        </p>
      </div>
    )
  }

  // If auth is initialized but user is not authenticated, redirect to login
  // Pass current location in state so we can redirect back after login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role-based access if required
  if (requiredRoles && requiredRoles.length > 0) {
    if (!profile) {
      // Profile not loaded yet or failed to load, keep showing loading
      return <PageSkeleton />
    }
    const userRole = profile.role || 'user'
    if (!requiredRoles.includes(userRole)) {
      // User doesn't have required role, redirect to home
      return <Navigate to="/" replace />
    }
  }

  // User is authenticated and has required role, render children
  return <>{children}</>
}
