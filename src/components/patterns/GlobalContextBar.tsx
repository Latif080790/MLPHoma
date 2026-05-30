import React from 'react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Cloud,
  CloudOff,
} from 'lucide-react';

/**
 * GlobalContextBar — Sticky context bar showing active project, version, sync, health.
 * 
 * Based on: Design System Rules v1 → Layer 1
 * Purpose: Reduce header repetition, keep user aware of working context.
 * Placement: Sticky below app header, always visible when scrolling.
 */

type SyncStatus = 'synced' | 'syncing' | 'error' | 'offline';
type HealthLevel = 'good' | 'warning' | 'critical';

interface HealthItem {
  label: string;
  level: HealthLevel;
  value?: string;
}

interface ContextAction {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'outline' | 'ghost';
}

interface GlobalContextBarProps {
  /** Active project name */
  projectName: string;
  /** Package or portfolio name */
  packageName?: string;
  /** Version / baseline / draft label */
  versionLabel?: string;
  /** Sync status */
  syncStatus?: SyncStatus;
  /** Health indicators */
  healthItems?: HealthItem[];
  /** Context actions (compare, publish, export) */
  actions?: ContextAction[];
  /** Whether the context is read-only */
  isReadOnly?: boolean;
  /** Whether the context has draft changes */
  hasDraftChanges?: boolean;
  /** Additional class names */
  className?: string;
}

const syncIcons: Record<SyncStatus, React.ReactNode> = {
  synced: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />,
  syncing: <RefreshCw className="h-3.5 w-3.5 text-primary animate-spin" />,
  error: <XCircle className="h-3.5 w-3.5 text-red-500" />,
  offline: <CloudOff className="h-3.5 w-3.5 text-amber-500" />,
};

const syncLabels: Record<SyncStatus, string> = {
  synced: 'Synced',
  syncing: 'Syncing...',
  error: 'Sync Failed',
  offline: 'Offline',
};

const healthColors: Record<HealthLevel, string> = {
  good: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20 dark:text-emerald-400',
  warning: 'bg-amber-500/10 text-amber-700 border-amber-500/20 dark:text-amber-400',
  critical: 'bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400',
};

export function GlobalContextBar({
  projectName,
  packageName,
  versionLabel,
  syncStatus = 'synced',
  healthItems = [],
  actions = [],
  isReadOnly = false,
  hasDraftChanges = false,
  className,
}: GlobalContextBarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-space-3 px-padding-md lg:px-padding-lg py-space-2',
        'bg-surface-subtle/80 backdrop-blur-sm',
        'text-size-12',
        className
      )}
    >
      {/* Project / Package Context */}
      <div className="flex items-center gap-space-2 min-w-0 shrink-0">
        <span className="font-semibold text-text-semantic-primary truncate max-w-[200px]">
          {projectName}
        </span>
        {packageName && (
          <>
            <span className="text-text-semantic-tertiary">/</span>
            <span className="text-text-semantic-secondary truncate max-w-[150px]">
              {packageName}
            </span>
          </>
        )}
      </div>

      {/* Version / Draft label */}
      {versionLabel && (
        <Badge variant="outline" className="shrink-0 text-size-11">
          {versionLabel}
        </Badge>
      )}

      {/* Draft Changes indicator */}
      {hasDraftChanges && (
        <Badge className="shrink-0 text-size-11 bg-amber-500/10 text-amber-700 border-amber-500/20 hover:bg-amber-500/20">
          Draft Changed
        </Badge>
      )}

      {/* Read-only indicator */}
      {isReadOnly && (
        <Badge variant="secondary" className="shrink-0 text-size-11">
          Read-only
        </Badge>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Health indicators */}
      {healthItems.length > 0 && (
        <div className="hidden md:flex items-center gap-space-2">
          {healthItems.map((item, i) => (
            <div
              key={i}
              className={cn(
                'flex items-center gap-1 px-2 py-0.5 rounded-radius-full border text-size-11 font-medium',
                healthColors[item.level]
              )}
            >
              <span>{item.label}</span>
              {item.value && <span className="font-semibold">{item.value}</span>}
            </div>
          ))}
        </div>
      )}

      {/* Sync status */}
      <div className="flex items-center gap-1 shrink-0 text-size-12 text-text-semantic-tertiary">
        {syncIcons[syncStatus]}
        <span className="hidden sm:inline">{syncLabels[syncStatus]}</span>
      </div>

      {/* Context actions */}
      {actions.length > 0 && (
        <div className="hidden md:flex items-center gap-space-1">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={action.onClick}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-radius-sm text-size-12 font-medium text-text-semantic-secondary hover:bg-surface-panel-hover transition-colors duration-normal"
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default GlobalContextBar;
