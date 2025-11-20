/**
 * Tooltip Component
 * 
 * Provides contextual help with tooltips.
 * Shows helpful information on hover or focus.
 * 
 * @module Tooltip
 */

import React, { useState } from 'react'
import { cn } from '@/lib/utils'
import { HelpCircle, Info } from 'lucide-react'

export interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
}

export function Tooltip({
  content,
  children,
  side = 'top',
  delay = 200,
  className,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [timeoutId, setTimeoutId] = useState<NodeJS.Timeout | null>(null)

  const showTooltip = () => {
    const id = setTimeout(() => setIsVisible(true), delay)
    setTimeoutId(id)
  }

  const hideTooltip = () => {
    if (timeoutId) {
      clearTimeout(timeoutId)
      setTimeoutId(null)
    }
    setIsVisible(false)
  }

  const sideClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  }

  return (
    <div
      className="relative inline-block"
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onFocus={showTooltip}
      onBlur={hideTooltip}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-50 max-w-xs rounded-md bg-neutral-900 px-3 py-2 text-xs text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900',
            sideClasses[side],
            className
          )}
          role="tooltip"
        >
          {content}
          <div
            className={cn(
              'absolute h-2 w-2 rotate-45 bg-neutral-900 dark:bg-neutral-100',
              side === 'top' && 'bottom-[-4px] left-1/2 -translate-x-1/2',
              side === 'bottom' && 'top-[-4px] left-1/2 -translate-x-1/2',
              side === 'left' && 'right-[-4px] top-1/2 -translate-y-1/2',
              side === 'right' && 'left-[-4px] top-1/2 -translate-y-1/2'
            )}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Help icon with tooltip
 */
export function HelpTooltip({
  content,
  side = 'top',
  className,
}: {
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}) {
  return (
    <Tooltip content={content} side={side}>
      <button
        type="button"
        className={cn(
          'inline-flex items-center justify-center rounded-full text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
          className
        )}
        aria-label="Help"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    </Tooltip>
  )
}

/**
 * Info tooltip
 */
export function InfoTooltip({
  content,
  side = 'top',
  className,
}: {
  content: React.ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}) {
  return (
    <Tooltip content={content} side={side}>
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300',
          className
        )}
      >
        <Info className="h-4 w-4" />
      </span>
    </Tooltip>
  )
}

/**
 * Field tooltip - for form fields
 */
export function FieldTooltip({
  label,
  tooltip,
  required,
  className,
}: {
  label: string
  tooltip?: string
  required?: boolean
  className?: string
}) {
  return (
    <div className={cn('mb-1 flex items-center gap-1', className)}>
      <label className="text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-red-500">*</span>}
      </label>
      {tooltip && <HelpTooltip content={tooltip} />}
    </div>
  )
}
