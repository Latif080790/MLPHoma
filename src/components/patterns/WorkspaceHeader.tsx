import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { MoreHorizontal } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * WorkspaceHeader — Orientation point for each workspace / submodule.
 * 
 * Based on: Design System Rules v1 → Layer 3
 * Rules:
 *   - 1 primary CTA max
 *   - 2–3 secondary actions visible
 *   - Overflow for the rest
 *   - Title + 1-line subtitle (operational, not marketing)
 */

interface WorkspaceAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
}

interface WorkspaceHeaderProps {
  /** Module/submodule title */
  title: string;
  /** 1-line operational subtitle */
  subtitle?: string;
  /** Primary CTA — the ONE main action */
  primaryAction?: WorkspaceAction;
  /** Secondary visible actions (max 2–3) */
  secondaryActions?: WorkspaceAction[];
  /** Overflow actions */
  overflowActions?: WorkspaceAction[];
  /** Optional breadcrumb or path indicator */
  breadcrumb?: React.ReactNode;
  /** Custom content to render before actions (e.g. avatars) */
  extraContent?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

export function WorkspaceHeader({
  title,
  subtitle,
  primaryAction,
  secondaryActions = [],
  overflowActions = [],
  breadcrumb,
  extraContent,
  className,
}: WorkspaceHeaderProps) {
  return (
    <div className={cn('flex flex-col gap-space-1', className)}>
      {/* Breadcrumb */}
      {breadcrumb && (
        <div className="text-size-12 text-text-semantic-tertiary">
          {breadcrumb}
        </div>
      )}

      {/* Title row */}
      <div className="flex items-center gap-space-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-size-20 font-semibold text-text-semantic-primary leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-size-13 text-text-semantic-secondary leading-normal mt-space-1 line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>

        {/* Actions & Extra Content */}
        <div className="flex items-center gap-space-2 shrink-0">
          {extraContent && (
            <div className="flex items-center gap-space-2 animate-in fade-in duration-300 mr-space-2">
              {extraContent}
              <div className="h-4 w-px bg-border-default/50 dark:bg-border-subtle" />
            </div>
          )}
          {/* Secondary actions */}
          {secondaryActions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant === 'default' ? 'default' : 'outline'}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              className="hidden sm:inline-flex gap-1.5 text-size-13"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}

          {/* Primary action */}
          {primaryAction && (
            <Button
              size="sm"
              onClick={primaryAction.onClick}
              disabled={primaryAction.disabled}
              className="gap-1.5 text-size-13"
            >
              {primaryAction.icon}
              {primaryAction.label}
            </Button>
          )}

          {/* Overflow */}
          {overflowActions.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[160px]">
                {overflowActions.map((action, i) => (
                  <DropdownMenuItem
                    key={i}
                    onClick={action.onClick}
                    disabled={action.disabled}
                    className={cn(
                      'gap-2 text-size-13',
                      action.variant === 'destructive' && 'text-red-600'
                    )}
                  >
                    {action.icon}
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}

export default WorkspaceHeader;
