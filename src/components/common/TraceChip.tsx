/**
 * TraceChip.tsx
 * Compact trace indicator showing document lineage and relationships.
 * Displays upstream/downstream document connections for traceability.
 */

import React from 'react'
import { Badge } from '@/components/ui/badge'
import { 
    ArrowRight, 
    FileText, 
    ShoppingCart, 
    PackageCheck, 
    Receipt,
    ArrowRightLeft,
    PiggyBank
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TraceableDocType } from '@/types/traceability'

interface TraceChipProps {
    /** Document type */
    docType: TraceableDocType
    /** Document number/reference */
    docRef: string
    /** Size variant */
    size?: 'sm' | 'md'
    /** Show type icon */
    showIcon?: boolean
    /** Click handler */
    onClick?: () => void
    className?: string
}

const DOC_TYPE_CONFIG: Record<TraceableDocType, { 
    label: string
    icon: React.ElementType
    color: string
}> = {
    MR: { 
        label: 'MR', 
        icon: FileText, 
        color: 'text-blue-600 bg-blue-50 border-blue-200' 
    },
    PO: { 
        label: 'PO', 
        icon: ShoppingCart, 
        color: 'text-purple-600 bg-purple-50 border-purple-200' 
    },
    GRN: { 
        label: 'GRN', 
        icon: PackageCheck, 
        color: 'text-emerald-600 bg-emerald-50 border-emerald-200' 
    },
    INVOICE: { 
        label: 'INV', 
        icon: Receipt, 
        color: 'text-orange-600 bg-orange-50 border-orange-200' 
    },
    MTR: { 
        label: 'MTR', 
        icon: ArrowRightLeft, 
        color: 'text-cyan-600 bg-cyan-50 border-cyan-200' 
    },
    CLAIM: { 
        label: 'CLM', 
        icon: PiggyBank, 
        color: 'text-green-600 bg-green-50 border-green-200' 
    },
}

export function TraceChip({ 
    docType, 
    docRef, 
    size = 'sm', 
    showIcon = true,
    onClick,
    className 
}: TraceChipProps) {
    const config = DOC_TYPE_CONFIG[docType]
    const Icon = config.icon

    return (
        <Badge 
            variant="outline" 
            className={cn(
                'font-mono gap-1.5 cursor-pointer hover:shadow-sm transition-all',
                config.color,
                size === 'sm' ? 'text-[10px] px-1.5 py-0' : 'text-xs px-2 py-0.5',
                onClick && 'hover:scale-105',
                className
            )}
            onClick={onClick}
        >
            {showIcon && <Icon className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />}
            <span className="font-semibold">{config.label}</span>
            <span className="opacity-70">{docRef}</span>
        </Badge>
    )
}

interface TraceChainProps {
    /** Chain of documents in order */
    chain: Array<{
        type: TraceableDocType
        ref: string
    }>
    /** Size variant */
    size?: 'sm' | 'md'
    /** Click handler for chips */
    onChipClick?: (type: TraceableDocType, ref: string) => void
    className?: string
}

/**
 * TraceChain - Shows full document lineage as connected chips
 */
export function TraceChain({ chain, size = 'sm', onChipClick, className }: TraceChainProps) {
    if (chain.length === 0) return null

    return (
        <div className={cn('flex items-center gap-1 flex-wrap', className)}>
            {chain.map((doc, idx) => (
                <React.Fragment key={`${doc.type}-${doc.ref}-${idx}`}>
                    <TraceChip
                        docType={doc.type}
                        docRef={doc.ref}
                        size={size}
                        onClick={() => onChipClick?.(doc.type, doc.ref)}
                    />
                    {idx < chain.length - 1 && (
                        <ArrowRight className={cn(
                            'text-slate-400',
                            size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'
                        )} />
                    )}
                </React.Fragment>
            ))}
        </div>
    )
}

interface TraceCountBadgeProps {
    /** Number of linked documents */
    count: number
    /** Direction */
    direction: 'upstream' | 'downstream'
    className?: string
}

/**
 * TraceCountBadge - Shows count of upstream/downstream documents
 */
export function TraceCountBadge({ count, direction, className }: TraceCountBadgeProps) {
    if (count === 0) return null

    return (
        <Badge 
            variant="secondary" 
            className={cn(
                'text-[9px] px-1.5 py-0 font-mono',
                direction === 'upstream' 
                    ? 'bg-blue-50 text-blue-700 border-blue-200' 
                    : 'bg-purple-50 text-purple-700 border-purple-200',
                className
            )}
        >
            {direction === 'upstream' ? '↑' : '↓'} {count}
        </Badge>
    )
}
