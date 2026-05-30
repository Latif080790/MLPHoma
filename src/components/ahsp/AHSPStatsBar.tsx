import React, { useMemo } from 'react'
import { useAHSPStore } from '@/store/ahspStore'
import { formatIDR } from '@/lib/utils'

interface AHSPStatsBarProps {
  onRefresh?: () => void
}

export function AHSPStatsBar({ onRefresh: _onRefresh }: AHSPStatsBarProps) {
    const { ahspItems, resources, totalAhspCount, totalResourceCount } = useAHSPStore()

    const summary = useMemo(() => {
        const totalAHSP = totalAhspCount || ahspItems.length
        const totalRes = totalResourceCount || resources.length

        return {
            totalAHSPItems: totalAHSP,
            totalResources: totalRes,
            activeItems: ahspItems.filter(i => i.isActive).length,
            activeResources: resources.filter(r => r.isActive).length,
            averagePrice: totalAHSP > 0
                ? ahspItems.reduce((acc, item) => acc + (item.finalPrice || 0), 0) / totalAHSP
                : 0,
            categories: new Set(ahspItems.map(item => item.category)).size,
        }
    }, [ahspItems, resources, totalAhspCount, totalResourceCount])

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 rounded-lg border border-border overflow-hidden bg-card">
            <div className="px-4 py-2.5 border-r border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1.5">
                    Total AHSP
                </p>
                <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold font-mono text-muted-foreground">{summary.totalAHSPItems}</span>
                    <span className="text-xs font-mono text-emerald-500">{summary.activeItems} aktif</span>
                </div>
            </div>

            <div className="px-4 py-2.5 border-r border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1.5">
                    Resources DKH
                </p>
                <div className="flex items-baseline gap-2">
                    <span className="text-base font-bold font-mono text-muted-foreground">{summary.totalResources}</span>
                    <span className="text-xs font-mono text-emerald-500">{summary.activeResources} aktif</span>
                </div>
            </div>

            <div className="px-4 py-2.5 border-r border-border">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1.5">
                    Harga Rata-rata
                </p>
                <p className="text-base font-bold font-mono text-muted-foreground">{formatIDR(summary.averagePrice)}</p>
            </div>

            <div className="px-4 py-2.5">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground leading-none mb-1.5">
                    Kategori
                </p>
                <p className="text-base font-bold font-mono text-muted-foreground">{summary.categories}</p>
            </div>
        </div>
    )
}
