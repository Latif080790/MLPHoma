import React from 'react';
import { cn } from '@/lib/utils';

/**
 * ModeSwitch — Segmented switch for toggling between modes/views.
 * 
 * Based on: Component Specification v1 → Section 3.4
 * Use for:
 *   - Executive / Operations
 *   - Plan / Track / Analyze
 *   - Repository / Control / Review
 *   - Direct Cost / Overhead / Summary / Comparison
 * 
 * Rules:
 *   - Max 4–5 visible options
 *   - Short labels
 *   - Active state high contrast
 */

interface ModeSwitchOption<T extends string = string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  /** Badge count */
  count?: number;
  disabled?: boolean;
}

interface ModeSwitchProps<T extends string = string> {
  /** Available options */
  options: ModeSwitchOption<T>[];
  /** Currently active value */
  value: T;
  /** Change handler */
  onChange: (value: T) => void;
  /** Size variant */
  size?: 'sm' | 'md';
  /** Additional class names */
  className?: string;
}

export function ModeSwitch<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
  className,
}: ModeSwitchProps<T>) {
  return (
    <div
      className={cn(
        'inline-flex items-center rounded-radius-md bg-surface-page border border-border-semantic-subtle p-space-1 gap-space-0.5',
        className
      )}
      role="tablist"
    >
      {options.map((option) => {
        const isActive = option.value === value;
        return (
          <button
            key={option.value}
            role="tab"
            aria-selected={isActive}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative inline-flex items-center gap-1.5 rounded-radius-sm font-medium transition-all duration-normal whitespace-nowrap',
              size === 'sm'
                ? 'px-padding-xs py-space-1 text-size-12'
                : 'px-padding-sm py-space-2 text-size-13',
              isActive
                ? 'bg-surface-panel text-text-semantic-primary shadow-shadow-sm'
                : 'text-text-semantic-secondary hover:text-text-semantic-primary hover:bg-surface-panel-hover',
              option.disabled && 'opacity-disabled cursor-not-allowed'
            )}
          >
            {option.icon}
            <span>{option.label}</span>
            {typeof option.count === 'number' && (
              <span
                className={cn(
                  'ml-0.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-radius-full text-size-11',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-surface-page text-text-semantic-tertiary'
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export default ModeSwitch;
