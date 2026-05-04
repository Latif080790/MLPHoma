/**
 * CompareControls.story.tsx
 *
 * Minimal demo component for CompareControls. This is not a Storybook file per-se,
 * but a lightweight story-like component developers can render in a dev page.
 *
 * Usage:
 * - Import this component in a dev-only route or render from an existing page to preview.
 */

import React, { useEffect } from 'react'
import CompareControls from './CompareControls'
import useCurvaSStore from '../../store/curvaSStore'

/**
 * CompareControlsStory
 *
 * This demo seeds two scenarios into the store for projectId 'DEMO' and renders the control.
 *
 * @returns JSX.Element
 */
export default function CompareControlsStory(): JSX.Element {
  const addSavedScenario = useCurvaSStore((s) => s.addSavedScenario)
  useEffect(() => {
    // seed demo scenarios (idempotent on repeated mounts because store avoids duplicates by id)
    addSavedScenario('DEMO', { id: 'demo-a', name: 'Demo A', dpPercent: 0.1, billingPercent: 0.3, retentionRate: 0.05 })
    addSavedScenario('DEMO', { id: 'demo-b', name: 'Demo B', dpPercent: 0.05, billingPercent: 0.4, retentionRate: 0.03 })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="p-6">
      <h3 className="mb-4 text-lg font-semibold">CompareControls - Demo (project: DEMO)</h3>
      <div className="rounded-md border p-4 dark:border-neutral-800">
        <CompareControls projectId="DEMO" />
      </div>
    </div>
  )
}