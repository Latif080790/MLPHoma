/**
 * BulkActionBar.tsx
 *
 * Generic floating bulk-action toolbar. Appears when ≥1 items are selected.
 * Provides selection count, configurable action buttons, and a clear button.
 *
 * v4 Sprint 2 — Inline Editing & Bulk Actions
 */
import React from 'react'
import { X, CheckSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export interface BulkAction {
    label: string
    icon?: React.ReactNode
    onClick: () => void
    variant?: 'default' | 'destructive' | 'outline' | 'ghost'
    disabled?: boolean
}

interface BulkActionBarProps {
    selectedCount: number
    actions: BulkAction[]
    onClear: () => void
    label?: string
    className?: string
}

export function BulkActionBar({
    selectedCount,
    actions,
    onClear,
    label = 'selected',
    className,
}: BulkActionBarProps) {
    if (selectedCount === 0) return null

    return (
        <div
            className={cn(
                'flex items-center gap-3 px-4 py-2.5 rounded-lg',
                'bg-zinc-900 dark:bg-zinc-800 text-white shadow-xl',
                'border border-zinc-700 dark:border-zinc-600',
                'animate-in slide-in-from-bottom-2 duration-200',
                className
            )}
            role="toolbar"
            aria-label="Bulk actions"
        >
            <span className="flex items-center gap-2 text-sm font-medium shrink-0">
                <CheckSquare className="h-4 w-4 text-orange-400" />
                <Badge className="bg-orange-500 hover:bg-orange-500 text-white text-xs px-2 py-0.5">
                    {selectedCount}
                </Badge>
                <span className="text-zinc-300">{label}</span>
            </span>

            <div className="h-4 w-px bg-zinc-600 mx-1" />

            <div className="flex items-center gap-2 flex-1">
                {actions.map((action, i) => (
                    <Button
                        key={i}
                        size="sm"
                        variant={action.variant ?? 'outline'}
                        className={cn(
                            'h-7 text-xs gap-1.5',
                            !action.variant || action.variant === 'outline'
                                ? 'border-zinc-600 text-zinc-100 hover:bg-zinc-700 hover:text-white'
                                : action.variant === 'destructive'
                                    ? 'bg-red-600 hover:bg-red-700 text-white border-red-600'
                                    : ''
                        )}
                        onClick={action.onClick}
                        disabled={action.disabled}
                    >
                        {action.icon}
                        {action.label}
                    </Button>
                ))}
            </div>

            <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-zinc-400 hover:text-white hover:bg-zinc-700 shrink-0"
                onClick={onClear}
                aria-label="Clear selection"
            >
                <X className="h-3.5 w-3.5" />
            </Button>
        </div>
    )
}
