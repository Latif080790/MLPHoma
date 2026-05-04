import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Check, AlertTriangle, Lock, ChevronRight } from 'lucide-react';

/**
 * WorkflowStepper — Process stepper for dependency-based workflows.
 * 
 * Based on: Component Specification v1 → Section 3.3
 * Use for:
 *   - AHSP → WBS → RAB → RAP → Resource (Costing pipeline)
 *   - Approval stages
 *   - Phase-based workflows
 * 
 * States per step: inactive, active, complete, warning, blocked, locked
 */

type StepStatus = 'inactive' | 'active' | 'complete' | 'warning' | 'blocked' | 'locked';

interface WorkflowStep {
  id: string;
  title: string;
  icon?: React.ReactNode;
  count?: number;
  status: StepStatus;
  description?: string;
}

interface WorkflowStepperProps {
  /** Steps in the workflow */
  steps: WorkflowStep[];
  /** Currently active step ID */
  activeStepId: string;
  /** Step click handler */
  onStepClick: (stepId: string) => void;
  /** Additional class names */
  className?: string;
}

const statusStyles: Record<StepStatus, { bg: string; text: string; border: string; indicator: React.ReactNode }> = {
  inactive: {
    bg: 'bg-surface-page',
    text: 'text-text-semantic-tertiary',
    border: 'border-border-semantic-subtle',
    indicator: null,
  },
  active: {
    bg: 'bg-primary/5',
    text: 'text-primary',
    border: 'border-primary/30',
    indicator: null,
  },
  complete: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    border: 'border-emerald-200 dark:border-emerald-800',
    indicator: <Check className="h-3.5 w-3.5" />,
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    text: 'text-amber-700 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
    indicator: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  blocked: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    text: 'text-red-700 dark:text-red-400',
    border: 'border-red-200 dark:border-red-800',
    indicator: <AlertTriangle className="h-3.5 w-3.5" />,
  },
  locked: {
    bg: 'bg-slate-100 dark:bg-slate-800/30',
    text: 'text-text-semantic-disabled',
    border: 'border-border-semantic-subtle',
    indicator: <Lock className="h-3.5 w-3.5" />,
  },
};

export function WorkflowStepper({
  steps,
  activeStepId,
  onStepClick,
  className,
}: WorkflowStepperProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-space-1 overflow-x-auto scrollbar-thin pb-space-1',
        className
      )}
      role="tablist"
    >
      {steps.map((step, index) => {
        const isActive = step.id === activeStepId;
        const style = statusStyles[step.status];

        return (
          <React.Fragment key={step.id}>
            {index > 0 && (
              <ChevronRight className="h-4 w-4 shrink-0 text-text-semantic-disabled" />
            )}
            <button
              role="tab"
              aria-selected={isActive}
              onClick={() => onStepClick(step.id)}
              title={step.description}
              className={cn(
                'flex items-center gap-space-2 px-padding-sm py-space-2',
                'rounded-radius-md border shrink-0',
                'text-size-13 font-medium',
                'transition-all duration-normal',
                style.bg,
                style.border,
                isActive
                  ? 'ring-2 ring-primary/20 shadow-shadow-sm'
                  : 'hover:shadow-shadow-xs hover:border-border-semantic-default',
                step.status === 'locked' && 'cursor-not-allowed opacity-disabled'
              )}
            >
              {/* Step icon */}
              {step.icon && (
                <span className={cn('shrink-0', style.text)}>{step.icon}</span>
              )}

              {/* Step title */}
              <span className={cn(
                isActive ? 'text-text-semantic-primary' : style.text
              )}>
                {step.title}
              </span>

              {/* Count badge */}
              {typeof step.count === 'number' && (
                <Badge
                  variant="secondary"
                  className={cn('text-size-11 h-5 min-w-[20px] px-1.5', style.text)}
                >
                  {step.count}
                </Badge>
              )}

              {/* Status indicator */}
              {style.indicator && (
                <span className={cn('shrink-0', style.text)}>
                  {style.indicator}
                </span>
              )}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
}

export default WorkflowStepper;
