/**
 * CompareControls.test.tsx
 *
 * Unit tests for CompareControls. These tests validate safe behavior when:
 * - there are no saved scenarios (UI should reflect "No scenarios")
 * - when scenarios exist, selects are enabled and scenario count displayed
 *
 * Note: The project environment may not have a test runner configured. These
 * files are provided so CI or local test setups can run them.
 */

import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import CompareControls from '../CompareControls'
import { act } from 'react-dom/test-utils'
import useCurvaSStore, { SavedScenario } from '../../../store/curvaSStore'

describe('CompareControls', () => {
  const projectId = 'TEST-PROJ'

  beforeEach(() => {
    // reset store state for tests
    act(() => {
      const set = useCurvaSStore.setState
      set({
        savedScenarios: {},
      })
    })
  })

  test('renders "No scenarios" when there are none', () => {
    render(<CompareControls projectId={projectId} />)
    expect(screen.getByText(/No saved scenarios/i) || screen.getByText(/No scenarios/i)).toBeTruthy()
    // selects should show "No scenarios" option
    const selectA = screen.getByLabelText('Select Compare A scenario') as HTMLSelectElement
    expect(selectA).toBeInTheDocument()
    expect(selectA.disabled).toBe(true)
  })

  test('renders scenario options when scenarios exist', () => {
    const sample: SavedScenario = { id: 's1', name: 'Scenario 1', dpPercent: 0.1 }
    act(() => {
      useCurvaSStore.getState().addSavedScenario(projectId, sample)
    })

    render(<CompareControls projectId={projectId} />)
    expect(screen.getByText(/1 saved scenario/i)).toBeTruthy()
    const selectA = screen.getByLabelText('Select Compare A scenario') as HTMLSelectElement
    expect(selectA.disabled).toBe(false)
    // open and select an option
    fireEvent.change(selectA, { target: { value: 's1' } })
    expect(selectA.value).toBe('s1')
  })
})