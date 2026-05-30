import React from 'react';
import { cn } from '@/lib/utils';
import { AlertTriangle, Info, XCircle, Lock, CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * AlertStrip — Page/section-level state messaging.
 * 
 * Based on: Design System Rules v1 → Section 12
 * Use for:
 *   - Locked baseline
 *   - Sync failed
 *   - Validation issues
 *   - Pending approvals
 *   - Stale data
 */

type AlertSeverity = 'info' | 'success' | 'warning' | 'danger' | 'locked';

interface AlertAction {
  label: string;
  onClick: () => void;
}

interface AlertStripProps {
  /** Severity level */
  severity: AlertSeverity;
  /** Short message */
  message: string;
  /** Optional action button */
  action?: AlertAction;
  /** Whether dismissible */
  dismissible?: boolean;
  /** Dismiss handler */
  onDismiss?: () => void;
  /** Additional class names */
  className?: string;
}

const severityConfig: Record<AlertSeverity, { icon: React.ReactNode; classes: string }> = {
  info: {
    icon: <Info className="h-4 w-4 shrink-0" />,
    classes: 'bg-orange-50 border-orange-200 text-orange-800 dark:bg-orange-950/40 dark:border-orange-800 dark:text-orange-200',
  },
  success: {
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" />,
    classes: 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/50 dark:border-emerald-800 dark:text-emerald-200',
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 shrink-0" />,
    classes: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/50 dark:border-amber-800 dark:text-amber-200',
  },
  danger: {
    icon: <XCircle className="h-4 w-4 shrink-0" />,
    classes: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-950/50 dark:border-red-800 dark:text-red-200',
  },
  locked: {
    icon: <Lock className="h-4 w-4 shrink-0" />,
    classes: 'bg-muted/50 border-border text-muted-foreground',
  },
};

export function AlertStrip({
  severity,
  message,
  action,
  dismissible = false,
  onDismiss,
  className,
}: AlertStripProps) {
  const config = severityConfig[severity];

  return (
    <div
      className={cn(
        'flex items-center gap-[var(--space-2)] px-[var(--padding-sm)] py-[var(--space-2)]',
        'rounded-[var(--radius-sm)] border',
        'text-[var(--font-size-13)]',
        config.classes,
        className
      )}
      role="alert"
    >
      {config.icon}
      <span className="flex-1 font-[var(--font-weight-medium)] line-clamp-1">
        {message}
      </span>
      {action && (
        <button
          onClick={action.onClick}
          className="shrink-0 text-[var(--font-size-12)] font-[var(--font-weight-semibold)] underline underline-offset-2 hover:no-underline transition-all duration-[var(--motion-duration-fast)]"
        >
          {action.label}
        </button>
      )}
      {dismissible && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition-colors duration-[var(--motion-duration-fast)]"
          aria-label="Dismiss"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

export default AlertStrip;
