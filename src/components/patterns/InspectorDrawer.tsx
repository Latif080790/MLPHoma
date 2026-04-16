import React from 'react';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

/**
 * InspectorDrawer — Right-side detail panel for viewing record details
 * without leaving the main work surface context.
 * 
 * Based on: Design System Rules v1 → Section 9 + Component Specification v1 → Section 7.1
 * 
 * Structure:
 *   - Header (item title + status + close)
 *   - Meta (key metadata)
 *   - Tabs (Details / Links / History / Notes)
 *   - Footer actions
 * 
 * Responsive:
 *   - Desktop (lg+): inline right panel
 *   - Tablet/Mobile (<lg): Sheet/slide-over
 */

interface InspectorTab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  content: React.ReactNode;
  badge?: number;
}

interface InspectorAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  disabled?: boolean;
}

interface InspectorDrawerProps {
  /** Whether the inspector is open */
  open: boolean;
  /** Open state change handler */
  onOpenChange: (open: boolean) => void;
  /** Inspector title (item name) */
  title: string;
  /** Subtitle or status */
  subtitle?: string;
  /** Status badge */
  statusBadge?: React.ReactNode;
  /** Key metadata displayed below title */
  metadata?: React.ReactNode;
  /** Tab panels */
  tabs: InspectorTab[];
  /** Default active tab ID */
  defaultTab?: string;
  /** Footer actions */
  footerActions?: InspectorAction[];
  /** Header actions (edit, more, etc.) */
  headerActions?: React.ReactNode;
  /** Additional class names */
  className?: string;
}

function InspectorContent({
  title,
  subtitle,
  statusBadge,
  metadata,
  tabs,
  defaultTab,
  footerActions,
  headerActions,
  onClose,
}: InspectorDrawerProps & { onClose: () => void }) {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start gap-[var(--space-3)] p-[var(--padding-md)] border-b shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-[var(--space-2)]">
            <h3 className="text-[var(--font-size-14)] font-[var(--font-weight-semibold)] text-[hsl(var(--color-text-primary))] truncate">
              {title}
            </h3>
            {statusBadge}
          </div>
          {subtitle && (
            <p className="text-[var(--font-size-12)] text-[hsl(var(--color-text-secondary))] mt-[var(--space-1)] line-clamp-1">
              {subtitle}
            </p>
          )}
        </div>
        <div className="flex items-center gap-[var(--space-1)] shrink-0">
          {headerActions}
          <button
            onClick={onClose}
            className="p-1 rounded-[var(--radius-xs)] hover:bg-muted transition-colors duration-[var(--motion-duration-fast)]"
            aria-label="Close inspector"
          >
            <X className="h-4 w-4 text-[hsl(var(--color-icon-secondary))]" />
          </button>
        </div>
      </div>

      {/* Metadata */}
      {metadata && (
        <div className="px-[var(--padding-md)] py-[var(--space-3)] border-b shrink-0">
          {metadata}
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue={defaultTab || tabs[0]?.id} className="flex-1 min-h-0 flex flex-col">
        <TabsList className="px-[var(--padding-md)] pt-[var(--space-2)] justify-start bg-transparent border-b rounded-none h-auto shrink-0">
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              className="text-[var(--font-size-12)] data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none pb-2 gap-1"
            >
              {tab.icon}
              {tab.label}
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span className="ml-0.5 text-[10px] bg-muted px-1 rounded-full">
                  {tab.badge}
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
        
        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="flex-1 overflow-auto px-[var(--padding-md)] py-[var(--space-3)] mt-0"
          >
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>

      {/* Footer Actions */}
      {footerActions && footerActions.length > 0 && (
        <div className="flex items-center gap-[var(--space-2)] p-[var(--padding-md)] border-t shrink-0">
          {footerActions.map((action, i) => (
            <Button
              key={i}
              variant={action.variant === 'default' ? 'default' : (action.variant as any) || 'outline'}
              size="sm"
              onClick={action.onClick}
              disabled={action.disabled}
              className="gap-1.5 text-[var(--font-size-12)]"
            >
              {action.icon}
              {action.label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}

export function InspectorDrawer(props: InspectorDrawerProps) {
  const { open, onOpenChange, className } = props;

  return (
    <>
      {/* Desktop: inline panel (handled by parent layout, e.g., PageShell or ThreePanelLayout) */}
      {/* This renders the content when used inline */}
      <div className={cn('hidden lg:flex flex-col h-full', !open && 'hidden', className)}>
        {open && (
          <InspectorContent {...props} onClose={() => onOpenChange(false)} />
        )}
      </div>

      {/* Tablet/Mobile: Sheet slide-over */}
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[420px] p-0 lg:hidden">
          <InspectorContent {...props} onClose={() => onOpenChange(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

export default InspectorDrawer;
