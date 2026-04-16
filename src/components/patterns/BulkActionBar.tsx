import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

/**
 * BulkActionBar — Replaces toolbar when multi-selection is active.
 * 
 * Based on: Component Specification v1 → Section 5.5
 * Behavior:
 *   - Shows selected count and available bulk actions
 *   - Replaces normal toolbar when active
 *   - Clear selection action always available
 */

interface BulkAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface BulkActionBarProps {
  /** Number of selected items */
  selectedCount: number;
  /** Available bulk actions */
  actions: BulkAction[];
  /** Clear selection handler */
  onClear: () => void;
  /** Additional class names */
  className?: string;
}

export function BulkActionBar({
  selectedCount,
  actions,
  onClear,
  className,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'flex items-center gap-[var(--space-3)] px-[var(--padding-md)] py-[var(--space-2)]',
        'rounded-[var(--radius-md)] border border-primary/20 bg-primary/5',
        'animate-in slide-in-from-top-2 duration-200',
        className
      )}
    >
      {/* Selected count */}
      <div className="flex items-center gap-[var(--space-2)] shrink-0">
        <span className="text-[var(--font-size-13)] font-[var(--font-weight-semibold)] text-primary">
          {selectedCount} selected
        </span>
        <button
          onClick={onClear}
          className="p-0.5 rounded-[var(--radius-xs)] hover:bg-primary/10 transition-colors duration-[var(--motion-duration-fast)]"
          aria-label="Clear selection"
        >
          <X className="h-3.5 w-3.5 text-primary" />
        </button>
      </div>

      {/* Separator */}
      <div className="w-px h-5 bg-primary/20 shrink-0" />

      {/* Bulk actions */}
      <div className="flex items-center gap-[var(--space-1)]">
        {actions.map((action, i) => (
          <Button
            key={i}
            variant={action.variant === 'destructive' ? 'destructive' : 'outline'}
            size="sm"
            onClick={action.onClick}
            disabled={action.disabled}
            className="h-7 gap-1.5 text-[var(--font-size-12)]"
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </div>
    </div>
  );
}

export default BulkActionBar;
