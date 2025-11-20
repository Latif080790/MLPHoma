/**
 * Retry Button Component
 * 
 * Displays a retry button with loading state and retry count.
 * Can be used standalone or integrated with error states.
 * 
 * @module RetryButton
 */

import React from 'react'
import { RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface RetryButtonProps {
  onRetry: () => void | Promise<void>
  isRetrying?: boolean
  retryCount?: number
  maxRetries?: number
  disabled?: boolean
  className?: string
  variant?: 'default' | 'outline' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  showCount?: boolean
}

export function RetryButton({
  onRetry,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  disabled = false,
  className,
  variant = 'default',
  size = 'md',
  showCount = true,
}: RetryButtonProps) {
  const canRetry = retryCount < maxRetries && !isRetrying && !disabled

  const baseClasses = 'inline-flex items-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  const variantClasses = {
    default: 'bg-neutral-900 text-white hover:bg-neutral-800 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white disabled:opacity-50',
    outline: 'border border-neutral-300 hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-800 disabled:opacity-50',
    ghost: 'hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50',
  }

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2 text-base',
  }

  return (
    <button
      onClick={onRetry}
      disabled={!canRetry}
      className={cn(baseClasses, variantClasses[variant], sizeClasses[size], className)}
      aria-label="Coba lagi"
    >
      <RefreshCw className={cn('h-4 w-4', isRetrying && 'animate-spin')} />
      <span>
        {isRetrying ? 'Mencoba ulang...' : 'Coba Lagi'}
        {showCount && retryCount > 0 && ` (${retryCount}/${maxRetries})`}
      </span>
    </button>
  )
}

/**
 * Retry card - shows error with retry button
 */
export interface RetryCardProps {
  error: Error | string
  onRetry: () => void | Promise<void>
  isRetrying?: boolean
  retryCount?: number
  maxRetries?: number
  title?: string
}

export function RetryCard({
  error,
  onRetry,
  isRetrying = false,
  retryCount = 0,
  maxRetries = 3,
  title = 'Terjadi Kesalahan',
}: RetryCardProps) {
  const errorMessage = typeof error === 'string' ? error : error.message

  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900/40 dark:bg-red-950/40">
      <div className="mb-3 flex items-start gap-3">
        <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/40">
          <RefreshCw className="h-5 w-5 text-red-600 dark:text-red-400" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-red-900 dark:text-red-100">{title}</h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <RetryButton
          onRetry={onRetry}
          isRetrying={isRetrying}
          retryCount={retryCount}
          maxRetries={maxRetries}
          variant="outline"
          size="sm"
        />
        {retryCount >= maxRetries && (
          <span className="text-xs text-red-600 dark:text-red-400">
            Maksimum percobaan tercapai
          </span>
        )}
      </div>
    </div>
  )
}

/**
 * Inline retry - minimal retry UI
 */
export interface InlineRetryProps {
  onRetry: () => void | Promise<void>
  isRetrying?: boolean
  message?: string
}

export function InlineRetry({
  onRetry,
  isRetrying = false,
  message = 'Gagal memuat data.',
}: InlineRetryProps) {
  return (
    <div className="flex items-center justify-center gap-2 py-4">
      <span className="text-sm text-neutral-600 dark:text-neutral-400">{message}</span>
      <button
        onClick={onRetry}
        disabled={isRetrying}
        className="inline-flex items-center gap-1 text-sm font-medium text-neutral-900 hover:underline dark:text-neutral-100 disabled:opacity-50"
      >
        <RefreshCw className={cn('h-3 w-3', isRetrying && 'animate-spin')} />
        {isRetrying ? 'Mencoba...' : 'Coba lagi'}
      </button>
    </div>
  )
}
