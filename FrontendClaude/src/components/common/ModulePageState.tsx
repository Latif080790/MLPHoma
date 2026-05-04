import React from 'react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { EmptyState, ErrorState } from '@/components/common/EmptyState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'

interface ModulePageStateProps {
  title: string
  description?: string
  icon?: React.ReactNode
  variant: 'loading' | 'error' | 'empty'
  message?: string
  onRetry?: () => void
  /** Optional CTA rendered inside the empty state */
  action?: React.ReactNode
}

export function ModulePageState({ title, description, icon, variant, message, onRetry, action }: ModulePageStateProps) {
  return (
    <div className="space-y-6">
      <ModuleHeader icon={icon} title={title} description={description} />

      {variant === 'loading' ? (
        <div className="rounded-xl border bg-white p-10 dark:border-neutral-800 dark:bg-neutral-900">
          <div className="flex justify-center">
            <LoadingSpinner size="lg" text={message || 'Loading data...'} />
          </div>
        </div>
      ) : null}

      {variant === 'empty' ? (
        <EmptyState
          title="No Data Available"
          description={message || 'Please select a project or add initial data to continue.'}
          actions={action}
        />
      ) : null}

      {variant === 'error' ? (
        <ErrorState
          title="Failed to Load Data"
          description={message || 'An error occurred while fetching module data.'}
          onRetry={onRetry}
        />
      ) : null}
    </div>
  )
}

export default ModulePageState
