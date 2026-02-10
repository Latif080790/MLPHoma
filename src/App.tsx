/**
 * App.tsx
 * Entry routing utama aplikasi dengan code splitting menggunakan React.lazy.
 * Menambahkan ErrorBoundary, AppToaster, dan Suspense untuk lazy loading.
 */

import React, { Suspense } from 'react'
import { HashRouter, Route, Routes } from 'react-router'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import AppToaster from './components/common/Notifications'
import { PageSkeleton } from './components/common/PageSkeleton'

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

export default function App() {
  return (
    <HashRouter>
      {/* Global toaster untuk notifikasi */}
      <AppToaster />
      {/* Error boundary membungkus seluruh routing */}
      <ErrorBoundary>
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/projects" element={<ProjectManagement />} />
            <Route path="/wbs" element={<WBS />} />
            <Route path="/ahsp" element={<AHSP />} />
            <Route path="/rab" element={<RAB />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/rap" element={<RAP />} />
            <Route path="/curvas" element={<CurvaS />} />
            <Route path="/resource" element={<Resource />} />
            <Route path="/cashflow" element={<CashFlow />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </HashRouter>
  )
}
