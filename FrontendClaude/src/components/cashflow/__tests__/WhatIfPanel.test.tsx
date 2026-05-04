/**
 * WhatIfPanel.test.tsx
 *
 * Unit tests for WhatIfPanel save behavior. Validates that clicking "Save Scenario"
 * persists a SavedScenario into the Curva-S store for the given projectId.
 *
 * Note: test runner may not be configured in the environment. These files are provided
 * so CI or local test setups can run them.
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import WhatIfPanel from '../WhatIfPanel'
import useCurvaSStore from '../../../store/curvaSStore'

describe('WhatIfPanel', () => {
  const projectId = 'TEST-PROJ-WIF'

  beforeEach(() => {
    act(() => {
      // reset savedScenarios for isolation
      const set = useCurvaSStore.setState
      set({ savedScenarios: {} })
    })
  })

  test('saves a scenario into the store when Save Scenario is clicked', () => {
    render(<WhatIfPanel projectId={projectId} projectBudget={1000000} />)

    // enter scenario name
    const input = screen.getByPlaceholderText('Scenario name') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'Test Scenario 1' } })
    expect(input.value).toBe('Test Scenario 1')

    // click Save Scenario button
    const btn = screen.getByText('Save Scenario') as HTMLButtonElement
    expect(btn).toBeEnabled()

    fireEvent.click(btn)

    // read from store
    const scenarios = useCurvaSStore.getState().getSavedScenarios(projectId)
    expect(Array.isArray(scenarios)).toBe(true)
    expect(scenarios.length).toBe(1)
    expect(scenarios[0].name).toBe('Test Scenario 1')
  })

  test('prevent saving when no name provided', () => {
    render(<WhatIfPanel projectId={projectId} projectBudget={1000000} />)
    const btn = screen.getByText('Save Scenario') as HTMLButtonElement
    expect(btn).toBeDisabled() // the component disables when no name
  })
})