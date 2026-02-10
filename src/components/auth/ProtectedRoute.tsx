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
  const { isAuthenticated, loading, initialized, profile, error } = useSession()
  const location = useLocation()

  // Show loading skeleton while auth is initializing or loading
  if (!initialized || loading) {
    return <PageSkeleton />
  }

  // Fail-open approach: If auth initialization failed or Supabase not configured,
  // allow access for development purposes
  // Check if supabase is not configured by attempting to import it
  const { supabase } = require('../../lib/supabaseClient')
  if (!supabase) {
    // Supabase not configured, allow access (dev mode)
    return <>{children}</>
  }

  // If auth is initialized but user is not authenticated, redirect to login
  // Pass current location in state so we can redirect back after login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role-based access if required
  if (requiredRoles && requiredRoles.length > 0 && profile) {
    const userRole = profile.role || 'user'
    if (!requiredRoles.includes(userRole)) {
      // User doesn't have required role, redirect to home
      return <Navigate to="/" replace />
    }
  }

  // User is authenticated and has required role, render children
  return <>{children}</>
}
