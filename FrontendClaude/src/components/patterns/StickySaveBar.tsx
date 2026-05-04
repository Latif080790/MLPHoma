import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Save, X, GitCompare } from 'lucide-react';

/**
 * StickySaveBar — Unsaved changes bar for edit-heavy modules.
 * 
 * Based on: Design System Rules v1 → Section 13.3
 * Shows when there are pending unsaved changes.
 * Actions: Save Draft, Discard, Compare Changes
 */

interface StickySaveBarProps {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Save handler */
  onSave: () => void;
  /** Discard handler */
  onDiscard: () => void;
  /** Compare changes handler (optional) */
  onCompare?: () => void;
  /** Whether save is in progress */
  isSaving?: boolean;
  /** Custom message */
  message?: string;
  /** Additional class names */
  className?: string;
}

export function StickySaveBar({
  isDirty,
  onSave,
  onDiscard,
  onCompare,
  isSaving = false,
  message = 'You have unsaved changes',
  className,
}: StickySaveBarProps) {
  if (!isDirty) return null;

  return (
    <div
      className={cn(
        'sticky bottom-0 z-[var(--z-sticky)]',
        'flex items-center gap-[var(--space-3)] px-[var(--padding-lg)] py-[var(--space-3)]',
        'border-t bg-amber-50/95 dark:bg-amber-950/95 backdrop-blur-sm',
        'animate-in slide-in-from-bottom-2 duration-200',
        className
      )}
    >
      <span className="text-[var(--font-size-13)] font-[var(--font-weight-medium)] text-amber-800 dark:text-amber-200 flex-1">
        {message}
      </span>

      <div className="flex items-center gap-[var(--space-2)]">
        {onCompare && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCompare}
            className="gap-1.5 text-[var(--font-size-12)] text-amber-700 hover:text-amber-800"
          >
            <GitCompare className="h-3.5 w-3.5" />
            Compare
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          className="gap-1.5 text-[var(--font-size-12)]"
        >
          <X className="h-3.5 w-3.5" />
          Discard
        </Button>
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaving}
          className="gap-1.5 text-[var(--font-size-12)]"
        >
          <Save className="h-3.5 w-3.5" />
          {isSaving ? 'Saving...' : 'Save Draft'}
        </Button>
      </div>
    </div>
  );
}

export default StickySaveBar;
