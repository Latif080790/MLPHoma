/**
 * useDebounce.test.ts
 * Tests debounce timing and value propagation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300))
    expect(result.current).toBe('hello')
  })

  it('does not propagate changes before delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    )
    rerender({ value: 'ab' })
    expect(result.current).toBe('a')
    rerender({ value: 'abc' })
    expect(result.current).toBe('a')
  })

  it('propagates the latest value after delay elapses', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: 'a' } },
    )
    rerender({ value: 'abc' })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe('abc')
  })

  it('resets the timer when value changes rapidly', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 300),
      { initialProps: { value: '' } },
    )
    rerender({ value: 'x' })
    act(() => vi.advanceTimersByTime(200))
    rerender({ value: 'xy' })
    act(() => vi.advanceTimersByTime(200))
    // 200+200=400ms elapsed but last change was only 200ms ago — still debounced
    expect(result.current).toBe('')
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe('xy')
  })

  it('uses 300ms default delay when not specified', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value),
      { initialProps: { value: 'start' } },
    )
    rerender({ value: 'end' })
    act(() => vi.advanceTimersByTime(299))
    expect(result.current).toBe('start')
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe('end')
  })

  it('works with non-string types', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 100),
      { initialProps: { value: 0 } },
    )
    rerender({ value: 42 })
    act(() => vi.advanceTimersByTime(100))
    expect(result.current).toBe(42)
  })
})
