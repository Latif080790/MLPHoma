import React, { useMemo } from 'react'
import { useAHSPStore } from '@/store/ahspStore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Calculator, Filter } from 'lucide-react'
import { formatIDR } from '@/lib/utils'

export function AHSPStatsBar() {
    const { ahspItems, resources } = useAHSPStore()

    const summary = useMemo(() => {
        return {
            totalAHSPItems: ahspItems.length,
            totalResources: resources.length,
            activeItems: ahspItems.filter(i => i.isActive).length,
            activeResources: resources.filter(r => r.isActive).length,
            averagePrice: ahspItems.length > 0
                ? ahspItems.reduce((acc, item) => acc + (item.finalPrice || 0), 0) / ahspItems.length
                : 0,
            categories: new Set(ahspItems.map(item => item.category)).size
        }
    }, [ahspItems, resources])

    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total AHSP Items</CardTitle>
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.totalAHSPItems}</div>
                    <p className="text-xs text-muted-foreground">
                        {summary.activeItems} active
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Resources</CardTitle>
                    <Filter className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.totalResources}</div>
                    <p className="text-xs text-muted-foreground">
                        {summary.activeResources} active
                    </p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Average Price</CardTitle>
                    <Calculator className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formatIDR(summary.averagePrice)}</div>
                    <p className="text-xs text-muted-foreground">Per AHSP item</p>
                </CardContent>
            </Card>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Categories</CardTitle>
                    <Filter className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{summary.categories}</div>
                    <p className="text-xs text-muted-foreground">Different categories</p>
                </CardContent>
            </Card>
        </div>
    )
}
