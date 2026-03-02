/**
 * CashFlow.test.tsx
 *
 * Unit tests for CashFlow page behaviors focused on saved-scenarios empty state.
 *
 * These tests use the Zustand store setters to provide deterministic store state.
 */

import React from 'react'
import { render, screen, act } from '@testing-library/react'
import CashFlow from '../../../pages/modules/CashFlow'
import useCurvaSStore from '../../../store/curvaSStore'
import { useProjectStore } from '../../../store/projectStore'

describe('CashFlow page', () => {
  const projectId = 'TEST-PROJ'

  beforeEach(() => {
    // Reset curva-s store
    act(() => {
      useCurvaSStore.setState({
        savedScenarios: {},
        dataPoints: {},
        analyses: {},
        configs: {},
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    })

    // Ensure project store reports an active project
    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useProjectStore.setState({
        projects: {
          [projectId]: { id: projectId, name: 'Test Project', budget: 1000000 }
        },
        activeProjectId: projectId
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    })
  })

  afterEach(() => {
    // clear modifications
    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useCurvaSStore.setState({ savedScenarios: {} } as any)
    })
  })

  test('shows empty state when there are no saved scenarios', () => {
    render(<CashFlow />)
    expect(screen.getAllByText(/No saved scenarios/i).length).toBeGreaterThan(0)
    expect(screen.getByText(/You don't have any saved cashflow scenarios/i)).toBeTruthy()
  })

  test('does not show empty state when scenarios exist', () => {
    act(() => {
      useCurvaSStore.getState().addSavedScenario(projectId, {
        id: 's1',
        name: 'Scenario 1',
        dpPercent: 0.1,
      })
    })

    render(<CashFlow />)
    // the empty-state message should not be present
    const empty = screen.queryByText(/No saved scenarios/i)
    expect(empty).toBeNull()
    // CompareControls summary should show count
    expect(screen.getByText(/1 saved scenario/i)).toBeTruthy()
  })
})