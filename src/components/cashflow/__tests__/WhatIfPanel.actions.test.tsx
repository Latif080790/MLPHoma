/**
 * WhatIfPanel.actions.test.tsx
 *
 * Unit tests for WhatIfPanel actions:
 * - Saving scenario should add SavedScenario to the Curva-S store and show toast
 * - Applying should persist payment terms to projectStore and show toast
 *
 * Note:
 * - Tests assume jest + @testing-library/react are available in the environment.
 */

import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { vi } from 'vitest'
import WhatIfPanel from '../WhatIfPanel'
import useCurvaSStore from '../../../store/curvaSStore'
import useProjectStore from '../../../store/projectStore'
import * as toast from '../../../lib/toast'

vi.mock('../../../lib/toast', () => {
  const mockNotify = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  }
  return {
    notify: mockNotify,
    default: mockNotify,
  }
})

describe('WhatIfPanel actions', () => {
  const projectId = 'TEST-P-01'
  beforeEach(() => {
    // Reset stores to known state
    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useCurvaSStore.setState({ savedScenarios: {}, curvaSData: {} } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useProjectStore.setState({
        projects: {
          [projectId]: { id: projectId, name: 'Test Project', budget: 1000000, status: 'Active' },
        },
        activeProjectId: projectId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)
    })
    // reset mock
    vi.clearAllMocks()
  })

  test('save scenario adds scenario and triggers success toast', async () => {
    render(<WhatIfPanel projectId={projectId} projectBudget={1000000} />)

    const nameInput = screen.getByPlaceholderText('Scenario name') as HTMLInputElement
    fireEvent.change(nameInput, { target: { value: 'My Scenario' } })
    expect(nameInput.value).toBe('My Scenario')

    const saveBtn = screen.getByText('Save Scenario') as HTMLButtonElement
    expect(saveBtn).toBeEnabled()

    await act(async () => {
      fireEvent.click(saveBtn)
    })

    const scenarios = useCurvaSStore.getState().getSavedScenarios(projectId)
    expect(Array.isArray(scenarios)).toBe(true)
    expect(scenarios.length).toBeGreaterThanOrEqual(1)
    expect(scenarios.find((s) => s.name === 'My Scenario')).toBeTruthy()
    expect(toast.notify.success).toHaveBeenCalledWith('Scenario saved')
  })

  test('apply saves payment terms to project store and triggers toast', async () => {
    render(<WhatIfPanel projectId={projectId} projectBudget={1000000} />)

    // adjust sliders via input value changes
    const applyBtn = screen.getByText('Apply to Settings') as HTMLButtonElement
    await act(async () => {
      fireEvent.click(applyBtn)
    })

    const proj = useProjectStore.getState().getProject(projectId)
    expect(proj).toBeDefined()
    expect(proj?.paymentTerms).toBeDefined()
    // since defaults are dp=10%, billing=30%, retention=0.05
    expect(Math.round((proj?.paymentTerms?.downPaymentPercent ?? 0) * 100)).toBe(10)
    expect(Math.round((proj?.paymentTerms?.billingPercent ?? 0) * 100)).toBe(30)
    expect(Math.round((proj?.paymentTerms?.retentionRate ?? 0) * 100)).toBe(5)
    expect(toast.notify.success).toHaveBeenCalledWith('Payment terms applied to project')
  })
})