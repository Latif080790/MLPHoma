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
import { AppShell } from './components/layout/AppShell'
import { useAuthStore } from './store/authStore'
import { useProjectStore } from './store/projectStore'

// Lazy-loaded page components for optimal code splitting
const ProjectManagement = React.lazy(() => import('./pages/modules/ProjectManagement'))

// v3 Ultra Modules
const CommandCenter = React.lazy(() => import('./pages/modules/v3/CommandCenter'))
const ProjectCosting = React.lazy(() => import('./pages/modules/v3/ProjectCosting'))
const ScheduleOps = React.lazy(() => import('./pages/modules/v3/ScheduleOps'))
const SupplyChain = React.lazy(() => import('./pages/modules/v3/SupplyChain'))
const Finance = React.lazy(() => import('./pages/modules/v3/Finance'))
const ChangeManagement = React.lazy(() => import('./pages/modules/v3/ChangeManagement'))
const Documents = React.lazy(() => import('./pages/modules/v3/Documents'))
const Settings = React.lazy(() => import('./pages/modules/v3/Settings'))
const HandoverWizard = React.lazy(() => import('./pages/modules/v3/HandoverWizard'))
const TKDNPage = React.lazy(() => import('./pages/TKDNPage'))

// Legacy Modules (Keep for reference if needed, but routes will be replaced)
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

/**
 * ProtectedLayout
 * Wraps authenticated pages with AppShell (sidebar + header).
 */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const projects = useProjectStore((s) => s.projects)
  const activeProject = activeProjectId ? projects[activeProjectId] : null

  return (
    <ProtectedRoute>
      <AppShell projectName={activeProject?.name}>
        {children}
      </AppShell>
    </ProtectedRoute>
  )
}

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

            {/* Protected routes — all wrapped with sidebar layout */}
            <Route path="/" element={<ProtectedLayout><CommandCenter /></ProtectedLayout>} />
            <Route path="/projects" element={<ProtectedLayout><ProjectManagement /></ProtectedLayout>} />

            {/* v3 Ultra Routes */}
            <Route path="/costing" element={<ProtectedLayout><ProjectCosting /></ProtectedLayout>} />
            <Route path="/schedule" element={<ProtectedLayout><ScheduleOps /></ProtectedLayout>} />
            <Route path="/supply-chain" element={<ProtectedLayout><SupplyChain /></ProtectedLayout>} />
            <Route path="/finance" element={<ProtectedLayout><Finance /></ProtectedLayout>} />
            <Route path="/change-management" element={<ProtectedLayout><ChangeManagement /></ProtectedLayout>} />
            <Route path="/documents" element={<ProtectedLayout><Documents /></ProtectedLayout>} />
            <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
            <Route path="/handover" element={<ProtectedLayout><HandoverWizard /></ProtectedLayout>} />
            <Route path="/tkdn" element={<ProtectedLayout><TKDNPage /></ProtectedLayout>} />

            {/* Legacy Routes (redirect or keep active for direct access if needed) */}
            <Route path="/wbs" element={<ProtectedLayout><WBS /></ProtectedLayout>} />
            <Route path="/ahsp" element={<ProtectedLayout><AHSP /></ProtectedLayout>} />
            <Route path="/rab" element={<ProtectedLayout><RAB /></ProtectedLayout>} />
            <Route path="/timeline" element={<ProtectedLayout><Timeline /></ProtectedLayout>} />
            <Route path="/rap" element={<ProtectedLayout><RAP /></ProtectedLayout>} />
            <Route path="/curvas" element={<ProtectedLayout><CurvaS /></ProtectedLayout>} />
            <Route path="/resource" element={<ProtectedLayout><Resource /></ProtectedLayout>} />
            <Route path="/cashflow" element={<ProtectedLayout><CashFlow /></ProtectedLayout>} />
            <Route path="/progress" element={<ProtectedLayout><Progress /></ProtectedLayout>} />
            <Route path="/reports" element={<ProtectedLayout><Reports /></ProtectedLayout>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  )
}
