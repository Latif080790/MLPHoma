import React, { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { BrainCircuit, Play, RotateCcw, TrendingDown, TrendingUp, AlertCircle } from 'lucide-react'
import { simulationService, SimulationResult } from '@/services/simulationService'
import { toast } from 'sonner'
import { useErrorHandler } from '@/hooks/useErrorHandler'

export default function StrategySimulation() {
    const { handleAsync } = useErrorHandler()
    const [delay, setDelay] = useState(0)
    const [resourceShift, setResourceShift] = useState(0)
    const [result, setResult] = useState<SimulationResult | null>(null)
    const [simulating, setSimulating] = useState(false)
    const [pageError, setPageError] = useState<string | null>(null)
    const [srStatus, setSrStatus] = useState('')

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
                projectId: 'global',
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

    const reset = () => {
        setDelay(0)
        setResourceShift(0)
        setResult(null)
        setPageError(null)
        setSrStatus('Simulation parameters reset.')
    }

    return (
        <div className="space-y-6">
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
            <ModuleHeader
                icon={<BrainCircuit size={18} />}
                title="Strategic Simulation Sandbox"
                description="Model the ripple effects of timeline shifts and resource reallocations on portfolio health."
                accent="amber"
            />

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* CONTROLS */}
                <Card className="lg:col-span-1 border-slate-200 dark:border-slate-800">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Simulation Parameters</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-medium text-slate-500 uppercase">Average Project Delay</label>
                                <Badge variant="secondary" className="font-mono">{delay} Days</Badge>
                            </div>
                            <Slider
                                value={[delay]}
                                onValueChange={([v]) => updateDelay(v)}
                                max={90}
                                step={1}
                                className="w-full"
                            />
                            <div className="grid grid-cols-[auto,1fr,auto] gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateDelay(delay - 1)}
                                    aria-label="Decrease delay by 1 day"
                                >
                                    -
                                </Button>
                                <Input
                                    type="number"
                                    min={0}
                                    max={90}
                                    step={1}
                                    value={delay}
                                    onChange={(e) => updateDelay(Number(e.target.value || 0))}
                                    aria-label="Average project delay in days"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateDelay(delay + 1)}
                                    aria-label="Increase delay by 1 day"
                                >
                                    +
                                </Button>
                            </div>
                            <p className="text-xs text-slate-400 italic">Simulates upstream delays (permits, logistical bottlenecks)</p>
                        </div>

                        <div className="space-y-4">
                            <div className="flex justify-between items-center">
                                <label className="text-xs font-medium text-slate-500 uppercase">Labor Reallocation</label>
                                <Badge variant="secondary" className="font-mono">-{resourceShift}%</Badge>
                            </div>
                            <Slider
                                value={[resourceShift]}
                                onValueChange={([v]) => updateResourceShift(v)}
                                max={50}
                                step={1}
                                className="w-full"
                            />
                            <div className="grid grid-cols-[auto,1fr,auto] gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateResourceShift(resourceShift - 1)}
                                    aria-label="Decrease labor reallocation by 1 percent"
                                >
                                    -
                                </Button>
                                <Input
                                    type="number"
                                    min={0}
                                    max={50}
                                    step={1}
                                    value={resourceShift}
                                    onChange={(e) => updateResourceShift(Number(e.target.value || 0))}
                                    aria-label="Labor reallocation percentage"
                                />
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => updateResourceShift(resourceShift + 1)}
                                    aria-label="Increase labor reallocation by 1 percent"
                                >
                                    +
                                </Button>
                            </div>
                            <p className="text-xs text-slate-400 italic">Simulates shifting labor to other emergency projects</p>
                        </div>

                        <div className="pt-4 flex gap-2">
                            <Button
                                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                                onClick={runSimulation}
                                disabled={simulating}
                                aria-busy={simulating}
                            >
                                {simulating ? "Calculating..." : <><Play size={14} className="mr-2" /> Run Forecast</>}
                            </Button>
                            <Button variant="outline" size="icon" onClick={reset}>
                                <RotateCcw size={14} />
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* RESULTS */}
                <Card className="lg:col-span-2 border-slate-200 dark:border-slate-800 bg-slate-50/30 dark:bg-slate-900/10">
                    <CardHeader>
                        <CardTitle className="text-sm font-bold uppercase tracking-wider">Simulated Portfolio Impact</CardTitle>
                    </CardHeader>
                    <CardContent className="h-full flex flex-col items-center justify-center min-h-[300px]">
                        {simulating && !result ? (
                            <div className="text-center space-y-2 py-12">
                                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto text-blue-500 animate-pulse">
                                    <BrainCircuit size={32} />
                                </div>
                                <h3 className="text-slate-600 dark:text-slate-300 font-medium">Running simulation...</h3>
                                <p className="text-xs text-slate-400">Calculating portfolio impact forecast.</p>
                            </div>
                        ) : pageError && !result ? (
                            <div className="w-full max-w-md rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/20 p-4 text-center space-y-3">
                                <h3 className="text-sm font-semibold text-red-700 dark:text-red-300">Simulation failed</h3>
                                <p className="text-xs text-red-600/90 dark:text-red-300/90">{pageError}</p>
                                <Button size="sm" variant="outline" onClick={runSimulation}>Try Again</Button>
                            </div>
                        ) : !result ? (
                            <div className="text-center space-y-2 py-12">
                                <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto text-slate-400">
                                    <BrainCircuit size={32} />
                                </div>
                                <h3 className="text-slate-500 font-medium">No active simulation</h3>
                                <p className="text-xs text-slate-400">Adjust parameters and run the forecast to see results.</p>
                            </div>
                        ) : (
                            <div className="w-full space-y-8 animate-in fade-in slide-in-from-bottom-2">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <div className="text-xs text-slate-500 uppercase mb-1">Schedule Impact (Avg SPI)</div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl font-mono font-bold text-slate-400">{result.originalAvgSpi.toFixed(2)}</span>
                                            <TrendingDown className="text-red-500" size={16} />
                                            <span className="text-2xl font-mono font-bold text-red-500">{result.simulatedAvgSpi.toFixed(2)}</span>
                                        </div>
                                    </div>
                                    <div className="p-4 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                                        <div className="text-xs text-slate-500 uppercase mb-1">Liquidity Impact (Weekly Cashflow)</div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl font-mono font-bold text-slate-400">{Math.round(result.originalCashflow)}M</span>
                                            <TrendingUp className="text-emerald-500" size={16} />
                                            <span className="text-2xl font-mono font-bold text-emerald-500">{Math.round(result.simulatedCashflow)}M</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={`p-4 rounded-lg flex gap-4 ${result.impactSeverity === 'HIGH' ? 'bg-red-50 border border-red-100 text-red-700' :
                                        result.impactSeverity === 'LOW' ? 'bg-amber-50 border border-amber-100 text-amber-700' :
                                            'bg-emerald-50 border border-emerald-100 text-emerald-700'
                                    }`}>
                                    <AlertCircle className="mt-0.5 shrink-0" size={18} />
                                    <div className="space-y-1">
                                        <div className="font-bold text-sm uppercase">Executive Recommendation</div>
                                        <p className="text-xs leading-relaxed">{result.recommendation}</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
