import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, test, vi } from 'vitest'
import { ProjectSwitcherDropdown } from '../ProjectSwitcherDropdown'

const mockNavigate = vi.fn()
const mockSetActiveProject = vi.fn()
const mockUseProjectStore = vi.fn()

vi.mock('@/store/projectStore', () => ({
  useProjectStore: () => mockUseProjectStore(),
}))

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, className }: { children: React.ReactNode; onClick?: () => void; className?: string }) => (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  ),
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <hr />,
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('ProjectSwitcherDropdown', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mockUseProjectStore.mockReturnValue({
      activeProjectId: 'proj-1',
      setActiveProject: mockSetActiveProject,
      projects: {
        'proj-1': {
          id: 'proj-1',
          name: 'CMPLNG VILLAGE',
          code: 'PRJ-2026-0019',
          status: 'active',
        },
        'proj-2': {
          id: 'proj-2',
          name: 'KADUPILA',
          code: 'PRJ-2026-0020',
          status: 'planning',
        },
      },
    })
  })

  test('switches active project without forcing navigation', () => {
    render(<ProjectSwitcherDropdown />)

    fireEvent.click(screen.getByRole('button', { name: /ganti proyek aktif/i }))
    fireEvent.click(screen.getByText('KADUPILA'))

    expect(mockSetActiveProject).toHaveBeenCalledWith('proj-2')
    expect(mockNavigate).not.toHaveBeenCalledWith('/dashboard')
  })

  test('navigates to projects page from overflow action', () => {
    mockUseProjectStore.mockReturnValue({
      activeProjectId: 'proj-1',
      setActiveProject: mockSetActiveProject,
      projects: Object.fromEntries(
        Array.from({ length: 9 }, (_, index) => [
          `proj-${index + 1}`,
          {
            id: `proj-${index + 1}`,
            name: `Project ${index + 1}`,
            code: `PRJ-2026-00${index + 1}`,
            status: 'active',
          },
        ])
      ),
    })

    render(<ProjectSwitcherDropdown />)

    fireEvent.click(screen.getByRole('button', { name: /ganti proyek aktif/i }))
    fireEvent.click(screen.getByText(/lihat semua 9 proyek/i))

    expect(mockNavigate).toHaveBeenCalledWith('/projects')
  })
})