
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { Boxes, Info } from 'lucide-react'
import { resourceService, ResourceUtilization } from '@/services/resourceService'
import { toast } from 'sonner'

export default function PortfolioResources() {
    const [resources, setResources] = useState<ResourceUtilization[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        resourceService.getResourcePortfolioHeatmap()
            .then(setResources)
            .catch(() => toast.error("Failed to load resource heatmap"))
            .finally(() => setLoading(false))
    }, [])

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<Boxes size={18} />}
                title="Resource Portfolio Heatmap"
                description="Consolidated view of equipment and labor utilization across all active projects."
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <div className="col-span-full h-64 flex items-center justify-center text-slate-500 italic">
                        Aggregating telemetry from all projects...
                    </div>
                ) : resources.length === 0 ? (
                    <div className="col-span-full h-64 flex items-center justify-center text-slate-500 italic">
                        No resource data detected in active logs.
                    </div>
                ) : resources.map((res, i) => (
                    <Card key={i} className="group border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all overflow-hidden">
                        <CardHeader className="pb-2 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    {res.resourceName}
                                    <Badge variant="outline" className="text-xs font-normal uppercase">
                                        {res.type}
                                    </Badge>
                                </CardTitle>
                                <span className={`text-xs font-mono font-bold ${res.totalUsage > 80 ? 'text-red-500' : 'text-emerald-500'}`}>
                                    Avg {Math.round(res.totalUsage)}%
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-4 space-y-4">
                            <div className="space-y-1">
                                <div className="flex justify-between text-xs text-slate-500 uppercase">
                                    <span>Portfolio Allocation</span>
                                    <span>{res.allocation.length} Projects</span>
                                </div>
                                <Progress value={res.totalUsage} className="h-1.5" />
                            </div>

                            <div className="space-y-2">
                                <h4 className="text-xs text-slate-500 font-bold uppercase flex items-center gap-1">
                                    <Info size={10} /> Active Distribution
                                </h4>
                                {res.allocation.map((alloc, idx) => (
                                    <div key={idx} className="flex items-center justify-between group/item">
                                        <span className="text-xs text-slate-700 dark:text-slate-300 truncate w-32">
                                            {alloc.projectName}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 bg-slate-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full transition-all ${alloc.usagePercent > 70 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                                    style={{ width: `${alloc.usagePercent}%` }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono w-8 text-right">
                                                {Math.round(alloc.usagePercent)}%
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-lg p-4 flex items-start gap-3">
                <Info size={16} className="text-blue-500 mt-0.5" />
                <div className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
                    <strong>Optimization Tip:</strong> Equipment with {'>'}85% average utilization may indicate a bottleneck.
                    Consider reallocating idle assets from projects with {'<'}20% usage or procuring additional units to avoid schedule slips.
                </div>
            </div>
        </div>
    )
}
