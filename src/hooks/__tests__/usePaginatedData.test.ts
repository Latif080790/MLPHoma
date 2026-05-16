/**
 * usePaginatedData.test.ts
 * Tests pagination slicing, page boundary clamping, and pageSize changes.
 */

import { describe, it, expect } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePaginatedData } from '../usePaginatedData'

const ITEMS = Array.from({ length: 55 }, (_, i) => ({ id: i + 1 }))

describe('usePaginatedData', () => {
  it('returns first page items on mount', () => {
    const { result } = renderHook(() => usePaginatedData(ITEMS, 20))
    expect(result.current.items).toHaveLength(20)
    expect(result.current.items[0].id).toBe(1)
    expect(result.current.items[19].id).toBe(20)
  })

  it('calculates totalPages correctly', () => {
    const { result } = renderHook(() => usePaginatedData(ITEMS, 20))
    // 55 items / 20 per page = 3 pages (last page has 15)
    expect(result.current.totalPages).toBe(3)
    expect(result.current.totalItems).toBe(55)
  })

  it('navigates to next page', () => {
    const { result } = renderHook(() => usePaginatedData(ITEMS, 20))
    act(() => result.current.setPage(2))
    expect(result.current.page).toBe(2)
    expect(result.current.items[0].id).toBe(21)
    expect(result.current.items[19].id).toBe(40)
  })

  it('returns partial last page', () => {
    const { result } = renderHook(() => usePaginatedData(ITEMS, 20))
    act(() => result.current.setPage(3))
    expect(result.current.items).toHaveLength(15)
    expect(result.current.items[14].id).toBe(55)
  })

  it('clamps page to 1 when set below 1', () => {
    const { result } = renderHook(() => usePaginatedData(ITEMS, 20))
    act(() => result.current.setPage(0))
    expect(result.current.page).toBe(1)
  })

  it('clamps page to totalPages when set above max', () => {
    const { result } = renderHook(() => usePaginatedData(ITEMS, 20))
    act(() => result.current.setPage(99))
    expect(result.current.page).toBe(3)
  })

  it('resets to page 1 when pageSize changes', () => {
    const { result } = renderHook(() => usePaginatedData(ITEMS, 20))
    act(() => result.current.setPage(3))
    expect(result.current.page).toBe(3)
    act(() => result.current.setPageSize(10))
    expect(result.current.page).toBe(1)
    expect(result.current.totalPages).toBe(6)
  })

  it('returns single page when data fits within pageSize', () => {
    const small = [{ id: 1 }, { id: 2 }, { id: 3 }]
    const { result } = renderHook(() => usePaginatedData(small, 20))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.items).toHaveLength(3)
  })

  it('returns totalPages=1 for empty data', () => {
    const { result } = renderHook(() => usePaginatedData([], 20))
    expect(result.current.totalPages).toBe(1)
    expect(result.current.items).toHaveLength(0)
  })

  it('updates items when underlying data changes', () => {
    let data = ITEMS.slice(0, 10)
    const { result, rerender } = renderHook(() => usePaginatedData(data, 5))
    expect(result.current.totalPages).toBe(2)
    data = ITEMS.slice(0, 6)
    rerender()
    expect(result.current.totalPages).toBe(2)
    data = ITEMS.slice(0, 5)
    rerender()
    expect(result.current.totalPages).toBe(1)
  })
})
