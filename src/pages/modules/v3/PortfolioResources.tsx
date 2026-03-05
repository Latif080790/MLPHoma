
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { AlertTriangle, Boxes, CheckCircle2, Info } from 'lucide-react'
import { resourceService, ResourceUtilization } from '@/services/resourceService'
import { toast } from 'sonner'
import ModulePageState from '@/components/common/ModulePageState'

function getUtilizationStatus(totalUsage: number) {
    if (totalUsage >= 85) {
        return {
            label: 'High',
            className: 'border-red-200 text-red-700 bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:bg-red-950/20',
            Icon: AlertTriangle,
        }
    }

    if (totalUsage >= 60) {
        return {
            label: 'Medium',
            className: 'border-amber-200 text-amber-700 bg-amber-50 dark:border-amber-900/40 dark:text-amber-300 dark:bg-amber-950/20',
            Icon: Info,
        }
    }

    return {
        label: 'Low',
        className: 'border-emerald-200 text-emerald-700 bg-emerald-50 dark:border-emerald-900/40 dark:text-emerald-300 dark:bg-emerald-950/20',
        Icon: CheckCircle2,
    }
}

export default function PortfolioResources() {
    const [resources, setResources] = useState<ResourceUtilization[]>([])
    const [loading, setLoading] = useState(true)
    const [pageError, setPageError] = useState<string | null>(null)
    const [srStatus, setSrStatus] = useState('')

    const loadResources = async () => {
        setSrStatus('Loading resource portfolio heatmap...')
        setLoading(true)
        setPageError(null)
        try {
            const data = await resourceService.getResourcePortfolioHeatmap()
            setResources(data)
            setSrStatus(`Resource heatmap loaded for ${data.length} resource groups.`)
        } catch {
            setPageError('Failed to load resource heatmap.')
            toast.error('Failed to load resource heatmap')
            setSrStatus('Failed to load resource heatmap.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        void loadResources()
    }, [])

    if (loading) {
        return (
            <ModulePageState
                icon={<Boxes size={18} />}
                title="Resource Portfolio Heatmap"
                description="Consolidated view of equipment and labor utilization across all active projects."
                variant="loading"
                message="Aggregating telemetry from all projects..."
            />
        )
    }

    if (pageError) {
        return (
            <ModulePageState
                icon={<Boxes size={18} />}
                title="Resource Portfolio Heatmap"
                description="Consolidated view of equipment and labor utilization across all active projects."
                variant="error"
                message={pageError}
                onRetry={() => {
                    void loadResources()
                }}
            />
        )
    }

    if (resources.length === 0) {
        return (
            <ModulePageState
                icon={<Boxes size={18} />}
                title="Resource Portfolio Heatmap"
                description="Consolidated view of equipment and labor utilization across all active projects."
                variant="empty"
                message="No resource data detected in active logs."
            />
        )
    }

    return (
        <div className="space-y-6">
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
            <ModuleHeader
                icon={<Boxes size={18} />}
                title="Resource Portfolio Heatmap"
                description="Consolidated view of equipment and labor utilization across all active projects."
                accent="cyan"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resources.map((res, i) => (
                    <Card key={i} className="group border-slate-200 dark:border-slate-800 hover:shadow-lg transition-all overflow-hidden">
                        {(() => {
                            const utilization = getUtilizationStatus(res.totalUsage)
                            const UtilizationIcon = utilization.Icon

                            return (
                                <CardHeader className="pb-2 bg-slate-50/50 dark:bg-slate-900/50">
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-bold flex items-center gap-2">
                                    {res.resourceName}
                                    <Badge variant="outline" className="text-xs font-normal uppercase">
                                        {res.type}
                                    </Badge>
                                </CardTitle>
                                <Badge variant="outline" className={`text-xs font-semibold gap-1.5 ${utilization.className}`}>
                                    <UtilizationIcon size={12} />
                                    {utilization.label}
                                    <span className="font-mono">{Math.round(res.totalUsage)}%</span>
                                </Badge>
                            </div>
                        </CardHeader>
                            )
                        })()}
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
