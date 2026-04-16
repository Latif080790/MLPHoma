import React from 'react';
import { cn } from '@/lib/utils';

/**
 * SplitLayout — Two-panel layout for list+detail, chart+ledger, or timeline+inspector.
 * 
 * Responsive behavior:
 *   - Desktop (lg+): side-by-side panels
 *   - Tablet/Mobile (<lg): stacked panels
 */

interface SplitLayoutProps {
  /** Left/top panel — primary content */
  primary: React.ReactNode;
  /** Right/bottom panel — secondary/detail content */
  secondary: React.ReactNode;
  /** Split ratio for the primary panel (default: 60%) */
  primaryRatio?: number;
  /** Additional class names */
  className?: string;
  /** Direction override: 'horizontal' (default) or 'vertical' */
  direction?: 'horizontal' | 'vertical';
}

export function SplitLayout({
  primary,
  secondary,
  primaryRatio = 60,
  className,
  direction = 'horizontal',
}: SplitLayoutProps) {
  const isHorizontal = direction === 'horizontal';
  
  return (
    <div
      className={cn(
        'flex gap-[var(--space-4)] min-h-0',
        isHorizontal ? 'flex-col lg:flex-row' : 'flex-col',
        className
      )}
    >
      <div
        className={cn('min-w-0 min-h-0', isHorizontal && 'flex-1')}
        style={isHorizontal ? { flex: `${primaryRatio} 1 0%` } : undefined}
      >
        {primary}
      </div>
      <div
        className={cn('min-w-0 min-h-0', isHorizontal && 'flex-1')}
        style={isHorizontal ? { flex: `${100 - primaryRatio} 1 0%` } : undefined}
      >
        {secondary}
      </div>
    </div>
  );
}

export default SplitLayout;
