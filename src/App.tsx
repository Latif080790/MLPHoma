/**
 * App.tsx
 * Entry routing utama aplikasi dengan code splitting menggunakan React.lazy.
 * Menambahkan ErrorBoundary, AppToaster, Suspense, dan Authentication.
 */

import React, { Suspense, useEffect } from 'react'
import { BrowserRouter, Route, Routes, useLocation } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AnimatePresence, motion } from 'motion/react'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import AppToaster from './components/common/Notifications'
import { PageSkeleton } from './components/common/PageSkeleton'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { AppShell } from './components/layout/AppShell'
import { useAuthStore } from './store/authStore'
import { useProjectStore } from './store/projectStore'
import { NetworkProvider } from './providers/NetworkProvider'
import { getProtectedRouteItems, type NavComponentKey } from './config/navRegistry'
import { lazyRetry } from './lib/lazyRetry'
import { initStoreSubscriptions } from './lib/storeSubscriptions'
import { KeyboardShortcutsPanel } from './components/common/KeyboardShortcutsPanel'

// Lazy-loaded page components with auto-retry for stale chunk recovery
const ProjectManagement = lazyRetry(() => import('./pages/modules/ProjectManagement'))

// v3 Ultra Modules
const CommandCenter = lazyRetry(() => import('./pages/modules/v3/CommandCenter'))
const ProjectCosting = lazyRetry(() => import('@/pages/modules/v3/ProjectCosting'))
const ScheduleOps = lazyRetry(() => import('./pages/modules/v3/ScheduleOps'))
const SupplyChain = lazyRetry(() => import('./pages/modules/v3/SupplyChain'))
const Finance = lazyRetry(() => import('./pages/modules/v3/Finance'))
const ChangeManagement = lazyRetry(() => import('./pages/modules/v3/ChangeManagement'))
const Documents = lazyRetry(() => import('./pages/modules/v3/Documents'))
const Settings = lazyRetry(() => import('./pages/modules/v3/Settings'))
const HandoverWizard = lazyRetry(() => import('./pages/modules/v3/HandoverWizard'))
const ProjectOverview = lazyRetry(() => import('./pages/modules/v3/ProjectOverview'))
const CostForecastDashboard = lazyRetry(() => import('./pages/modules/v3/CostForecastDashboard'))
const PortfolioResources = lazyRetry(() => import('./pages/modules/v3/PortfolioResources'))
const PortfolioAnalytics = lazyRetry(() => import('./pages/modules/v3/PortfolioAnalytics'))
const StrategySimulation = lazyRetry(() => import('./pages/modules/v3/StrategySimulation'))
const TKDNPage = lazyRetry(() => import('./pages/TKDNPage'))
const FeatureEditor = lazyRetry(() => import('./components/feature/FeatureEditor'))
const GlobalCommandPalette = lazyRetry(() => import('./components/common/GlobalCommandPalette'))
const FieldTasks = lazyRetry(() => import('./pages/mobile/FieldTasks'))
const Maintenance = lazyRetry(() => import('./pages/modules/v3/Maintenance'))
const QHSE = lazyRetry(() => import('./pages/modules/v3/QHSE'))

// Legacy Modules
const NotFound = lazyRetry(() => import('./pages/NotFound'))

// Lazy-loaded auth pages
const Login = lazyRetry(() => import('./pages/auth/Login'))
const Register = lazyRetry(() => import('./pages/auth/Register'))
const ForgotPassword = lazyRetry(() => import('./pages/auth/ForgotPassword'))
const ResetPassword = lazyRetry(() => import('./pages/auth/ResetPassword'))

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
  FieldTasks,
  Maintenance,
  QHSE,
}

/**
 * ProtectedLayout
 * Wraps authenticated pages with AppShell (sidebar + header).
 */
function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const projects = useProjectStore((s) => s.projects)
  const activeProject = activeProjectId ? projects[activeProjectId] : null
  const location = useLocation()

  return (
    <ProtectedRoute>
      <AppShell projectName={activeProject?.name}>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.2, 0, 0, 1] }}
            className="flex-1 flex flex-col min-h-0 w-full"
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </AppShell>
    </ProtectedRoute>
  )
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,       // 30s — KPI data is stale after 30s
      gcTime: 5 * 60_000,      // 5min garbage collection
      retry: 2,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  const initialize = useAuthStore((state) => state.initialize)
  const protectedRoutes = React.useMemo(() => getProtectedRouteItems(), [])

  // Initialize auth and store subscriptions on app mount
  useEffect(() => {
    initialize()
    initStoreSubscriptions()
  }, [initialize])

  // v4 Sprint 3 — Item 18: Context-aware global keyboard shortcuts
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Ignore when typing in inputs
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return

      // Ctrl+N — context-aware "New item" based on current route
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 'n') {
        e.preventDefault()
        const route = window.location.pathname
        // Emit a synthetic new-item event modules can listen to
        const evt = new CustomEvent('app:new-item', { detail: { route } })
        window.dispatchEvent(evt)
      }

      // Ctrl+S — trigger form save
      if (e.ctrlKey && !e.shiftKey && !e.altKey && e.key === 's') {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent('app:save'))
      }

      // G+H, G+P, G+S, G+F — navigate
      // (handled by GlobalCommandPalette / existing nav)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <QueryClientProvider client={queryClient}>
    <BrowserRouter>
      <NetworkProvider>
        {/* Global toaster untuk notifikasi */}
        <AppToaster />
        {/* P1.2.2: Global Cmd+K command palette */}
        <Suspense fallback={null}>
          <GlobalCommandPalette />
        </Suspense>
        {/* Keyboard shortcuts overlay (Shift+?) */}
        <KeyboardShortcutsPanel />
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
    </BrowserRouter>
    </QueryClientProvider>
  )
}
