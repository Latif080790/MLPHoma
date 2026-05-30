/**
 * ErrorBoundary.tsx
 * 
 * React Error Boundary component for graceful error handling.
 * Catches JavaScript errors anywhere in the component tree, logs errors,
 * and displays a fallback UI instead of crashing the entire app.
 * 
 * Features:
 * - Catches rendering errors, lifecycle errors, and constructor errors
 * - Logs errors to console (can be extended to external logging service)
 * - Provides user-friendly fallback UI
 * - Recovery actions: retry, reload, go home
 * - Different severity levels for different error types
 * - Error count tracking to detect critical issues
 */

import React from 'react'
import { AlertTriangle, RefreshCw, Home, Copy } from 'lucide-react'
import { logError } from '@/services/errorLoggingService'

/**
 * State ErrorBoundary.
 */
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
  errorCount: number
  timestamp?: number
}

interface ErrorBoundaryProps {
  children: React.ReactNode
  /** Fallback UI to show when error occurs */
  fallback?: React.ReactNode
  /** Callback when error occurs */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void
  /** Whether to show error details (default: dev mode only) */
  showDetails?: boolean
  /** Custom error message */
  errorMessage?: string
  /** Recovery action callback */
  onReset?: () => void
}

/**
 * ErrorBoundary
 * Membungkus area aplikasi untuk menangkap error render/commit lifecycles.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, errorCount: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error, timestamp: Date.now() }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    const nextErrorCount = this.state.errorCount + 1

    // Update state with error details and increment error count
    this.setState((prevState) => ({
      error,
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }))

    // Log error to console
    console.error('ErrorBoundary caught error:', error, errorInfo)

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    logError(error, {
      componentStack: errorInfo.componentStack,
      errorCount: nextErrorCount
    })
  }

  private isChunkLoadError(): boolean {
    const msg = this.state.error?.message || ''
    return (
      msg.includes('Failed to fetch dynamically imported module') ||
      msg.includes('Loading chunk') ||
      msg.includes('Importing a module script failed') ||
      this.state.error?.name === 'ChunkLoadError'
    )
  }

  private handleRetry = () => {
    // Chunk load errors (stale CDN cache after re-deploy) require a hard reload
    if (this.isChunkLoadError()) {
      window.location.reload()
      return
    }
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
    
    // Call custom reset handler if provided
    if (this.props.onReset) {
      this.props.onReset()
    }
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleGoHome = () => {
    window.location.href = '/'
  }

  private handleCopy = async () => {
    const payload = JSON.stringify(
      {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
        timestamp: this.state.timestamp,
        errorCount: this.state.errorCount,
      },
      null,
      2
    )
    try {
      await navigator.clipboard.writeText(payload)
      // opsional: bisa pakai toast sukses
    } catch {
      // ignore
    }
  }

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children

    // Custom fallback UI
    if (this.props.fallback) {
      return this.props.fallback
    }

    const { error, errorInfo, errorCount } = this.state
    const showDetails = this.props.showDetails ?? process.env.NODE_ENV === 'development'
    const errorMessage = this.props.errorMessage || 'Terjadi kesalahan'
    
    // Critical error (multiple errors in short time)
    const isCritical = errorCount > 3

    return (
      <div className="mx-auto my-8 w-full max-w-2xl rounded-xl border p-6 shadow-lg" 
           style={{ 
             borderColor: isCritical ? 'rgb(239 68 68)' : 'rgb(252 165 165)',
             backgroundColor: isCritical ? 'rgb(254 226 226)' : 'rgb(254 242 242)'
           }}>
        <div className="mb-4 flex items-start gap-3">
          {isCritical ? (
            <AlertTriangle className="h-8 w-8 text-red-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="h-8 w-8 text-red-500 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="text-lg font-semibold text-red-900 mb-1">
              {isCritical ? 'Critical Error' : errorMessage}
            </div>
            <p className="text-sm text-red-800">
              {isCritical
                ? 'Multiple errors detected. Please reload the page.'
                : 'Maaf, ada masalah saat menampilkan halaman ini. Anda bisa mencoba ulang atau memuat ulang halaman.'}
            </p>
          </div>
        </div>

        {/* Error message */}
        <div className="mb-4 rounded-md bg-card p-3 text-sm text-red-900 shadow-sm border border-red-200">
          <div className="font-semibold mb-1">Error Details:</div>
          <div className="text-red-700">{error?.message || 'Unknown error'}</div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-2 mb-4">
          {!isCritical && (
            <button
              onClick={this.handleRetry}
              className="inline-flex items-center gap-2 rounded-md bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-card transition-colors"
              aria-label="Coba lagi"
            >
              <RefreshCw className="h-4 w-4" />
              Coba lagi
            </button>
          )}
          <button
            onClick={this.handleReload}
            className="inline-flex items-center gap-2 rounded-md bg-neutral-200 px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700 transition-colors"
            aria-label="Muat ulang"
          >
            <RefreshCw className="h-4 w-4" />
            Muat ulang
          </button>
          <button
            onClick={this.handleGoHome}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Ke Beranda"
          >
            <Home className="h-4 w-4" />
            Ke Beranda
          </button>
          <button
            onClick={this.handleCopy}
            className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800 transition-colors"
            aria-label="Salin detail error"
          >
            <Copy className="h-4 w-4" />
            Salin detail
          </button>
        </div>

        {/* Technical details (dev mode only) */}
        {showDetails && error && (
          <details className="text-sm">
            <summary className="cursor-pointer font-medium text-red-800 hover:text-red-900 mb-2">
              Technical Details (Developer Mode)
            </summary>
            <div className="rounded-md bg-card p-3 text-xs text-neutral-800 shadow-sm border border-red-200">
              <div className="space-y-2 font-mono">
                <div>
                  <span className="font-semibold">Error:</span>
                  <pre className="mt-1 text-red-600 whitespace-pre-wrap max-h-48 overflow-auto">
                    {error.toString()}
                  </pre>
                </div>
                {error.stack && (
                  <div>
                    <span className="font-semibold">Stack Trace:</span>
                    <pre className="mt-1 text-gray-600 whitespace-pre-wrap overflow-x-auto max-h-48">
                      {error.stack}
                    </pre>
                  </div>
                )}
                {errorInfo?.componentStack && (
                  <div>
                    <span className="font-semibold">Component Stack:</span>
                    <pre className="mt-1 text-gray-600 whitespace-pre-wrap overflow-x-auto max-h-48">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-300">
                  <span className="font-semibold">Error Count:</span> {errorCount}
                </div>
              </div>
            </div>
          </details>
        )}

        {/* Help text */}
        <div className="mt-4 text-sm text-red-800">
          <p className="font-medium mb-1">Jika masalah ini terus berlanjut:</p>
          <ul className="list-disc list-inside space-y-1 text-red-700">
            <li>Coba refresh halaman</li>
            <li>Bersihkan cache browser</li>
            <li>Periksa koneksi internet</li>
            <li>Hubungi support jika masalah berlanjut</li>
          </ul>
        </div>
      </div>
    )
  }
}

/**
 * Hook-based error boundary wrapper for functional components
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <ErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

export default ErrorBoundary
