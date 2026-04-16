import React from 'react';
import { cn } from '@/lib/utils';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

/**
 * SummaryStrip — Compact horizontal metric strip for key KPIs.
 * 
 * Based on: Design System Rules v1 → Layer 4
 * Rules:
 *   - Max 4–6 metrics
 *   - Horizontal, compact, scannable
 *   - Numbers dominant, labels small
 *   - If >6, split into primary + secondary
 */

type SummaryVariant = 'metrics' | 'chips' | 'compact-cards';
type TrendDirection = 'up' | 'down' | 'neutral';

interface SummaryMetric {
  /** Metric label (small text) */
  label: string;
  /** Metric value (dominant text) */
  value: string | number;
  /** Optional delta / change indicator */
  delta?: string;
  /** Trend direction */
  trend?: TrendDirection;
  /** Status color override */
  status?: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  /** Optional click handler for drill-down */
  onClick?: () => void;
}

interface SummaryStripProps {
  /** Metric items (max 6 recommended) */
  items: SummaryMetric[];
  /** Visual variant */
  variant?: SummaryVariant;
  /** Additional class names */
  className?: string;
}

const statusColors: Record<string, string> = {
  success: 'text-emerald-600 dark:text-emerald-400',
  warning: 'text-amber-600 dark:text-amber-400',
  danger: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
  neutral: 'text-[hsl(var(--color-text-tertiary))]',
};

const trendIcons: Record<TrendDirection, React.ReactNode> = {
  up: <TrendingUp className="h-3 w-3" />,
  down: <TrendingDown className="h-3 w-3" />,
  neutral: <Minus className="h-3 w-3" />,
};

const trendColors: Record<TrendDirection, string> = {
  up: 'text-emerald-600 dark:text-emerald-400',
  down: 'text-red-600 dark:text-red-400',
  neutral: 'text-text-semantic-tertiary',
};

function MetricItem({ item, variant }: { item: SummaryMetric; variant: SummaryVariant }) {
  const Wrapper = item.onClick ? 'button' : 'div';

  if (variant === 'chips') {
    return (
      <Wrapper
        onClick={item.onClick}
        className={cn(
          'inline-flex items-center gap-space-2 px-padding-sm py-space-1 shrink-0',
          'rounded-radius-full border border-border-semantic-subtle',
          'bg-surface-panel',
          item.onClick && 'cursor-pointer hover:bg-surface-panel-hover transition-colors duration-normal'
        )}
      >
        <span className="text-size-11 text-text-semantic-tertiary">
          {item.label}
        </span>
        <span className={cn('text-size-13 font-semibold', item.status ? statusColors[item.status] : 'text-text-semantic-primary')}>
          {item.value}
        </span>
      </Wrapper>
    );
  }

  if (variant === 'compact-cards') {
    return (
      <Wrapper
        onClick={item.onClick}
        className={cn(
          'flex flex-col gap-space-1 p-padding-sm shrink-0',
          'rounded-radius-md border border-border-semantic-subtle',
          'bg-surface-panel min-w-[100px]',
          item.onClick && 'cursor-pointer hover:bg-surface-panel-hover hover:border-border-semantic-default transition-all duration-normal'
        )}
      >
        <span className="text-size-11 text-text-semantic-tertiary leading-none">
          {item.label}
        </span>
        <span className={cn('text-size-18 font-semibold leading-none', item.status ? statusColors[item.status] : 'text-text-semantic-primary')}>
          {item.value}
        </span>
        {item.delta && item.trend && (
          <span className={cn('flex items-center gap-0.5 text-size-11', trendColors[item.trend])}>
            {trendIcons[item.trend]}
            {item.delta}
          </span>
        )}
      </Wrapper>
    );
  }

  // Default: 'metrics' variant — inline horizontal metrics
  return (
    <Wrapper
      onClick={item.onClick}
      className={cn(
        'flex flex-col gap-space-1 min-w-[80px] shrink-0',
        item.onClick && 'cursor-pointer hover:opacity-80 transition-opacity duration-normal'
      )}
    >
      <span className="text-size-11 text-text-semantic-tertiary font-medium uppercase tracking-wider leading-none">
        {item.label}
      </span>
      <div className="flex items-baseline gap-space-1">
        <span className={cn('text-size-18 font-semibold leading-none', item.status ? statusColors[item.status] : 'text-text-semantic-primary')}>
          {item.value}
        </span>
        {item.delta && item.trend && (
          <span className={cn('flex items-center gap-0.5 text-size-11', trendColors[item.trend])}>
            {trendIcons[item.trend]}
            {item.delta}
          </span>
        )}
      </div>
    </Wrapper>
  );
}

export function SummaryStrip({
  items,
  variant = 'metrics',
  className,
}: SummaryStripProps) {
  return (
    <div
      className={cn(
        'flex items-start gap-space-4 overflow-x-auto scrollbar-thin pb-space-1',
        variant === 'chips' && 'flex-wrap gap-space-2',
        className
      )}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          <MetricItem item={item} variant={variant} />
          {variant === 'metrics' && i < items.length - 1 && (
            <div className="w-px h-8 bg-border-semantic-subtle shrink-0 self-center" />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

export default SummaryStrip;
