/**
 * CashFlow.tsx
 *
 * Halaman Cash Flow — penyaluran kas proyek, compare & what‑if.
 *
 * Catatan:
 * - File ini sengaja hanya berisi satu default export untuk mencegah error
 *   "Multiple exports with the same name 'default'".
 * - Semua tombol dengan variant="outline" diberi className="bg-transparent".
 */

import React, { useCallback, useRef, useState, useMemo } from 'react'
import { PlusSquare, Download, RefreshCw } from 'lucide-react'
import { ModuleHeader } from '../../components/modules/ModuleHeader'
import { Button } from '../../components/ui/button'
import { useProjectStore } from '../../store/projectStore'
import { useProjectStore } from '../../store/projectStore'
import { useRapStore } from '../../store/rapStore'
import { useCurvaSStore } from '../../store/curvaSStore'
import { useFinanceStore } from '../../store/financeStore'
import { downloadCSV } from '../../lib/utils'
import { EmptyState } from '../../components/common/EmptyState'
import SummaryCard from '../../components/cashflow/SummaryCard'
import CompareControls from '../../components/cashflow/CompareControls'
import WhatIfPanel from '../../components/cashflow/WhatIfPanel'
import CashChart from '../../components/cashflow/CashChart'
import PeriodTable from '../../components/cashflow/PeriodTable'
import { calculateCashFlow } from '../../lib/cashflowCalculator'

const EMPTY_ARRAY: any[] = []

/**
 * CashFlow
 *
 * Komponen halaman utama Cash Flow.
 *
 * - Semua aksi yang mengubah store hanya dijalankan secara eksplisit oleh user.
 * - Akses ke store dilakukan secara defensif untuk menghindari subscribe yang tidak perlu.
 *
 * @returns JSX.Element
 */
export default function CashFlow(): JSX.Element {
  /**
   * Ambil proyek aktif secara defensif.
   * Menggunakan selector langsung ke state untuk menghindari pemanggilan fungsi getter yang mungkin tidak stabil.
   */
  const activeProject = useProjectStore((s) => s.activeProjectId ? s.projects[s.activeProjectId] : null)
  const projectId = activeProject?.id ?? ''
  const projectName = activeProject?.name ?? '-'
  const projectBudget = activeProject?.budget ?? 0
  const paymentTerms = activeProject?.paymentTerms || {}

  /**
   * Selector/store helpers yang hanya mengambil referensi fungsi (tidak subscribe data besar).
   */
  const getRapPlan = useRapStore((s) => s.getPlan)
  const setPlannedFromRap = useCurvaSStore((s) => s.setPlannedFromRap)
  const analyzeCurva = useCurvaSStore((s) => s.analyzeProject)

  // Subscribe to data points for calculation
  const points = useCurvaSStore((s) => (projectId ? s.getDataPoints(projectId) : EMPTY_ARRAY))

  // Predictability Enhancement: Pull actual AP/AR commitments
  const fetchInvoices = useFinanceStore((s) => s.fetchInvoices)
  const fetchClaims = useFinanceStore((s) => s.fetchClaims)
  const invoices = useFinanceStore((s) => s.invoices)
  const claims = useFinanceStore((s) => s.claims)

  React.useEffect(() => {
    if (projectId) {
      fetchInvoices(projectId)
      fetchClaims(projectId)
    }
  }, [projectId, fetchInvoices, fetchClaims])

  /**
   * Baca saved scenarios untuk menampilkan empty state jika kosong.
   * Operasi ini di-wrap dengan try/catch agar aman bila fungsi tidak tersedia.
   */
  const savedScenarios = useCurvaSStore((s) => {
    try {
      return typeof s.getSavedScenarios === 'function' ? s.getSavedScenarios(projectId) : EMPTY_ARRAY
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('CashFlow: failed to read saved scenarios', e)
      return EMPTY_ARRAY
    }
  })

  // Calculate cashflow rows
  const rows = useMemo(() => {
    return calculateCashFlow(points, paymentTerms, projectBudget, invoices, claims)
  }, [points, paymentTerms, projectBudget, invoices, claims])

  // Calculate summary totals
  const summary = useMemo(() => {
    if (!rows.length) return { totalOutflow: 0, totalInflow: 0, endingBalance: 0, minBalance: 0, hasDeficit: false }
    const last = rows[rows.length - 1]
    const minBalance = Math.min(...rows.map(r => r.balance))
    const hasDeficit = rows.some(r => r.balance < 0)
    return {
      totalOutflow: last.cumOutflow,
      totalInflow: last.cumInflow,
      endingBalance: last.balance,
      minBalance,
      hasDeficit
    }
  }, [rows])

  // UI local state
  const [dense, setDense] = useState<boolean>(false)

  /**
   * Guard untuk menghindari re-entrant import yang menyebabkan churn state.
   */
  const importingRef = useRef<boolean>(false)

  /**
   * handleImportFromRAP
   *
   * Mengimpor RAP ke Curva-S store. Operasi ini dipicu oleh user dan
   * men-schedule analisis pada tick berikutnya untuk menghindari update-loop.
   */
  const handleImportFromRAP = useCallback(() => {
    if (!projectId) return
    if (importingRef.current) return
    importingRef.current = true

    try {
      const rapPlan = typeof getRapPlan === 'function' ? getRapPlan(projectId) : []
      if (!rapPlan || (Array.isArray(rapPlan) && rapPlan.length === 0)) {
        importingRef.current = false
        return
      }

      const fallbackBudget = Array.isArray(rapPlan) ? (rapPlan as any[]).reduce((s, p) => s + (p.planned || 0), 0) : 0
      setPlannedFromRap(projectId, rapPlan as any, projectBudget || fallbackBudget)

      // Jalankan analisis pada tick berikutnya agar state settle dulu
      setTimeout(() => {
        try {
          analyzeCurva(projectId)
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('Curva analysis failed', e)
        } finally {
          importingRef.current = false
        }
      }, 0)
    } catch (err) {
      importingRef.current = false
      // eslint-disable-next-line no-console
      console.error('Import RAP failed', err)
    }
  }, [projectId, getRapPlan, setPlannedFromRap, analyzeCurva, projectBudget])

  /**
   * handleGenerateBaseline
   *
   * Membuat baseline sederhana (hari ini -> +6 bulan) dan memicu analisis.
   */
  const handleGenerateBaseline = useCallback(() => {
    if (!projectId) return
    const start = new Date()
    const end = new Date()
    end.setMonth(end.getMonth() + 6)

    // Gunakan getState() untuk menghindari subscription di komponen
    useCurvaSStore.getState().generateBaseline(
      projectId,
      projectBudget || 0,
      start.toISOString().split('T')[0],
      end.toISOString().split('T')[0]
    )

    setTimeout(() => {
      try {
        analyzeCurva(projectId)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.warn('Analyze failed after baseline generation', e)
      }
    }, 0)
  }, [projectId, projectBudget, analyzeCurva])

  /**
   * handleExportCSV
   *
   * Mengekspor data Curva-S saat ini ke CSV. Membaca data langsung dari store.getState()
   * agar tidak membuat subscription tambahan.
   */
  const handleExportCSV = useCallback(() => {
    if (!projectId) return
    const points = useCurvaSStore.getState().getDataPoints(projectId) || []
    if (!points || points.length === 0) return

    const rows = points.map((p: any) => ({
      date: p.date,
      plannedCost: p.plannedCost ?? 0,
      actualCost: p.actualCost ?? 0,
      plannedProgress: p.plannedProgress ?? 0,
      actualProgress: p.actualProgress ?? 0,
    }))

    downloadCSV(rows, `cashflow-${projectId}`)
  }, [projectId])

  // Jika tidak ada project terpilih, tampilkan pesan instruktif
  if (!projectId) {
    return (
      <div className="space-y-6">
        <ModuleHeader title="Cash Flow" description="Cash Flow projection and simulation" />
        <div className="rounded-xl border p-6 text-center dark:border-neutral-800">
          <p className="text-neutral-600 dark:text-neutral-300">Please select a project to view Cash Flow.</p>
        </div>
      </div>
    )
  }

  // Render halaman utama Cash Flow
  return (
    <div className="space-y-6">
      <ModuleHeader
        title="Cash Flow"
        description="Time-phased cashflow, scenario compare and what-if simulator."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="bg-transparent" onClick={() => setDense((v) => !v)}>
              <PlusSquare className="mr-2" />
              {dense ? 'Dense: ON' : 'Dense: OFF'}
            </Button>

            <Button variant="outline" size="sm" className="bg-transparent" onClick={handleImportFromRAP}>
              <Download className="mr-2" />
              Import from RAP
            </Button>

            <Button variant="outline" size="sm" className="bg-transparent" onClick={handleGenerateBaseline}>
              <RefreshCw className="mr-2" />
              Generate Baseline
            </Button>

            <Button size="sm" onClick={handleExportCSV}>
              Export CSV
            </Button>
          </div>
        }
      />

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <SummaryCard
          totalOutflow={summary.totalOutflow}
          totalInflow={summary.totalInflow}
          endingBalance={summary.endingBalance}
          minBalance={summary.minBalance}
          hasDeficit={summary.hasDeficit}
        />
        <div className="md:col-span-2">
          {Array.isArray(savedScenarios) && savedScenarios.length === 0 ? (
            <div className="rounded-xl border p-4 dark:border-neutral-800">
              <EmptyState
                title="No saved scenarios"
                description="You don't have any saved cashflow scenarios for this project yet. Use the What‑If panel to create scenarios and save them for comparison."
              />
            </div>
          ) : null}

          <CompareControls projectId={projectId} />
        </div>
      </div>

      <div className="mt-6 grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <CashChart rows={rows} />
          <PeriodTable rows={rows} />
        </div>

        <div>
          <WhatIfPanel projectId={projectId} projectBudget={projectBudget} />
        </div>
      </div>
    </div>
  )
}