/**
 * ErrorBoundary.tsx
 * Komponen penangkap error UI dengan fallback ramah pengguna.
 * Menangani error yang terjadi di bawahnya tanpa memutus seluruh aplikasi.
 */

import React from 'react'

/**
 * State ErrorBoundary.
 */
interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: React.ErrorInfo
}

/**
 * ErrorBoundary
 * Membungkus area aplikasi untuk menangkap error render/commit lifecycles.
 */
export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  constructor(props: React.PropsWithChildren) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.setState({ error, errorInfo })
    // TODO: Integrasi logging eksternal jika dibutuhkan (Sentry/console server)
    console.error('ErrorBoundary caught error:', error, errorInfo)
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined })
  }

  private handleReload = () => {
    window.location.reload()
  }

  private handleCopy = async () => {
    const payload = JSON.stringify(
      {
        message: this.state.error?.message,
        stack: this.state.error?.stack,
        componentStack: this.state.errorInfo?.componentStack,
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

    return (
      <div className="mx-auto my-8 w-full max-w-2xl rounded-xl border border-red-200 bg-red-50 p-6 text-red-900 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-100">
        <div className="mb-3 text-lg font-semibold">Terjadi kesalahan</div>
        <p className="mb-4 text-sm opacity-90">
          Maaf, ada masalah saat menampilkan halaman ini. Anda bisa mencoba ulang atau memuat ulang halaman.
        </p>

        <div className="mb-4 rounded-md bg-white p-3 text-xs text-neutral-800 shadow-sm dark:bg-neutral-900 dark:text-neutral-200">
          <pre className="max-h-48 overflow-auto whitespace-pre-wrap">
            {this.state.error?.message || 'Unknown error'}
            {'\n'}
            {this.state.error?.stack}
          </pre>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            onClick={this.handleRetry}
            className="inline-flex items-center rounded-md bg-neutral-900 px-3 py-2 text-sm text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            aria-label="Coba lagi"
          >
            Coba lagi
          </button>
          <button
            onClick={this.handleReload}
            className="inline-flex items-center rounded-md bg-neutral-200 px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-300 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700"
            aria-label="Muat ulang"
          >
            Muat ulang
          </button>
          <button
            onClick={this.handleCopy}
            className="inline-flex items-center rounded-md border border-neutral-300 px-3 py-2 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800"
            aria-label="Salin detail error"
          >
            Salin detail
          </button>
        </div>
      </div>
    )
  }
}

export default ErrorBoundary
