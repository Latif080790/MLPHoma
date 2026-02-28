import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ErrorInfo } from 'react'
import { buildExternalErrorLog, reportExternalError } from '../errorLoggingService'

describe('errorLoggingService', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('builds payload with core browser metadata', () => {
    const err = new Error('boom')
    const info = { componentStack: 'at Component' } as ErrorInfo

    const payload = buildExternalErrorLog(err, info, 3)

    expect(payload.source).toBe('ErrorBoundary')
    expect(payload.message).toBe('boom')
    expect(payload.componentStack).toContain('Component')
    expect(payload.errorCount).toBe(3)
    expect(payload.url.length).toBeGreaterThan(0)
  })

  it('returns false when endpoint env is missing', async () => {
    const meta = import.meta as { env: Record<string, string | undefined> }
    const original = meta.env.VITE_ERROR_LOG_ENDPOINT
    meta.env.VITE_ERROR_LOG_ENDPOINT = ''

    const result = await reportExternalError({
      source: 'ErrorBoundary',
      message: 'x',
      url: 'http://localhost',
      userAgent: 'ua',
      timestamp: new Date().toISOString(),
      errorCount: 1,
    })

    expect(result).toBe(false)
    meta.env.VITE_ERROR_LOG_ENDPOINT = original
  })
})
