/**
 * Home.tsx
 * Landing page berisi hero, ringkasan singkat, dan Module Entrances (kartu-kartu navigasi).
 * - Memastikan beranda tidak kosong (Visible rule).
 * - Navigasi menggunakan anchor hash (href="#/...") agar sesuai HashRouter.
 */

import React, { useMemo } from 'react'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import KPICard from '../components/dashboard/KPICard'
import { useProjectStore } from '../store/projectStore'
import { useCurvaSStore } from '../store/curvaSStore'
import { useRabStore } from '../store/rabStore'
import { formatIDR } from '../lib/utils'
import {
  Boxes,
  CalendarDays,
  ClipboardList,
  FileBarChart2,
  Gauge,
  Layers,
  LineChart,
  NotebookText,
  Wallet,
  Wrench,
  Target,
  TrendingUp,
  AlertTriangle
} from 'lucide-react'

/**
 * ModuleLink
 * Kartu kecil untuk masuk ke modul tertentu.
 */
function ModuleLink(props: {
  href: string
  icon: React.ReactNode
  title: string
  description: string
  accent?: 'blue' | 'emerald' | 'violet' | 'amber' | 'rose' | 'slate'
}) {
  const accent =
    props.accent === 'emerald'
      ? 'border-emerald-200/70 hover:bg-emerald-50 dark:border-emerald-800/50 dark:hover:bg-emerald-900/30'
      : props.accent === 'violet'
        ? 'border-violet-200/70 hover:bg-violet-50 dark:border-violet-800/50 dark:hover:bg-violet-900/30'
        : props.accent === 'amber'
          ? 'border-amber-200/70 hover:bg-amber-50 dark:border-amber-800/50 dark:hover:bg-amber-900/30'
          : props.accent === 'rose'
            ? 'border-rose-200/70 hover:bg-rose-50 dark:border-rose-800/50 dark:hover:bg-rose-900/30'
            : props.accent === 'slate'
              ? 'border-slate-200/70 hover:bg-slate-50 dark:border-slate-800/50 dark:hover:bg-slate-900/30'
              : 'border-blue-200/70 hover:bg-blue-50 dark:border-blue-800/50 dark:hover:bg-blue-900/30'

  return (
    <a href={props.href} className="block">
      <Card className={`h-full transition-colors ${accent}`}>
        <CardContent className="flex h-full items-start gap-3 p-4">
          <div className="mt-0.5 text-neutral-700 dark:text-neutral-300">{props.icon}</div>
          <div className="space-y-1">
            <div className="font-medium">{props.title}</div>
            <div className="text-xs text-neutral-500">{props.description}</div>
          </div>
        </CardContent>
      </Card>
    </a>
  )
}

const EMPTY_ARRAY: any[] = []

/**
 * Home
 * Beranda aplikasi: hero + module entrances.
 */
export default function Home() {
  const activeProjectId = useProjectStore((s) => s.activeProjectId)
  const projects = useProjectStore((s) => s.projects)
  const activeProject = activeProjectId ? projects[activeProjectId] : null
  const projectId = activeProject?.id

  const analysis = useCurvaSStore((s) => (projectId ? s.getAnalysis(projectId) : null))
  // Use a stable empty array reference to prevent infinite loops if projectId is undefined
  const rabItems = useRabStore((s) => (projectId ? s.getItems(projectId) : EMPTY_ARRAY))

  const totalBudget = useMemo(() => {
    if (!activeProject) return 0
    // Calculate RAB total using same logic as RAB.tsx
    const rabTotal = rabItems.reduce((sum, item) => {
      const volume = item.volume || 0
      const unitPrice = item.unit_price || item.unitPrice || 0
      return sum + (volume * unitPrice)
    }, 0)
    // Add 11% tax like in RAB module
    const withTax = rabTotal * 1.11
    return withTax > 0 ? withTax : (activeProject.budget || 0)
  }, [activeProject, rabItems])

  return (
    <div className="space-y-6">
      {/* Hero section */}
      <div className="relative overflow-hidden rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-950">
        <div className="grid gap-0 md:grid-cols-2">
          <div className="p-6 md:p-8">
            <Badge className="mb-3 bg-blue-600 text-white hover:bg-blue-700">Construction Estimator Pro</Badge>
            <h1 className="text-xl font-semibold md:text-2xl">
              {activeProject ? `Project: ${activeProject.name}` : "Plan • Track • Optimize"}
            </h1>
            <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
              {activeProject
                ? "Pantau status proyek Anda secara real-time. Kelola RAB, jadwal, dan arus kas dalam satu tempat."
                : "Kelola RAB, jadwal, dan arus kas proyek secara terintegrasi. Mulai dengan membuat proyek baru atau pilih proyek aktif."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {!activeProject && (
                <a
                  href="#/projects"
                  className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                >
                  <ClipboardList size={16} /> Pilih Proyek
                </a>
              )}
              <a
                href="#/rap"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                title="Buka RAP Scheduler"
              >
                <CalendarDays size={16} /> Buka RAP
              </a>
              <a
                href="#/cashflow"
                className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                title="Buka Cash Flow"
              >
                <Wallet size={16} /> Cash Flow
              </a>
            </div>
          </div>
          <div className="relative">
            {/* Image: placeholder system */}
            <img src="https://pub-cdn.sider.ai/u/U0W8H7R4X2W/web-coder/690b315461d18d657615a7d2/resource/4c7ccad3-d201-4e12-a01c-cd66de6f3c2a.jpg" className="h-full w-full object-cover" />
          </div>
        </div>
      </div>

      {/* Dynamic KPIs */}
      <div className="mt-6 grid gap-3 md:grid-cols-3">
        {activeProject ? (
          <>
            <KPICard
              label="Total Budget (RAB)"
              value={formatIDR(totalBudget)}
              icon={<Wallet size={18} />}
              hint={`${rabItems.length} items defined`}
              accentClassName="text-blue-600"
            />
            <KPICard
              label="Schedule Performance (SPI)"
              value={analysis ? analysis.metrics.spi.toFixed(2) : "—"}
              icon={<Target size={18} />}
              hint={analysis ? analysis.status : "No analysis data"}
              accentClassName={analysis && analysis.metrics.spi < 0.9 ? "text-rose-600" : "text-emerald-600"}
            />
            <KPICard
              label="Cost Performance (CPI)"
              value={analysis ? analysis.metrics.cpi.toFixed(2) : "—"}
              icon={<TrendingUp size={18} />}
              hint={analysis ? `VAC: ${formatIDR(analysis.metrics.vac ?? 0)}` : "No analysis data"}
              accentClassName={analysis && analysis.metrics.cpi < 0.9 ? "text-rose-600" : "text-emerald-600"}
            />
          </>
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-neutral-500">Next step</div>
                <div className="mt-1 flex items-center gap-2">
                  <CalendarDays size={16} className="text-blue-600" />
                  <div className="text-sm">Pilih atau Buat Proyek Baru</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-neutral-500">Automation</div>
                <div className="mt-1 flex items-center gap-2">
                  <Gauge size={16} className="text-emerald-600" />
                  <div className="text-sm">Suggest No‑Deficit untuk Cash Flow</div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-neutral-500">Baseline</div>
                <div className="mt-1 flex items-center gap-2">
                  <NotebookText size={16} className="text-violet-600" />
                  <div className="text-sm">Lock Baseline di RAP sebelum simulasi</div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Module Entrances */}
      <div className="mt-6">
        <div className="mb-2 text-sm font-medium text-neutral-700 dark:text-neutral-200">Modules</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <ModuleLink
            href="#/projects"
            icon={<ClipboardList className="h-4 w-4 text-slate-600" />}
            title="Project Management"
            description="Kelola daftar proyek, status, dan ringkasannya."
            accent="slate"
          />
          <ModuleLink
            href="#/wbs"
            icon={<Layers className="h-4 w-4 text-emerald-600" />}
            title="WBS"
            description="Struktur pekerjaan project dan kode WBS."
            accent="emerald"
          />
          <ModuleLink
            href="#/ahsp"
            icon={<Wrench className="h-4 w-4 text-rose-600" />}
            title="AHSP Catalog"
            description="Analisis harga satuan dan komponen."
            accent="rose"
          />
          <ModuleLink
            href="#/rab"
            icon={<Boxes className="h-4 w-4 text-blue-600" />}
            title="RAB Builder"
            description="Kalkulasi biaya: volume × unit price + mark‑up."
            accent="blue"
          />
          <ModuleLink
            href="#/timeline"
            icon={<ClipboardList className="h-4 w-4 text-slate-600" />}
            title="Timeline / Gantt"
            description="Jadwal pekerjaan & dependencies (CPM)."
            accent="slate"
          />
          <ModuleLink
            href="#/rap"
            icon={<CalendarDays className="h-4 w-4 text-violet-600" />}
            title="RAP Scheduler"
            description="Distribusi anggaran bulanan + baseline."
            accent="violet"
          />
          <ModuleLink
            href="#/curvas"
            icon={<LineChart className="h-4 w-4 text-amber-600" />}
            title="Curva‑S"
            description="Planned vs Actual kumulatif."
            accent="amber"
          />
          <ModuleLink
            href="#/resource"
            icon={<Boxes className="h-4 w-4 text-emerald-600" />}
            title="Resource Planning"
            description="Histogram kebutuhan resource (proxy biaya)."
            accent="emerald"
          />
          <ModuleLink
            href="#/cashflow"
            icon={<Wallet className="h-4 w-4 text-blue-600" />}
            title="Cash Flow"
            description="Proyeksi arus kas dan skenario anti‑defisit."
            accent="blue"
          />
          <ModuleLink
            href="#/reports"
            icon={<FileBarChart2 className="h-4 w-4 text-violet-600" />}
            title="Reports"
            description="Export dan analitik proyek."
            accent="violet"
          />
        </div>
      </div>
    </div>
  )
}
