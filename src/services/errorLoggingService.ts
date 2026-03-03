import type { ErrorInfo } from 'react'

export interface ExternalErrorLog {
  source: 'ErrorBoundary'
  message: string
  stack?: string
  componentStack?: string
  url: string
  userAgent: string
  timestamp: string
  errorCount: number
}

function getEndpoint(): string | null {
  const endpoint = import.meta.env.VITE_ERROR_LOG_ENDPOINT
  if (!endpoint || typeof endpoint !== 'string') return null
  const trimmed = endpoint.trim()
  return trimmed.length > 0 ? trimmed : null
}

export function buildExternalErrorLog(
  error: Error,
  errorInfo: ErrorInfo,
  errorCount: number,
): ExternalErrorLog {
  return {
    source: 'ErrorBoundary',
    message: error.message,
    stack: error.stack,
    componentStack: errorInfo.componentStack ?? undefined,
    url: window.location.href,
    userAgent: navigator.userAgent,
    timestamp: new Date().toISOString(),
    errorCount,
  }
}

export async function reportExternalError(log: ExternalErrorLog): Promise<boolean> {
  const endpoint = getEndpoint()
  if (!endpoint) return false

  const body = JSON.stringify(log)

  if (typeof navigator.sendBeacon === 'function') {
    const blob = new Blob([body], { type: 'application/json' })
    const accepted = navigator.sendBeacon(endpoint, blob)
    if (accepted) return true
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    keepalive: true,
  })

  return response.ok
}