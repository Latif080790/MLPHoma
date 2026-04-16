import React from 'react';
import { cn } from '@/lib/utils';

/**
 * PageShell v3 — Standard page anatomy wrapper for all MLPHoma modules.
 *
 * Implements the 7-layer page anatomy:
 *   L1: GlobalContextBar
 *   L2: Workflow / Mode Navigation
 *   L3: Workspace Header
 *   L4: Compact Summary Strip
 *   L5: Smart Toolbar
 *   L6: Alert Strip (optional)
 *   L7: Main Work Surface + Inspector Drawer
 *
 * Key fixes over v2:
 *   - ContextBar is NOT sticky (AppShell header is already sticky)
 *   - Uses standard Tailwind classes only (no broken CSS var in arbitrary values)
 *   - Padding is handled here, not in AppShell
 */

interface PageShellProps {
  contextBar?: React.ReactNode;
  navigation?: React.ReactNode;
  header?: React.ReactNode;
  summary?: React.ReactNode;
  toolbar?: React.ReactNode;
  alert?: React.ReactNode;
  inspector?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  isLoading?: boolean;
  loadingSkeleton?: React.ReactNode;
}

export function PageShell({
  contextBar,
  navigation,
  header,
  summary,
  toolbar,
  alert,
  inspector,
  children,
  className,
  isLoading,
  loadingSkeleton,
}: PageShellProps) {
  if (isLoading && loadingSkeleton) {
    return (
      <div className={cn('flex flex-col min-h-0 flex-1', className)}>
        {contextBar && (
          <div className="shrink-0 border-b border-slate-200 dark:border-slate-800">
            {contextBar}
          </div>
        )}
        <div className="flex-1 overflow-auto p-4 lg:p-6">
          {loadingSkeleton}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col min-h-0 flex-1 bg-surface-page', className)}>
      {/* L1: Context Bar — static, not sticky */}
      {contextBar && (
        <div className="shrink-0 border-b border-border-semantic-subtle">
          {contextBar}
        </div>
      )}

      {/* Scrollable content */}
      <div className="flex-1 overflow-auto overflow-x-hidden">
        <div className="flex flex-col gap-space-3 p-padding-md lg:p-padding-lg">
          {/* L2: Navigation (ModeSwitch / WorkflowStepper) */}
          {navigation && <div className="shrink-0">{navigation}</div>}

          {/* L3: Workspace Header */}
          {header && <div className="shrink-0">{header}</div>}

          {/* L4: Summary Strip */}
          {summary && <div className="shrink-0">{summary}</div>}

          {/* Alert Strip */}
          {alert && <div className="shrink-0">{alert}</div>}

          {/* L5: Toolbar */}
          {toolbar && (
            <div className="sticky top-14 z-sticky shrink-0 -mx-padding-md lg:-mx-padding-lg px-padding-md lg:px-padding-lg py-space-1 bg-surface-panel/95 backdrop-blur-sm shadow-sm border-b border-border-semantic-subtle">
              {toolbar}
            </div>
          )}

          {/* L6+L7: Main Surface + Inspector */}
          <div className="flex gap-space-4 flex-1 min-h-0">
            <div className="flex-1 min-w-0">
              {children}
            </div>
            {inspector && (
              <div className="hidden lg:block shrink-0 w-inspector-default">
                {inspector}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default PageShell;
