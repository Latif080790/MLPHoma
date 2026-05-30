import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
// Enterprise patterns
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader } from '@/components/patterns'
import { 
    BrainCircuit, 
    Play, 
    RotateCcw, 
    TrendingDown, 
    TrendingUp, 
    AlertCircle, 
    Save, 
    History, 
    Trash2, 
    ExternalLink,
    Search,
    RefreshCw
} from 'lucide-react'
import { simulationService, SimulationResult } from '@/services/simulationService'
import { toast } from 'sonner'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import { useProjectStore } from '@/store/projectStore'
import { Label } from '@/components/ui/label'
import { 
    Dialog, 
    DialogContent, 
    DialogHeader, 
    DialogTitle, 
    DialogFooter,
    DialogDescription
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { format } from 'date-fns'

export default function StrategySimulation() {
    const { handleAsync } = useErrorHandler()
    const activeProjectId = useProjectStore(s => s.activeProjectId) || 'global'
    const activeProjectName = useProjectStore(s => s.activeProjectId ? s.projects[s.activeProjectId]?.name || 'Portfolio' : 'Portfolio')
    
    const [delay, setDelay] = useState(0)
    const [resourceShift, setResourceShift] = useState(0)
    const [result, setResult] = useState<SimulationResult | null>(null)
    const [simulating, setSimulating] = useState(false)
    const [pageError, setPageError] = useState<string | null>(null)
    const [srStatus, setSrStatus] = useState('')
    
    // Persistence state
    const [savedSims, setSavedSims] = useState<any[]>([])
    const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false)
    const [scenarioName, setScenarioName] = useState('')
    const [loadingHistory, setLoadingHistory] = useState(false)

    const loadHistory = useCallback(async () => {
        setLoadingHistory(true)
        try {
            const data = await simulationService.listSimulations(activeProjectId)
            setSavedSims(data)
        } catch (err) {
            toast.error('Failed to load simulation history', { description: (err as Error).message })
        } finally {
            setLoadingHistory(false)
        }
    }, [activeProjectId])

    useEffect(() => {
        loadHistory()
    }, [loadHistory])

    const updateDelay = (next: number) => {
        const safe = Math.max(0, Math.min(90, Math.round(next)))
        setDelay(safe)
    }

    const updateResourceShift = (next: number) => {
        const safe = Math.max(0, Math.min(50, Math.round(next)))
        setResourceShift(safe)
    }

    const runSimulation = async () => {
        setSrStatus('Running strategic simulation...')
        setSimulating(true)
        setPageError(null)
        const res = await handleAsync(async () => {
            return simulationService.simulatePortfolioImpact([{
                projectId: activeProjectId,
                shiftDays: delay,
                resourceChange: -resourceShift / 100
            }])
        }, 'calculation.invalid_input')

        if (res) {
            setResult(res)
            toast.success("Simulation complete")
            setSrStatus('Simulation complete. Forecast updated.')
        } else {
            setPageError('Failed to calculate simulation forecast.')
            setSrStatus('Simulation failed.')
        }

        setSimulating(false)
    }

    const handleSaveScenario = async () => {
        if (!scenarioName.trim() || !result) return
        
        const ok = await handleAsync(async () => {
            await simulationService.saveSimulation(activeProjectId, scenarioName, { delay, resourceShift }, result)
            return true
        }, 'data.save_failed')

        if (ok) {
            toast.success("Scenario saved to history")
            setIsSaveDialogOpen(false)
            setScenarioName('')
            loadHistory()
        }
    }

    const handleDeleteScenario = async (id: string) => {
        const ok = await handleAsync(async () => {
            await simulationService.deleteSimulation(id)
            return true
        }, 'data.delete_failed')

        if (ok) {
            toast.success("Scenario removed")
            loadHistory()
        }
    }

    const loadScenario = (sim: any) => {
        setDelay(sim.params.delay || 0)
        setResourceShift(sim.params.resourceShift || 0)
        setResult(sim.result)
        toast.info(`Loaded: ${sim.name}`)
    }

    const reset = () => {
        setDelay(0)
        setResourceShift(0)
        setResult(null)
        setPageError(null)
        setSrStatus('Simulation parameters reset.')
    }

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={activeProjectName}
                    syncStatus="synced"
                    healthItems={result ? [
                        {
                            label: 'Risk',
                            level: result.impactSeverity === 'HIGH' ? 'critical' : result.impactSeverity === 'LOW' ? 'warning' : 'good',
                            value: result.impactSeverity,
                        },
                    ] : []}
                />
            }
            header={
                <WorkspaceHeader
                    title="Strategic Simulation Sandbox"
                    subtitle="Model the ripple effects of timeline shifts and resource reallocations on portfolio health"
                    primaryAction={{
                        label: 'Save Scenario',
                        icon: <Save className="h-3.5 w-3.5" />,
                        onClick: () => setIsSaveDialogOpen(true),
                    }}
                />
            }
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* CONTROLS (4 cols) */}
                <Card className="lg:col-span-4 border-border shadow-sm">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                             Interactive Modeling
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="space-y-4 bg-muted/30/50 dark:bg-neutral-900/30 p-4 rounded-xl border border-border dark:border-neutral-800">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest leading-none">Upstream Delay</label>
                                <Badge variant="secondary" className="font-mono bg-card border shadow-sm">{delay} Days</Badge>
                            </div>
                            <Slider
                                value={[delay]}
                                onValueChange={([v]) => updateDelay(v)}
                                max={90}
                                step={1}
                                className="w-full"
                            />
                            <div className="grid grid-cols-[auto,1fr,auto] gap-2">
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => updateDelay(delay - 1)}>-</Button>
                                <Input type="number" value={delay} onChange={(e) => updateDelay(Number(e.target.value || 0))} className="h-8 text-center font-mono text-xs border-none bg-card shadow-inner" />
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => updateDelay(delay + 1)}>+</Button>
                            </div>
                            <p className="text-xs text-muted-foreground italic font-medium leading-tight">Simulates permit lags or material procurement bottlenecks.</p>
                        </div>

                        <div className="space-y-4 bg-muted/30/50 dark:bg-neutral-900/30 p-4 rounded-xl border border-border dark:border-neutral-800">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-black text-muted-foreground uppercase tracking-widest leading-none">Labor Capacity</label>
                                <Badge variant="outline" className="font-mono bg-red-50 text-red-600 border-red-200">-{resourceShift}%</Badge>
                            </div>
                            <Slider
                                value={[resourceShift]}
                                onValueChange={([v]) => updateResourceShift(v)}
                                max={50}
                                step={1}
                                className="w-full"
                            />
                            <div className="grid grid-cols-[auto,1fr,auto] gap-2">
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => updateResourceShift(resourceShift - 1)}>-</Button>
                                <Input type="number" value={resourceShift} onChange={(e) => updateResourceShift(Number(e.target.value || 0))} className="h-8 text-center font-mono text-xs border-none bg-card shadow-inner" />
                                <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => updateResourceShift(resourceShift + 1)}>+</Button>
                            </div>
                            <p className="text-xs text-muted-foreground italic font-medium leading-tight">Simulates shifting labor to other emergency priority sites.</p>
                        </div>

                        <div className="pt-2 flex gap-2">
                            <Button
                                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold h-10 shadow-md transition-all hover:scale-[1.02]"
                                onClick={runSimulation}
                                disabled={simulating}
                            >
                                {simulating ? <RefreshCw size={14} className="animate-spin mr-2" /> : <Play size={14} className="mr-2 fill-white" />}
                                {simulating ? "Calculating..." : "Run Forecast"}
                            </Button>
                            <Button variant="outline" size="icon" aria-label="Reset" className="h-10 w-10 border-border" onClick={reset}>
                                <RotateCcw size={14} />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* RESULTS (8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                    <Card className="border-border bg-card shadow-sm overflow-hidden">
                        <CardHeader className="border-b bg-muted/30/50">
                            <CardTitle className="text-sm font-bold uppercase tracking-wider flex items-center justify-between">
                                Simulated Portfolio Impact
                                {result && (
                                    <Badge variant={result.impactSeverity === 'HIGH' ? 'destructive' : result.impactSeverity === 'LOW' ? 'secondary' : 'outline'} className="font-black">
                                       Risk: {result.impactSeverity}
                                    </Badge>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col items-center justify-center min-h-[340px] p-6">
                            {simulating && !result ? (
                                <div className="text-center space-y-4 animate-pulse">
                                    <div className="w-20 h-20 bg-indigo-50 dark:bg-indigo-900/20 rounded-full flex items-center justify-center mx-auto text-indigo-500">
                                        <BrainCircuit size={40} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-muted-foreground font-bold">Heuristic Engine Computing...</h3>
                                        <p className="text-xs text-muted-foreground">Re-shaping portfolio curves based on new parameters.</p>
                                    </div>
                                </div>
                            ) : pageError && !result ? (
                                <div className="w-full max-w-sm rounded-2xl border-2 border-red-100 bg-red-50/50 p-8 text-center space-y-4">
                                    <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-600">
                                        <AlertCircle size={24} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="font-bold text-red-700">Calculation Error</h3>
                                        <p className="text-xs text-red-600/80">{pageError}</p>
                                    </div>
                                    <Button size="sm" variant="outline" className="bg-card border-red-200 text-red-700" onClick={runSimulation}>Retry Calculation</Button>
                                </div>
                            ) : !result ? (
                                <div className="text-center space-y-4 py-12 opacity-60">
                                    <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mx-auto text-foreground">
                                        <History size={40} />
                                    </div>
                                    <div className="space-y-1">
                                        <h3 className="text-muted-foreground font-bold text-lg leading-none">Sandbox Idle</h3>
                                        <p className="text-sm text-muted-foreground max-w-[240px]">Adjust parameters and run a forecast to visualize potential project ripple effects.</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div className="p-6 bg-muted/30/50 rounded-2xl border border-border flex flex-col items-center gap-1 shadow-inner group transition-all hover:bg-card hover:shadow-md">
                                            <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5"><TrendingDown size={12} /> Schedule Impact (Avg SPI)</div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-3xl font-mono font-black text-foreground line-through decoration-slate-400/30">{result.originalAvgSpi.toFixed(2)}</span>
                                                <span className="text-4xl font-mono font-black text-red-600 drop-shadow-sm">{result.simulatedAvgSpi.toFixed(2)}</span>
                                            </div>
                                            <div className="mt-2 h-1.5 w-full max-w-[120px] bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-red-500 transition-all duration-1000" style={{ width: `${result.simulatedAvgSpi * 100}%` }} />
                                            </div>
                                        </div>
                                        <div className="p-6 bg-muted/30/50 rounded-2xl border border-border flex flex-col items-center gap-1 shadow-inner group transition-all hover:bg-card hover:shadow-md">
                                            <div className="text-xs font-black text-muted-foreground uppercase tracking-widest mb-2 flex items-center gap-1.5"><TrendingUp size={12} /> Liquidity Gap (M)</div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-3xl font-mono font-black text-foreground line-through decoration-slate-400/30">{Math.round(result.originalCashflow)}M</span>
                                                <span className="text-4xl font-mono font-black text-emerald-600 drop-shadow-sm">{Math.round(result.simulatedCashflow)}M</span>
                                            </div>
                                            <div className="mt-2 h-1.5 w-full max-w-[120px] bg-muted rounded-full overflow-hidden">
                                                <div className="h-full bg-emerald-500 transition-all duration-1000" style={{ width: `${(result.simulatedCashflow / result.originalCashflow) * 100}%` }} />
                                            </div>
                                        </div>
                                    </div>

                                    <div className={`p-6 rounded-2xl flex gap-4 shadow-sm border-l-[6px] ${
                                        result.impactSeverity === 'HIGH' ? 'bg-red-50/80 border-red-500 text-red-900' :
                                        result.impactSeverity === 'LOW' ? 'bg-amber-50/80 border-amber-500 text-amber-900' :
                                        'bg-emerald-50/80 border-emerald-500 text-emerald-900'
                                    }`}>
                                        <div className={`p-2 rounded-full h-fit mt-1 shrink-0 ${
                                            result.impactSeverity === 'HIGH' ? 'bg-red-100 text-red-600' :
                                            result.impactSeverity === 'LOW' ? 'bg-amber-100 text-amber-600' :
                                            'bg-emerald-100 text-emerald-600'
                                        }`}>
                                            <BrainCircuit size={20} />
                                        </div>
                                        <div className="space-y-1.5">
                                            <div className="font-black text-xs uppercase tracking-widest opacity-60">Engine Recommendation</div>
                                            <p className="text-sm font-semibold leading-relaxed leading-tight">{result.recommendation}</p>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* HISTORY PANEL */}
                    <Card className="border-border shadow-sm flex flex-col overflow-hidden max-h-[300px]">
                        <CardHeader className="pb-3 flex-shrink-0 border-b">
                            <CardTitle className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center justify-between">
                                Simulation History
                                <History size={12} />
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0 overflow-hidden flex-1">
                            {loadingHistory ? (
                                <div className="p-8 text-center text-xs text-muted-foreground">Loading history...</div>
                            ) : savedSims.length === 0 ? (
                                <div className="p-8 text-center text-xs text-muted-foreground font-medium italic">No saved scenarios. Save a simulation to compare later.</div>
                            ) : (
                                <ScrollArea className="h-full">
                                    <div className="divide-y divide-border dark:divide-neutral-800">
                                        {savedSims.map((sim) => (
                                            <div key={sim.id} className="group flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-2 mb-0.5">
                                                        <span className="font-bold text-sm text-muted-foreground truncate">{sim.name}</span>
                                                        <Badge variant="outline" className="text-xs px-1 h-3.5 border-border text-muted-foreground font-mono">
                                                            {sim.result.impactSeverity}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
                                                        <span>{format(new Date(sim.created_at), 'dd MMM HH:mm')}</span>
                                                        <span>•</span>
                                                        <span>Delay: {sim.params.delay}d</span>
                                                        <span>•</span>
                                                        <span>Labor: -{sim.params.resourceShift}%</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <Button variant="ghost" size="icon" aria-label="Load into sandbox" className="h-8 w-8 text-indigo-600 hover:bg-indigo-50" onClick={() => loadScenario(sim)} title="Load into sandbox">
                                                        <Play size={14} className="fill-indigo-600" />
                                                    </Button>
                                                    <Button variant="ghost" size="icon" aria-label="Hapus skenario" className="h-8 w-8 text-red-500 hover:bg-red-50" onClick={() => handleDeleteScenario(sim.id)} title="Delete">
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* SAVE DIALOG */}
            <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                             Save Scenario
                        </DialogTitle>
                        <DialogDescription>
                            Name this simulation to archive it in the portfolio history.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="scen-name" className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Scenario Name</Label>
                            <Input 
                                id="scen-name" 
                                placeholder="e.g., Q3 Delay + Labor Shortage" 
                                value={scenarioName}
                                onChange={e => setScenarioName(e.target.value)}
                                className="h-10"
                            />
                        </div>
                        <div className="p-3 bg-muted/30 rounded-lg border border-border space-y-1.5">
                            <div className="flex justify-between text-xs font-bold">
                                <span>SIMULATED SPI:</span>
                                <span className="text-red-600 font-mono">{result?.simulatedAvgSpi.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs font-bold">
                                <span>CASHFLOW IMPACT:</span>
                                <span className="text-emerald-600 font-mono">{result ? Math.round(result.simulatedCashflow) : 0}M</span>
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>Cancel</Button>
                        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" disabled={!scenarioName.trim()} onClick={handleSaveScenario}>
                            Archive Simulation
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    )
}
