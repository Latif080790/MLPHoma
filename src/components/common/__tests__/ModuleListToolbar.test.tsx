import React from 'react'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'
import ModuleListToolbar from '../ModuleListToolbar'

describe('ModuleListToolbar', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.runOnlyPendingTimers()
    vi.useRealTimers()
  })

  test('debounces query changes before calling onQueryChange', () => {
    const onQueryChange = vi.fn()

    render(
      <ModuleListToolbar
        query=""
        onQueryChange={onQueryChange}
        queryPlaceholder="Search documents..."
        debounceMs={300}
      />
    )

    const input = screen.getByRole('textbox', { name: 'Search documents...' })
    fireEvent.change(input, { target: { value: 'contract' } })

    expect(onQueryChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(onQueryChange).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(onQueryChange).toHaveBeenCalledTimes(1)
    expect(onQueryChange).toHaveBeenLastCalledWith('contract')
  })

  test('renders accessible controls and live result status', () => {
    const onQueryChange = vi.fn()

    render(
      <ModuleListToolbar
        query=""
        onQueryChange={onQueryChange}
        queryPlaceholder="Search invoices"
        filterValue="all"
        onFilterChange={() => {}}
        filterOptions={[
          { value: 'all', label: 'All Status' },
          { value: 'paid', label: 'Paid' },
        ]}
        filterPlaceholder="Filter status"
        sortValue="newest"
        onSortChange={() => {}}
        sortOptions={[
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' },
        ]}
        sortPlaceholder="Sort by"
        resultCount={7}
        resultLabel="invoices"
      />
    )

    expect(screen.getByRole('textbox', { name: 'Search invoices' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Filter status' })).toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Sort by' })).toBeInTheDocument()

    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('7 invoices')
    expect(status).toHaveAttribute('aria-live', 'polite')
  })
})
