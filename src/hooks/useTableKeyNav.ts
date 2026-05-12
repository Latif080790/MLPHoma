/**
 * useTableKeyNav.ts
 *
 * v4 Sprint 3 — Item 18: Full keyboard shortcuts
 * Provides Tab/Arrow keyboard navigation within data tables.
 *
 * Usage:
 *   const { tableRef, focusCell } = useTableKeyNav()
 *   <table ref={tableRef} ...>
 *
 * Keys handled:
 *   Tab / Shift+Tab → next/prev focusable cell in current row
 *   ArrowDown / ArrowUp → next/prev row same column
 *   ArrowLeft / ArrowRight → prev/next column
 *   Enter → activate the focused cell (click)
 *   Home / End → first/last cell in row
 */

import { useCallback, useRef } from 'react'

type FocusableEl = HTMLElement

function getCells(table: HTMLElement): FocusableEl[][] {
  const rows = Array.from(table.querySelectorAll('tr'))
  return rows.map(row =>
    Array.from(row.querySelectorAll('td, th')).filter(
      (el) => !el.getAttribute('aria-hidden')
    ) as FocusableEl[]
  ).filter(r => r.length > 0)
}

function getPosition(table: HTMLElement, el: Element): { row: number; col: number } | null {
  const cells = getCells(table)
  for (let r = 0; r < cells.length; r++) {
    const col = cells[r].indexOf(el as FocusableEl)
    if (col !== -1) return { row: r, col }
  }
  return null
}

function focusCell(cells: FocusableEl[][], row: number, col: number) {
  const r = Math.max(0, Math.min(row, cells.length - 1))
  const c = Math.max(0, Math.min(col, (cells[r]?.length ?? 1) - 1))
  const target = cells[r]?.[c]
  if (target) {
    // Focus first focusable child (button, input, checkbox) or the cell itself
    const focusable = target.querySelector<HTMLElement>(
      'button, input, select, textarea, a[href], [tabindex]:not([tabindex="-1"])'
    )
    ;(focusable ?? target).focus()
  }
}

export function useTableKeyNav() {
  const tableRef = useRef<HTMLTableElement>(null)

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLElement>) => {
    const table = tableRef.current
    if (!table) return

    const active = document.activeElement
    if (!active) return

    // Find closest cell ancestor
    const cell = active.closest('td, th') as HTMLElement | null
    if (!cell || !table.contains(cell)) return

    const pos = getPosition(table, cell)
    if (!pos) return

    const cells = getCells(table)
    const { row, col } = pos

    switch (e.key) {
      case 'Tab': {
        e.preventDefault()
        if (e.shiftKey) {
          if (col > 0) focusCell(cells, row, col - 1)
          else if (row > 0) focusCell(cells, row - 1, cells[row - 1].length - 1)
        } else {
          if (col < cells[row].length - 1) focusCell(cells, row, col + 1)
          else if (row < cells.length - 1) focusCell(cells, row + 1, 0)
        }
        break
      }
      case 'ArrowDown':
        e.preventDefault()
        focusCell(cells, row + 1, col)
        break
      case 'ArrowUp':
        e.preventDefault()
        focusCell(cells, row - 1, col)
        break
      case 'ArrowRight':
        e.preventDefault()
        focusCell(cells, row, col + 1)
        break
      case 'ArrowLeft':
        e.preventDefault()
        focusCell(cells, row, col - 1)
        break
      case 'Home':
        e.preventDefault()
        focusCell(cells, row, 0)
        break
      case 'End':
        e.preventDefault()
        focusCell(cells, row, cells[row].length - 1)
        break
      case 'Enter': {
        const btn = cell.querySelector<HTMLElement>('button, a[href]')
        if (btn) { e.preventDefault(); btn.click() }
        break
      }
      default:
        break
    }
  }, [])

  return { tableRef, handleKeyDown }
}
