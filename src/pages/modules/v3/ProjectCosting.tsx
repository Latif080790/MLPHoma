import React, { useEffect, useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Calculator, AlertTriangle, TrendingUp, DollarSign, Wallet, ArrowUpRight, ArrowDownRight, Printer, Download, RefreshCw, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { EmptyState } from '@/components/common/EmptyState'
import { useProjectStore } from '@/store/projectStore'
import { rapProfitService, ProjectProfitSummary } from '@/services/rapProfitService'
import AHSP from '../AHSP'
import RAB from '../RAB'
import RAP from '../RAP'
import { formatIDR } from '@/lib/utils'

export default function ProjectCosting() {
    const { activeProjectId, projects } = useProjectStore()
    const [profitStats, setProfitStats] = useState<ProjectProfitSummary | null>(null)
    const [loading, setLoading] = useState(false)
    const activeProject = activeProjectId ? projects[activeProjectId] : null

    useEffect(() => {
        if (activeProjectId) {
            loadStats(activeProjectId)
        }
    }, [activeProjectId])

    async function loadStats(id: string) {
        setLoading(true)
        try {
            const data = await rapProfitService.getProfitHealth(id)
            setProfitStats(data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Select a project to view costing data." />

    // Derived states for UI
    const profitMargin = profitStats?.projectedProfitPct || 0
    const targetMargin = profitStats?.targetProfitPct || 0
    const isHealthy = profitMargin >= targetMargin

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col space-y-4 overflow-hidden bg-slate-50/50 dark:bg-slate-950/50 p-6">

            {/* 1. TOP HEADER: Functional & Dense */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-3">
                        <Calculator className="h-6 w-6 text-slate-500" />
                        Project Costing
                        <Badge variant="outline" className="ml-2 font-mono font-normal text-xs text-slate-500">
                            {activeProject?.code}
                        </Badge>
                    </h1>
                    <p className="text-slate-500 text-sm mt-1">Financial Terminal & Profit Control Center</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-2">
                        <Printer size={14} /> Print Report
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-2">
                        <Download size={14} /> Export CSV
                    </Button>
                    <Button variant="default" size="sm" className="h-8 gap-2 bg-blue-600 hover:bg-blue-700">
                        <RefreshCw size={14} /> Recalculate
                    </Button>
                </div>
            </div>

            {/* 2. BENTO GRID HUD: Financial KPIs */}
            <div className="grid grid-cols-12 gap-4 h-auto min-h-[140px]">

                {/* A. REVENUE & COST (Compact) */}
                <Card className="col-span-12 md:col-span-3 shadow-sm border-slate-200 dark:border-slate-800">
                    <CardHeader className="pb-2 pt-4 px-4">
                        <CardTitle className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                            <DollarSign size={14} /> Revenue vs Cost
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span className="text-slate-500">Revenue (RAB)</span>
                                <span className="font-mono">{formatIDR(profitStats?.totalRab || 0)}</span>
                            </div>
                            <div className="flex justify-between text-xs border-b border-dashed border-slate-200 pb-2 mb-2">
                                <span className="text-slate-500">Est. Cost (RAP)</span>
                                <span className="font-mono text-slate-700 dark:text-slate-300">{formatIDR(profitStats?.totalRapBudget || 0)}</span>
                            </div>
                            <div className="flex justify-between text-sm font-semibold">
                                <span>Gross Pot.</span>
                                <span className="font-mono text-emerald-600">
                                    {formatIDR((profitStats?.totalRab || 0) - (profitStats?.totalRapBudget || 0))}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* B. PROJECTED PROFIT (Hero) */}
                <Card className="col-span-12 md:col-span-6 bg-slate-900 text-white border-0 shadow-lg relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
                        <TrendingUp size={80} />
                    </div>
                    <CardContent className="h-full flex flex-col justify-center p-6">
                        <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={`border-0 bg-white/10 text-white hover:bg-white/20 px-2 py-0.5 h-auto text-[10px] uppercase font-bold tracking-wider ${isHealthy ? 'text-emerald-300' : 'text-red-300'}`}>
                                {isHealthy ? 'ON TRACK' : 'BELOW TARGET'}
                            </Badge>
                            <span className="text-xs text-slate-400 font-mono">TARGET: {targetMargin}%</span>
                        </div>

                        <div className="flex items-baseline gap-4 mt-2">
                            <div className="text-5xl font-bold font-mono tracking-tighter">
                                {profitStats ? formatIDR(profitStats.projectedProfit) : "Rp 0"}
                            </div>
                            <div className={`text-xl font-bold ${isHealthy ? 'text-emerald-400' : 'text-red-400'} flex items-center`}>
                                {isHealthy ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                                {profitMargin.toFixed(1)}%
                            </div>
                        </div>

                        <div className="mt-4 flex gap-8 text-sm text-slate-400">
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-slate-500">Actual Cost</span>
                                <span className="font-mono text-white">{formatIDR(profitStats?.totalActualCost || 0)}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-slate-500">Commitment</span>
                                <span className="font-mono text-white">{formatIDR(profitStats?.totalCommittedCost || 0)}</span>
                            </div>
                            <div>
                                <span className="block text-[10px] uppercase tracking-wider text-slate-500">ETC</span>
                                <span className="font-mono text-white">
                                    {formatIDR((profitStats?.totalRapBudget || 0) - (profitStats?.totalActualCost || 0))}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* C. ALERTS & OPS (Stacked) */}
                <div className="col-span-12 md:col-span-3 flex flex-col gap-4">
                    <Card className="flex-1 bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30 shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-red-600 flex items-center gap-1 uppercase tracking-wider">
                                    <AlertTriangle size={12} /> Budget Alerts
                                </div>
                                <div className="text-2xl font-bold text-red-700 dark:text-red-400 font-mono mt-1">
                                    {profitStats?.criticalCount || 0}
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-[10px] text-red-600/80 max-w-[80px] leading-tight">Items with &lt;50% margin</p>
                            </div>
                        </CardContent>
                    </Card>
                    <Card className="flex-1 bg-indigo-50 dark:bg-indigo-900/10 border-indigo-200 dark:border-indigo-800/30 shadow-sm">
                        <CardContent className="p-4 flex items-center justify-between">
                            <div>
                                <div className="text-xs font-bold text-indigo-600 flex items-center gap-1 uppercase tracking-wider">
                                    <Wallet size={12} /> Auto-Rent
                                </div>
                                <div className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 font-mono mt-1">
                                    {formatIDR((profitStats?.totalActualCost || 0) - (profitStats?.items.reduce((sum, i) => sum + i.actualCost, 0) || 0))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* 3. MAIN TERMINAL: TABS & DATA GRID */}
            <div className="flex-1 min-h-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-sm flex flex-col">
                <Tabs defaultValue="rap" className="flex-1 flex flex-col min-h-0">
                    <div className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 px-4 pt-2">
                        <TabsList className="bg-transparent h-auto p-0 gap-6">
                            <TabsTrigger
                                value="rap"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none px-2 py-3 font-semibold text-slate-500 hover:text-slate-700"
                            >
                                <div className="flex items-center gap-2">
                                    <Layers size={16} />
                                    RAP (Budget Control)
                                </div>
                            </TabsTrigger>
                            <TabsTrigger
                                value="rab"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none px-2 py-3 font-semibold text-slate-500 hover:text-slate-700"
                            >
                                <div className="flex items-center gap-2">
                                    <Calculator size={16} />
                                    RAB (Estimation)
                                </div>
                            </TabsTrigger>
                            <TabsTrigger
                                value="ahsp"
                                className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-blue-600 data-[state=active]:text-blue-600 rounded-none px-2 py-3 font-semibold text-slate-500 hover:text-slate-700"
                            >
                                <div className="flex items-center gap-2">
                                    <Layers size={16} />
                                    AHSP (Master Data)
                                </div>
                            </TabsTrigger>
                        </TabsList>
                    </div>

                    <div className="flex-1 overflow-auto bg-slate-50/30 dark:bg-slate-900/30">
                        <TabsContent value="rap" className="h-full mt-0 p-0">
                            <div className="h-full overflow-auto p-4">
                                <RAP />
                            </div>
                        </TabsContent>
                        <TabsContent value="rab" className="h-full mt-0 p-0">
                            <div className="h-full overflow-auto p-4">
                                <RAB />
                            </div>
                        </TabsContent>
                        <TabsContent value="ahsp" className="h-full mt-0 p-0">
                            <div className="h-full overflow-auto p-4">
                                <AHSP />
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </div>
    )
}
