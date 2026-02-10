/**
 * App.tsx
 * Entry routing utama aplikasi dengan code splitting menggunakan React.lazy.
 * Menambahkan ErrorBoundary, AppToaster, Suspense, dan Authentication.
 */

import React, { Suspense, useEffect } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import AppToaster from './components/common/Notifications'
import { PageSkeleton } from './components/common/PageSkeleton'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { useAuthStore } from './store/authStore'

// Lazy-loaded page components for optimal code splitting
const HomePage = React.lazy(() => import('./pages/Home'))
const ProjectManagement = React.lazy(() => import('./pages/modules/ProjectManagement'))
const WBS = React.lazy(() => import('./pages/modules/WBS'))
const AHSP = React.lazy(() => import('./pages/modules/AHSP'))
const RAB = React.lazy(() => import('./pages/modules/RAB'))
const Timeline = React.lazy(() => import('./pages/modules/Timeline'))
const RAP = React.lazy(() => import('./pages/modules/RAP'))
const CurvaS = React.lazy(() => import('./pages/modules/CurvaS'))
const Resource = React.lazy(() => import('./pages/modules/Resource'))
const CashFlow = React.lazy(() => import('./pages/modules/CashFlow'))
const Progress = React.lazy(() => import('./pages/modules/Progress'))
const Reports = React.lazy(() => import('./pages/modules/Reports'))
const NotFound = React.lazy(() => import('./pages/NotFound'))

// Lazy-loaded auth pages
const Login = React.lazy(() => import('./pages/auth/Login'))
const Register = React.lazy(() => import('./pages/auth/Register'))
const ForgotPassword = React.lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = React.lazy(() => import('./pages/auth/ResetPassword'))

export default function App() {
  const initialize = useAuthStore((state) => state.initialize)

  // Initialize auth on app mount
  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <HashRouter>
      {/* Global toaster untuk notifikasi */}
      <AppToaster />
      {/* Error boundary membungkus seluruh routing */}
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {/* Public auth routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><HomePage /></ProtectedRoute>} />
            <Route path="/projects" element={<ProtectedRoute><ProjectManagement /></ProtectedRoute>} />
            <Route path="/wbs" element={<ProtectedRoute><WBS /></ProtectedRoute>} />
            <Route path="/ahsp" element={<ProtectedRoute><AHSP /></ProtectedRoute>} />
            <Route path="/rab" element={<ProtectedRoute><RAB /></ProtectedRoute>} />
            <Route path="/timeline" element={<ProtectedRoute><Timeline /></ProtectedRoute>} />
            <Route path="/rap" element={<ProtectedRoute><RAP /></ProtectedRoute>} />
            <Route path="/curvas" element={<ProtectedRoute><CurvaS /></ProtectedRoute>} />
            <Route path="/resource" element={<ProtectedRoute><Resource /></ProtectedRoute>} />
            <Route path="/cashflow" element={<ProtectedRoute><CashFlow /></ProtectedRoute>} />
            <Route path="/progress" element={<ProtectedRoute><Progress /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  )
}
