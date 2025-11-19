/**
 * CompareControls.tsx
 *
 * Small UI component to choose two saved scenarios for A/B comparison and toggle which cumulative series to show.
 * Uses the stable getter getSavedScenarios(projectId) from the Curva-S store so it never reads undefined.
 */

import React, { useMemo, useState } from 'react'
import useCurvaSStore, { SavedScenario } from '../../store/curvaSStore'

/**
 * CompareControlsProps
 * Props for CompareControls component.
 */
export interface CompareControlsProps {
  /** Current project id used to fetch scenarios from store */
  projectId: string
}

/**
 * CompareControls
 *
 * Render dropdowns to pick Compare A/B and toggles to show cumulative lines.
 *
 * @param props CompareControlsProps
 * @returns JSX.Element
 */
const CompareControls: React.FC<CompareControlsProps> = ({ projectId }) => {
  /**
   * scenarios
   * Read saved scenarios using stable getter getSavedScenarios(projectId).
   * The getter always returns an array (defensive implementation in store).
   */
  const scenarios: SavedScenario[] = useCurvaSStore((s: any) => {
    try {
      return typeof s.getSavedScenarios === 'function' ? s.getSavedScenarios(projectId) : []
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('CompareControls: failed to read scenarios', e)
      return []
    }
  })

  // Local selection state
  const [compareAId, setCompareAId] = useState<string | ''>('')
  const [compareBId, setCompareBId] = useState<string | ''>('')

  // Local toggles for which cumulative series to show
  const [showCompareACumIn, setShowCompareACumIn] = useState<boolean>(false)
  const [showCompareACumOut, setShowCompareACumOut] = useState<boolean>(false)
  const [showCompareBCumIn, setShowCompareBCumIn] = useState<boolean>(false)
  const [showCompareBCumOut, setShowCompareBCumOut] = useState<boolean>(false)

  const hasScenarios = useMemo(() => Array.isArray(scenarios) && scenarios.length > 0, [scenarios])

  const scenarioOptions = useMemo(() => {
    if (!hasScenarios) return []
    return scenarios.map((sc) => ({ id: sc.id, name: sc.name }))
  }, [hasScenarios, scenarios])

  const selectedA = scenarios.find((s) => s.id === compareAId) || null
  const selectedB = scenarios.find((s) => s.id === compareBId) || null

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <div className="flex items-center gap-2">
        <span className="rounded bg-violet-100 px-2 py-0.5 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">A</span>

        <select
          aria-label="Select Compare A scenario"
          className="rounded-md border px-2 py-1 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          value={compareAId}
          onChange={(e) => setCompareAId(e.target.value)}
          disabled={!hasScenarios}
          title={hasScenarios ? 'Select scenario for Compare A' : 'No scenarios available'}
        >
          {!hasScenarios ? (
            <option value="">No scenarios</option>
          ) : (
            <>
              <option value="">None</option>
              {scenarioOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </>
          )}
        </select>

        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={showCompareACumIn}
            onChange={(e) => setShowCompareACumIn(e.target.checked)}
            disabled={!compareAId}
          />
          <span className="text-neutral-600 dark:text-neutral-300">Cum In</span>
        </label>

        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={showCompareACumOut}
            onChange={(e) => setShowCompareACumOut(e.target.checked)}
            disabled={!compareAId}
          />
          <span className="text-neutral-600 dark:text-neutral-300">Cum Out</span>
        </label>
      </div>

      <div className="flex items-center gap-2">
        <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">B</span>

        <select
          aria-label="Select Compare B scenario"
          className="rounded-md border px-2 py-1 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
          value={compareBId}
          onChange={(e) => setCompareBId(e.target.value)}
          disabled={!hasScenarios}
          title={hasScenarios ? 'Select scenario for Compare B' : 'No scenarios available'}
        >
          {!hasScenarios ? (
            <option value="">No scenarios</option>
          ) : (
            <>
              <option value="">None</option>
              {scenarioOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.name}
                </option>
              ))}
            </>
          )}
        </select>

        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={showCompareBCumIn}
            onChange={(e) => setShowCompareBCumIn(e.target.checked)}
            disabled={!compareBId}
          />
          <span className="text-neutral-600 dark:text-neutral-300">Cum In</span>
        </label>

        <label className="inline-flex items-center gap-1">
          <input
            type="checkbox"
            checked={showCompareBCumOut}
            onChange={(e) => setShowCompareBCumOut(e.target.checked)}
            disabled={!compareBId}
          />
          <span className="text-neutral-600 dark:text-neutral-300">Cum Out</span>
        </label>
      </div>

      {/* Simple status summary */}
      <div className="ml-2 text-xs text-neutral-500 dark:text-neutral-400">
        {hasScenarios ? <span>{scenarios.length} saved {scenarios.length === 1 ? 'scenario' : 'scenarios'}</span> : <span>No saved scenarios</span>}
      </div>
    </div>
  )
}

export default CompareControls