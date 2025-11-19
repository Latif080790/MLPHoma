/**
 * App.tsx
 * Entry routing utama aplikasi. Menambahkan ErrorBoundary dan AppToaster tanpa mengubah struktur routing.
 */

import { HashRouter, Route, Routes } from 'react-router'
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

export default function App() {
  return (
    <HashRouter>
      {/* Global toaster untuk notifikasi */}
      <AppToaster />
      {/* Error boundary membungkus seluruh routing */}
      <ErrorBoundary>
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
      </ErrorBoundary>
    </HashRouter>
  )
}
