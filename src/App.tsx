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
import { NetworkProvider } from './providers/NetworkProvider'

// Lazy-loaded page components for optimal code splitting
const ProjectManagement = React.lazy(() => import('./pages/modules/ProjectManagement'))

// v3 Ultra Modules
const CommandCenter = React.lazy(() => import('./pages/modules/v3/CommandCenter'))
const ProjectCosting = React.lazy(() => import('@/pages/modules/v3/ProjectCosting'))
const ScheduleOps = React.lazy(() => import('./pages/modules/v3/ScheduleOps'))
const SupplyChain = React.lazy(() => import('./pages/modules/v3/SupplyChain'))
const Finance = React.lazy(() => import('./pages/modules/v3/Finance'))
const ChangeManagement = React.lazy(() => import('./pages/modules/v3/ChangeManagement'))
const Documents = React.lazy(() => import('./pages/modules/v3/Documents'))
const Settings = React.lazy(() => import('./pages/modules/v3/Settings'))
const HandoverWizard = React.lazy(() => import('./pages/modules/v3/HandoverWizard'))
const ProjectOverview = React.lazy(() => import('./pages/modules/v3/ProjectOverview'))
const CostForecastDashboard = React.lazy(() => import('./pages/modules/v3/CostForecastDashboard'))
const PortfolioResources = React.lazy(() => import('./pages/modules/v3/PortfolioResources'))
const StrategySimulation = React.lazy(() => import('./pages/modules/v3/StrategySimulation'))
const TKDNPage = React.lazy(() => import('./pages/TKDNPage'))
const FeatureEditor = React.lazy(() => import('./components/feature/FeatureEditor'))

// Legacy Modules (Keep for reference if needed, but routes will be replaced)
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
      <NetworkProvider>
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
              <Route path="/project-overview" element={<ProtectedLayout><ProjectOverview /></ProtectedLayout>} />

              {/* v3 Ultra Routes */}
              <Route path="/costing" element={<ProtectedLayout><ProjectCosting /></ProtectedLayout>} />
              <Route path="/cost-forecast" element={<ProtectedLayout><CostForecastDashboard /></ProtectedLayout>} />
              <Route path="/schedule" element={<ProtectedLayout><ScheduleOps /></ProtectedLayout>} />
              <Route path="/supply-chain" element={<ProtectedLayout><SupplyChain /></ProtectedLayout>} />
              <Route path="/finance" element={<ProtectedLayout><Finance /></ProtectedLayout>} />
              <Route path="/change-management" element={<ProtectedLayout><ChangeManagement /></ProtectedLayout>} />
              <Route path="/documents" element={<ProtectedLayout><Documents /></ProtectedLayout>} />
              <Route path="/settings" element={<ProtectedLayout><Settings /></ProtectedLayout>} />
              <Route path="/handover" element={<ProtectedLayout><HandoverWizard /></ProtectedLayout>} />
              <Route path="/portfolio-resources" element={<ProtectedLayout><PortfolioResources /></ProtectedLayout>} />
              <Route path="/strategy-simulation" element={<ProtectedLayout><StrategySimulation /></ProtectedLayout>} />
              <Route path="/tkdn" element={<ProtectedLayout><TKDNPage /></ProtectedLayout>} />
              <Route path="/features" element={<ProtectedLayout><FeatureEditor /></ProtectedLayout>} />

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </NetworkProvider>
    </HashRouter>
  )
}
