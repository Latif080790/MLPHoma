import React from 'react';
import { cn } from '@/lib/utils';

/**
 * ThreePanelLayout — For WBS tree + workspace + inspector, 
 * or documents list + preview + metadata patterns.
 * 
 * Responsive behavior:
 *   - Desktop (xl+): 3 panels side-by-side
 *   - Tablet (lg):    2 panels, inspector hidden/drawer
 *   - Mobile (<lg):   single panel, others in drawers/sheets
 */

interface ThreePanelLayoutProps {
  /** Left panel — tree navigator, list, etc. */
  left: React.ReactNode;
  /** Center panel — main workspace / content */
  center: React.ReactNode;
  /** Right panel — inspector / metadata */
  right?: React.ReactNode;
  /** Width of left panel (default: 280px) */
  leftWidth?: number;
  /** Width of right panel (default: 380px) */
  rightWidth?: number;
  /** Whether the right panel is open */
  rightOpen?: boolean;
  /** Additional class names */
  className?: string;
}

export function ThreePanelLayout({
  left,
  center,
  right,
  leftWidth = 280,
  rightWidth = 380,
  rightOpen = true,
  className,
}: ThreePanelLayoutProps) {
  return (
    <div className={cn('flex gap-[var(--space-3)] min-h-0 flex-1', className)}>
      {/* Left Panel — Tree / List */}
      <div
        className="hidden lg:flex shrink-0 flex-col min-h-0 overflow-auto rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-default))] bg-[hsl(var(--color-surface-panel))]"
        style={{ width: leftWidth }}
      >
        {left}
      </div>

      {/* Center Panel — Main Workspace */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col">
        {center}
      </div>

      {/* Right Panel — Inspector */}
      {right && rightOpen && (
        <div
          className="hidden xl:flex shrink-0 flex-col min-h-0 overflow-auto rounded-[var(--radius-lg)] border border-[hsl(var(--color-border-default))] bg-[hsl(var(--color-surface-panel))]"
          style={{ width: rightWidth }}
        >
          {right}
        </div>
      )}
    </div>
  );
}

export default ThreePanelLayout;
