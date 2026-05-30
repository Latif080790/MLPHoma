/**
 * WhatIfPanel.tsx
 *
 * Container & UI for the Cash Flow What‑If simulator.
 *
 * - Connects to Curva-S store to save scenarios (addSavedScenario)
 * - Provides sliders for Down Payment, Billing (%) and Retention (%)
 * - Allows saving scenarios tied to a projectId
 *
 * Notes:
 * - This file is a single-responsibility component: read/store interaction + lightweight UI.
 */

import React, { useMemo, useState } from 'react'
import useCurvaSStore, { SavedScenario } from '../../store/curvaSStore'
import useProjectStore from '../../store/projectStore'
import notify from '../../lib/toast'
import { downloadCSV } from '../../lib/utils'

/**
 * WhatIfPanelProps
 * Props for the WhatIfPanel component.
 */
export interface WhatIfPanelProps {
  /** Current project id used to store scenarios */
  projectId: string
  /** Optional project budget used for scenario exports / calculations */
  projectBudget?: number
}

/**
 * generateId
 *
 * Small id generator used for saved scenarios (no external deps).
 *
 * @returns string unique-ish id
 */
function generateId(): string {
  return `scn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/**
 * WhatIfPanel
 *
 * Container component that allows user to tweak payment-related sliders,
 * save a scenario to the Curva-S store, apply settings (no-op placeholder),
 * and export a CSV representation of the project's curva-s data.
 *
 * @param props WhatIfPanelProps
 * @returns JSX.Element
 */
export const WhatIfPanel: React.FC<WhatIfPanelProps> = ({ projectId, projectBudget }) => {
  const addSavedScenario = useCurvaSStore((s) => s.addSavedScenario)
  const getDataPoints = useCurvaSStore((s) => (typeof s.getDataPoints === 'function' ? s.getDataPoints : () => []))
  const setPaymentTerms = useProjectStore((s) => s.setPaymentTerms)

  const [whatIfDpPct, setWhatIfDpPct] = useState<number>(10)
  const [whatIfBillingPct, setWhatIfBillingPct] = useState<number>(30)
  const [retentionRate, setRetentionRate] = useState<number>(0.05)
  const [loanInterestRate, setLoanInterestRate] = useState<number>(0)
  const [taxRate, setTaxRate] = useState<number>(0)
  const [scenarioName, setScenarioName] = useState<string>('')
  const [lastSavedOk, setLastSavedOk] = useState<boolean | null>(null)

  const canSave = useMemo(() => !!projectId && scenarioName.trim().length > 0, [projectId, scenarioName])

  /**
   * handleSaveScenario
   *
   * Create a SavedScenario object and persist it via the curvaS store.
   * Provides simple success/failure state for UI feedback.
   */
  function handleSaveScenario() {
    if (!canSave) {
      setLastSavedOk(false)
      return
    }
    try {
      const scenario: SavedScenario = {
        id: generateId(),
        name: scenarioName.trim(),
        dpPercent: whatIfDpPct / 100,
        billingPercent: whatIfBillingPct / 100,
        retentionRate,
        bufferAmount: 0,
      }
      addSavedScenario(projectId, scenario)
      setLastSavedOk(true)
      notify.success('Scenario saved')
      // keep scenario name for quick save multiple times
    } catch (e) {
      setLastSavedOk(false)
    }
  }

  /**
   * handleApply
   *
   * Apply this what-if to project settings.
   */
  function handleApply() {
    if (!projectId) return
    try {
      setPaymentTerms(projectId, {
        downPaymentPercent: whatIfDpPct / 100,
        billingPercent: whatIfBillingPct / 100,
        retentionRate: retentionRate,
        loanInterestRate: loanInterestRate / 100,
        taxRate: taxRate / 100,
      })
      notify.success('Payment terms applied to project')
    } catch (e) {
      notify.error('Failed to apply settings')
    }
  }

  /**
   * handleExportScenarioCSV
   *
   * Export current Curva-S points for this project as CSV.
   */
  function handleExportScenarioCSV() {
    try {
      const points = getDataPoints(projectId) || []
      if (!points || points.length === 0) return
      const rows = points.map((p) => ({
        date: p.date,
        plannedCost: p.plannedCost ?? 0,
        actualCost: p.actualCost ?? 0,
        plannedProgress: p.plannedProgress ?? 0,
        actualProgress: p.actualProgress ?? 0,
      }))
      downloadCSV(rows, `cashflow-${projectId}-points`)
    } catch (e) {
      notify.error('Export CSV failed')
    }
  }

  return (
    <div className="space-y-4 rounded-md border p-4 ">
      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>Down Payment (%)</span>
          <strong>{whatIfDpPct}%</strong>
        </div>
        <input
          type="range"
          min={0}
          max={50}
          step={1}
          value={whatIfDpPct}
          onChange={(e) => setWhatIfDpPct(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-1 text-xs text-muted-foreground">Range 0–50%</div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>Progress Billing (%)</span>
          <strong>{whatIfBillingPct}%</strong>
        </div>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={whatIfBillingPct}
          onChange={(e) => setWhatIfBillingPct(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-1 text-xs text-muted-foreground">How much to bill per progress</div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>Retention (%)</span>
          <strong>{Math.round(retentionRate * 100)}%</strong>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={Math.round(retentionRate * 100 * 10) / 10}
          onChange={(e) => setRetentionRate(Number(e.target.value) / 100)}
          className="w-full"
        />
        <div className="mt-1 text-xs text-muted-foreground">Retention held from billing (0–20%)</div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>Loan Interest (Annual %)</span>
          <strong>{loanInterestRate}%</strong>
        </div>
        <input
          type="range"
          min={0}
          max={20}
          step={0.5}
          value={loanInterestRate}
          onChange={(e) => setLoanInterestRate(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-1 text-xs text-muted-foreground">Interest on negative balance (0–20%)</div>
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between text-sm">
          <span>Tax Rate (%)</span>
          <strong>{taxRate}%</strong>
        </div>
        <input
          type="range"
          min={0}
          max={15}
          step={0.5}
          value={taxRate}
          onChange={(e) => setTaxRate(Number(e.target.value))}
          className="w-full"
        />
        <div className="mt-1 text-xs text-muted-foreground">Tax on billing (e.g. PPN/PPH)</div>
      </div>

      <div className="space-y-2">
        <input
          type="text"
          value={scenarioName}
          onChange={(e) => setScenarioName(e.target.value)}
          placeholder="Scenario name"
          className="w-full rounded-md border px-3 py-1.5 text-sm "
        />
        <div className="flex gap-2">
          <button
            onClick={handleSaveScenario}
            disabled={!canSave}
            className={`rounded-md border px-3 py-1.5 text-sm ${!canSave ? 'opacity-60 cursor-not-allowed' : 'hover:bg-muted/30 dark:hover:bg-muted'} `}
          >
            Save Scenario
          </button>

          <button
            onClick={handleApply}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/30  dark:hover:bg-muted"
          >
            Apply to Settings
          </button>

          <button
            onClick={handleExportScenarioCSV}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted/30  dark:hover:bg-muted"
          >
            Export CSV
          </button>
        </div>

        {lastSavedOk === true ? <div className="text-sm text-green-600 dark:text-green-300">Scenario saved</div> : null}
        {lastSavedOk === false ? <div className="text-sm text-rose-600 dark:text-rose-300">Failed to save scenario</div> : null}
      </div>

      <div className="text-xs text-muted-foreground">
        {projectBudget ? <span>Project budget: <strong>{projectBudget.toLocaleString()}</strong></span> : <span>No project budget provided</span>}
      </div>
    </div>
  )
}

export default WhatIfPanel