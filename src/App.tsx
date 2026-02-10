/**
 * App.tsx
 * Entry routing utama aplikasi. Menambahkan ErrorBoundary dan AppToaster tanpa mengubah struktur routing.
 */

import { HashRouter, Route, Routes } from 'react-router'
import { lazy, Suspense, useEffect } from 'react'
import HomePage from './pages/Home'
import ProjectManagement from './pages/modules/ProjectManagement'
import WBS from './pages/modules/WBS'
import AHSP from './pages/modules/AHSP'
import RAB from './pages/modules/RAB'
import Timeline from './pages/modules/Timeline'
import RAP from './pages/modules/RAP'
import CurvaS from './pages/modules/CurvaS'
import Resource from './pages/modules/Resource'
import CashFlow from './pages/modules/CashFlow'
import Progress from './pages/modules/Progress'
import Reports from './pages/modules/Reports'
import NotFound from './pages/NotFound'

import { ErrorBoundary } from './components/common/ErrorBoundary'
import AppToaster from './components/common/Notifications'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { useAuthStore } from './store/authStore'
import { PageSkeleton } from './components/common/PageSkeleton'

// Lazy load auth pages
const Login = lazy(() => import('./pages/auth/Login'))
const Register = lazy(() => import('./pages/auth/Register'))
const ForgotPassword = lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazy(() => import('./pages/auth/ResetPassword'))

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
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <HomePage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedRoute>
                  <ProjectManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/wbs"
              element={
                <ProtectedRoute>
                  <WBS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ahsp"
              element={
                <ProtectedRoute>
                  <AHSP />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rab"
              element={
                <ProtectedRoute>
                  <RAB />
                </ProtectedRoute>
              }
            />
            <Route
              path="/timeline"
              element={
                <ProtectedRoute>
                  <Timeline />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rap"
              element={
                <ProtectedRoute>
                  <RAP />
                </ProtectedRoute>
              }
            />
            <Route
              path="/curvas"
              element={
                <ProtectedRoute>
                  <CurvaS />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resource"
              element={
                <ProtectedRoute>
                  <Resource />
                </ProtectedRoute>
              }
            />
            <Route
              path="/cashflow"
              element={
                <ProtectedRoute>
                  <CashFlow />
                </ProtectedRoute>
              }
            />
            <Route
              path="/progress"
              element={
                <ProtectedRoute>
                  <Progress />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reports"
              element={
                <ProtectedRoute>
                  <Reports />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  )
}
