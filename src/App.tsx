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
import { getProtectedRouteItems, type NavComponentKey } from './config/navRegistry'

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
const PortfolioAnalytics = React.lazy(() => import('./pages/modules/v3/PortfolioAnalytics'))
const StrategySimulation = React.lazy(() => import('./pages/modules/v3/StrategySimulation'))
const TKDNPage = React.lazy(() => import('./pages/TKDNPage'))
const FeatureEditor = React.lazy(() => import('./components/feature/FeatureEditor'))
const GlobalCommandPalette = React.lazy(() => import('./components/common/GlobalCommandPalette'))

// Legacy Modules (Keep for reference if needed, but routes will be replaced)
const NotFound = React.lazy(() => import('./pages/NotFound'))


// Lazy-loaded auth pages
const Login = React.lazy(() => import('./pages/auth/Login'))
const Register = React.lazy(() => import('./pages/auth/Register'))
const ForgotPassword = React.lazy(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = React.lazy(() => import('./pages/auth/ResetPassword'))

const PROTECTED_COMPONENT_MAP: Record<NavComponentKey, React.LazyExoticComponent<React.ComponentType>> = {
  CommandCenter,
  ProjectManagement,
  ProjectOverview,
  ProjectCosting,
  CostForecastDashboard,
  ScheduleOps,
  SupplyChain,
  Finance,
  ChangeManagement,
  Documents,
  HandoverWizard,
  PortfolioResources,
  PortfolioAnalytics,
  StrategySimulation,
  TKDNPage,
  FeatureEditor,
  Settings,
}

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
  const protectedRoutes = React.useMemo(() => getProtectedRouteItems(), [])

  // Initialize auth on app mount
  useEffect(() => {
    initialize()
  }, [initialize])

  return (
    <HashRouter>
      <NetworkProvider>
        {/* Global toaster untuk notifikasi */}
        <AppToaster />
        {/* P1.2.2: Global Cmd+K command palette */}
        <Suspense fallback={null}>
          <GlobalCommandPalette />
        </Suspense>
        {/* Error boundary membungkus seluruh routing */}
        <ErrorBoundary>
          <Suspense fallback={<PageSkeleton />}>
            <Routes>
              {/* Public auth routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Protected routes — generated from NAV_REGISTRY */}
              {protectedRoutes.map((item) => {
                const Component = PROTECTED_COMPONENT_MAP[item.componentKey!]
                return (
                  <Route
                    key={item.id}
                    path={item.path}
                    element={<ProtectedLayout><Component /></ProtectedLayout>}
                  />
                )
              })}

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </NetworkProvider>
    </HashRouter>
  )
}
