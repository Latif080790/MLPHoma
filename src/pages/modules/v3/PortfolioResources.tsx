
import React, { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
// Enterprise patterns
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip } from '@/components/patterns'
import { AlertTriangle, Boxes, CheckCircle2, Info } from 'lucide-react'
import { resourceService, ResourceUtilization } from '@/services/resourceService'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import ModulePageState from '@/components/common/ModulePageState'
import { ExportMenu } from '@/components/shared/ExportMenu'

function getUtilizationStatus(totalUsage: number) {
    if (totalUsage >= 85) {
        return {
            label: 'High',
            className: 'border-red-500/20 text-red-400 bg-red-500/10',
            barColor: '#EF4444',
            Icon: AlertTriangle,
        }
    }

    if (totalUsage >= 60) {
        return {
            label: 'Medium',
            className: 'border-amber-500/20 text-amber-400 bg-amber-500/10',
            barColor: '#F59E0B',
            Icon: Info,
        }
    }

    return {
        label: 'Low',
        className: 'border-green-500/20 text-green-400 bg-green-500/10',
        barColor: '#10B981',
        Icon: CheckCircle2,
    }
}

export default function PortfolioResources() {
    const [resources, setResources] = useState<ResourceUtilization[]>([])
    const [loading, setLoading] = useState(true)
    const [pageError, setPageError] = useState<string | null>(null)
    const [srStatus, setSrStatus] = useState('')
    const { handleError } = useErrorHandler()

    const loadResources = async () => {
        setSrStatus('Loading resource portfolio heatmap...')
        setLoading(true)
        setPageError(null)
        try {
            const data = await resourceService.getResourcePortfolioHeatmap()
            setResources(data)
            setSrStatus(`Resource heatmap loaded for ${data.length} resource groups.`)
        } catch (err: unknown) {
            handleError(err, 'network.fetch')
            setPageError('Failed to load resource heatmap.')
            setSrStatus('Failed to load resource heatmap.')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        let cancelled = false
        const run = async () => {
            setSrStatus('Loading resource portfolio heatmap...')
            setLoading(true)
            setPageError(null)
            try {
                const data = await resourceService.getResourcePortfolioHeatmap()
                if (cancelled) return
                setResources(data)
                setSrStatus(`Resource heatmap loaded for ${data.length} resource groups.`)
            } catch (err: unknown) {
                if (cancelled) return
                handleError(err, 'network.fetch')
                setPageError('Failed to load resource heatmap.')
                setSrStatus('Failed to load resource heatmap.')
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        void run()
        return () => { cancelled = true }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

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

    const highCount = resources.filter(r => r.totalUsage >= 85).length
    const medCount = resources.filter(r => r.totalUsage >= 60 && r.totalUsage < 85).length
    const lowCount = resources.filter(r => r.totalUsage < 60).length
    const resSummary = [
        { label: 'Resources', value: resources.length, status: 'neutral' as const },
        { label: 'High', value: highCount, status: (highCount > 0 ? 'danger' : 'success') as 'danger' | 'success' },
        { label: 'Medium', value: medCount, status: (medCount > 0 ? 'warning' : 'neutral') as 'warning' | 'neutral' },
        { label: 'Low', value: lowCount, status: 'success' as const },
    ]

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName="Portfolio"
                    syncStatus="synced"
                    healthItems={[
                        {
                            label: 'Bottleneck',
                            level: highCount > 0 ? 'critical' : 'good',
                            value: `${highCount}`,
                        },
                    ]}
                />
            }
            header={
                <WorkspaceHeader
                    title="Resource Portfolio Heatmap"
                    subtitle="Consolidated view of equipment and labor utilization across all active projects"
                    extraContent={
                        <ExportMenu
                            data={resources}
                            columns={[
                                { header: 'Resource', accessor: r => r.resourceName },
                                { header: 'Type', accessor: r => r.type },
                                { header: 'Utilization %', accessor: r => r.totalUsage },
                                { header: 'Status', accessor: r => r.totalUsage >= 85 ? 'High' : r.totalUsage >= 60 ? 'Medium' : 'Low' },
                            ]}
                            filename={`PortfolioResources_${new Date().toISOString().slice(0, 10)}`}
                            size="sm"
                        />
                    }
                />
            }
            summary={
                <SummaryStrip items={resSummary} variant="chips" />
            }
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {resources.map((res, i) => (
                    <Card key={i} className="group border-border bg-card hover:border-border transition-all overflow-hidden">
                        {(() => {
                            const utilization = getUtilizationStatus(res.totalUsage)
                            const UtilizationIcon = utilization.Icon

                            return (
                                <CardHeader className="pb-2 bg-muted/20">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground/90">
                                            {res.resourceName}
                                            <span className="inline-flex items-center rounded-md border border-white/10 bg-white/[0.06] px-1.5 py-0.5 text-xs font-mono text-muted-foreground uppercase">
                                                {res.type}
                                            </span>
                                        </CardTitle>
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold ${utilization.className}`}>
                                            <UtilizationIcon size={11} />
                                            {utilization.label}
                                            <span className="font-mono">{Math.round(res.totalUsage)}%</span>
                                        </span>
                                    </div>
                                </CardHeader>
                            )
                        })()}
                        <CardContent className="pt-4 space-y-4">
                            {(() => {
                                const utilization = getUtilizationStatus(res.totalUsage)
                                return (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-white/30 uppercase tracking-wide">
                                            <span>Alokasi Portfolio</span>
                                            <span>{res.allocation.length} Proyek</span>
                                        </div>
                                        <div className="h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                            <div
                                                className="h-full rounded-full transition-all"
                                                style={{ width: `${res.totalUsage}%`, backgroundColor: utilization.barColor }}
                                            />
                                        </div>
                                    </div>
                                )
                            })()}

                            <div className="space-y-2">
                                <h4 className="text-xs text-white/30 font-bold uppercase flex items-center gap-1">
                                    <Info size={10} /> Distribusi Aktif
                                </h4>
                                {res.allocation.map((alloc, idx) => (
                                    <div key={idx} className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground truncate w-32">
                                            {alloc.projectName}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <div className="w-24 h-1.5 rounded-full bg-white/[0.08] overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: `${alloc.usagePercent}%`,
                                                        backgroundColor: alloc.usagePercent > 70 ? '#F59E0B' : '#3B82F6',
                                                    }}
                                                />
                                            </div>
                                            <span className="text-xs font-mono w-8 text-right text-muted-foreground">
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

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/[0.07] p-4 flex items-start gap-3">
                <Info size={15} className="text-blue-400 mt-0.5 shrink-0" />
                <p className="text-xs text-blue-300/80 leading-relaxed">
                    <strong className="text-blue-300">Tips Optimasi:</strong> Sumber daya dengan utilisasi {'>'}85% mengindikasikan bottleneck.
                    Pertimbangkan realokasi aset idle dari proyek dengan utilisasi {'<'}20% untuk menghindari keterlambatan jadwal.
                </p>
            </div>
        </PageShell>
    )
}
