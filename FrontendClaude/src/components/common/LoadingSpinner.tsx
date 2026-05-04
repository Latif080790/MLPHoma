/**
 * Loading Spinner Components
 * 
 * Provides various loading spinner styles for different contexts.
 * Use for inline loading states and async operations.
 * 
 * @module LoadingSpinner
 */

import React from 'react'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
  text?: string
}

/**
 * Default loading spinner
 */
export function LoadingSpinner({ size = 'md', className, text }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Loader2 className={cn('animate-spin text-neutral-600 dark:text-neutral-400', sizeClasses[size])} />
      {text && <span className="text-sm text-neutral-600 dark:text-neutral-400">{text}</span>}
    </div>
  )
}

/**
 * Full page loading overlay
 */
export function LoadingOverlay({ text = 'Memuat...' }: { text?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm dark:bg-neutral-950/80">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-12 w-12 animate-spin text-neutral-900 dark:text-neutral-100" />
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{text}</p>
      </div>
    </div>
  )
}

/**
 * Inline loading state
 */
export function InlineLoading({ text = 'Memuat...' }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <LoadingSpinner size="md" text={text} />
    </div>
  )
}

/**
 * Button loading state
 */
export function ButtonLoading() {
  return <Loader2 className="h-4 w-4 animate-spin" />
}

/**
 * Dots loading animation
 */
export function DotsLoading({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      <div className="h-2 w-2 animate-bounce rounded-full bg-neutral-600 dark:bg-neutral-400" style={{ animationDelay: '0ms' }} />
      <div className="h-2 w-2 animate-bounce rounded-full bg-neutral-600 dark:bg-neutral-400" style={{ animationDelay: '150ms' }} />
      <div className="h-2 w-2 animate-bounce rounded-full bg-neutral-600 dark:bg-neutral-400" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

/**
 * Progress bar loading
 */
export function ProgressLoading({ progress, text }: { progress: number; text?: string }) {
  return (
    <div className="w-full space-y-2">
      {text && <p className="text-sm text-neutral-600 dark:text-neutral-400">{text}</p>}
      <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <div
          className="h-full bg-neutral-900 transition-all duration-300 dark:bg-neutral-100"
          style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
        />
      </div>
      <p className="text-xs text-right text-neutral-500 dark:text-neutral-500">{Math.round(progress)}%</p>
    </div>
  )
}

/**
 * Pulse loading animation
 */
export function PulseLoading({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="h-3 w-3 animate-pulse rounded-full bg-neutral-600 dark:bg-neutral-400" />
      <div className="h-3 w-3 animate-pulse rounded-full bg-neutral-600 dark:bg-neutral-400" style={{ animationDelay: '150ms' }} />
      <div className="h-3 w-3 animate-pulse rounded-full bg-neutral-600 dark:bg-neutral-400" style={{ animationDelay: '300ms' }} />
    </div>
  )
}

/**
 * Card loading state
 */
export function CardLoading({ title = 'Memuat data...' }: { title?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-950">
      <Loader2 className="h-10 w-10 animate-spin text-neutral-600 dark:text-neutral-400" />
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">{title}</p>
    </div>
  )
}

/**
 * Table loading state
 */
export function TableLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="h-8 w-8 animate-spin text-neutral-600 dark:text-neutral-400" />
      <p className="mt-3 text-sm text-neutral-600 dark:text-neutral-400">Memuat data tabel...</p>
    </div>
  )
}
