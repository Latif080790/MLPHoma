import React from 'react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Search,
  Filter,
  Columns3,
  LayoutGrid,
  ChevronDown,
  Bookmark,
  X,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

/**
 * SmartToolbar — Central toolbar with search, filters, views, and density.
 * 
 * Based on: Design System Rules v1 → Layer 5 + Component Specification v1 → Section 5
 * Layout:
 *   Left:  search, quick filters, advanced filters, saved views
 *   Right: density, columns, group by, utility actions
 * 
 * Behavior:
 *   - Sticky above work surface when scrolling
 *   - Transforms into BulkActionBar when selection is active
 */

type DensityMode = 'compact' | 'default' | 'comfortable';

interface QuickFilter {
  label: string;
  value: string;
  active: boolean;
  count?: number;
}

interface SavedView {
  id: string;
  label: string;
  isActive: boolean;
}

interface SmartToolbarProps {
  /** Search value */
  searchValue?: string;
  /** Search change handler */
  onSearchChange?: (value: string) => void;
  /** Search placeholder */
  searchPlaceholder?: string;
  /** Quick filter chips */
  quickFilters?: QuickFilter[];
  /** Quick filter toggle handler */
  onQuickFilterToggle?: (filter: QuickFilter) => void;
  /** Whether advanced filters are available */
  hasAdvancedFilters?: boolean;
  /** Advanced filter open handler */
  onOpenAdvancedFilters?: () => void;
  /** Count of active advanced filters */
  activeFilterCount?: number;
  /** Saved views */
  savedViews?: SavedView[];
  /** Saved view switch handler */
  onSavedViewSwitch?: (viewId: string) => void;
  /** Current density */
  density?: DensityMode;
  /** Density change handler */
  onDensityChange?: (density: DensityMode) => void;
  /** Whether column visibility control is available */
  hasColumnControl?: boolean;
  /** Column control handler */
  onColumnControl?: () => void;
  /** Whether group-by is available */
  hasGroupControl?: boolean;
  /** Group control handler */
  onGroupControl?: () => void;
  /** Additional utility actions */
  utilityActions?: Array<{
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
  }>;
  /** Additional class names */
  className?: string;
}

const densityLabels: Record<DensityMode, string> = {
  compact: 'Compact',
  default: 'Default',
  comfortable: 'Comfortable',
};

export function SmartToolbar({
  searchValue = '',
  onSearchChange,
  searchPlaceholder = 'Search...',
  quickFilters = [],
  onQuickFilterToggle,
  hasAdvancedFilters = false,
  onOpenAdvancedFilters,
  activeFilterCount = 0,
  savedViews = [],
  onSavedViewSwitch,
  density = 'default',
  onDensityChange,
  hasColumnControl = false,
  onColumnControl,
  hasGroupControl = false,
  onGroupControl,
  utilityActions = [],
  className,
}: SmartToolbarProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-[var(--space-2)] flex-wrap',
        'py-[var(--space-2)]',
        'text-[var(--font-size-13)]',
        className
      )}
    >
      {/* ── Left Group ── */}
      
      {/* Search */}
      <div className="relative min-w-[180px] max-w-[260px]">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[hsl(var(--color-icon-tertiary))]" />
        <Input
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-8 pl-8 pr-8 text-[var(--font-size-13)] bg-[hsl(var(--color-surface-page))]"
        />
        {searchValue && (
          <button
            onClick={() => onSearchChange?.('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted"
          >
            <X className="h-3 w-3 text-[hsl(var(--color-icon-tertiary))]" />
          </button>
        )}
      </div>

      {/* Quick Filters */}
      {quickFilters.length > 0 && (
        <div className="hidden sm:flex items-center gap-[var(--space-1)]">
          {quickFilters.map((filter) => (
            <button
              key={filter.value}
              onClick={() => onQuickFilterToggle?.(filter)}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1 rounded-[var(--radius-full)] border text-[var(--font-size-12)] font-[var(--font-weight-medium)] transition-all duration-[var(--motion-duration-fast)]',
                filter.active
                  ? 'bg-primary/10 border-primary/30 text-primary'
                  : 'bg-transparent border-[hsl(var(--color-border-subtle))] text-[hsl(var(--color-text-secondary))] hover:border-[hsl(var(--color-border-default))]'
              )}
            >
              {filter.label}
              {typeof filter.count === 'number' && (
                <span className="text-[var(--font-size-11)] opacity-70">{filter.count}</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Advanced Filters */}
      {hasAdvancedFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpenAdvancedFilters}
          className="h-8 gap-1.5 text-[var(--font-size-12)]"
        >
          <Filter className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Filters</span>
          {activeFilterCount > 0 && (
            <Badge className="h-4 min-w-[16px] px-1 text-[10px] bg-primary text-primary-foreground">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      )}

      {/* Saved Views */}
      {savedViews.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[var(--font-size-12)]">
              <Bookmark className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Views</span>
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="min-w-[160px]">
            <DropdownMenuLabel className="text-[var(--font-size-11)]">Saved Views</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {savedViews.map((view) => (
              <DropdownMenuItem
                key={view.id}
                onClick={() => onSavedViewSwitch?.(view.id)}
                className={cn('text-[var(--font-size-13)]', view.isActive && 'font-[var(--font-weight-semibold)]')}
              >
                {view.isActive && <span className="mr-1">●</span>}
                {view.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* ── Spacer ── */}
      <div className="flex-1" />

      {/* ── Right Group ── */}

      {/* Density Control */}
      {onDensityChange && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-[var(--font-size-12)]">
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden md:inline">{densityLabels[density]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[120px]">
            {(Object.keys(densityLabels) as DensityMode[]).map((d) => (
              <DropdownMenuItem
                key={d}
                onClick={() => onDensityChange(d)}
                className={cn('text-[var(--font-size-13)]', density === d && 'font-[var(--font-weight-semibold)]')}
              >
                {density === d && <span className="mr-1">●</span>}
                {densityLabels[d]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Column Control */}
      {hasColumnControl && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onColumnControl}
          className="h-8 gap-1 text-[var(--font-size-12)]"
        >
          <Columns3 className="h-3.5 w-3.5" />
          <span className="hidden md:inline">Columns</span>
        </Button>
      )}

      {/* Utility Actions */}
      {utilityActions.map((action, i) => (
        <Button
          key={i}
          variant="ghost"
          size="sm"
          onClick={action.onClick}
          className="h-8 gap-1 text-[var(--font-size-12)]"
        >
          {action.icon}
          <span className="hidden md:inline">{action.label}</span>
        </Button>
      ))}
    </div>
  );
}

export default SmartToolbar;
