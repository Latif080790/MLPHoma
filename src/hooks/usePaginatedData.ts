/**
 * usePaginatedData.ts
 *
 * Client-side pagination for large in-memory lists (RAB, opname, work orders).
 * Slices an already-filtered array into pages without hitting the network.
 *
 * Usage:
 *   const { items, page, totalPages, setPage } = usePaginatedData(filteredRab, 25)
 */

import { useState, useMemo } from 'react'

export interface PaginationState {
  page: number
  pageSize: number
  totalPages: number
  totalItems: number
  setPage: (page: number) => void
  setPageSize: (size: number) => void
}

export interface PaginatedResult<T> extends PaginationState {
  items: T[]
}

export function usePaginatedData<T>(
  data: T[],
  initialPageSize = 20,
): PaginatedResult<T> {
  const [page, setPageRaw] = useState(1)
  const [pageSize, setPageSizeRaw] = useState(initialPageSize)

  const totalItems = data.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))

  const setPage = (p: number) => setPageRaw(Math.min(Math.max(1, p), totalPages))

  const setPageSize = (s: number) => {
    setPageSizeRaw(Math.max(1, s))
    setPageRaw(1)
  }

  const items = useMemo(() => {
    const start = (page - 1) * pageSize
    return data.slice(start, start + pageSize)
  }, [data, page, pageSize])

  return { items, page, pageSize, totalPages, totalItems, setPage, setPageSize }
}
