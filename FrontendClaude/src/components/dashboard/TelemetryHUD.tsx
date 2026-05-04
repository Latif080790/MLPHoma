import React from 'react'
import { Activity, AlertTriangle, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { GenerateReportDialog } from './GenerateReportDialog'
import { DashboardStats } from '@/services/dashboardService'

interface TelemetryHUDProps {
    isPortfolioMode: boolean
    activeProject: { id: string; name: string } | null
    stats: DashboardStats | null
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    portfolioStats: any
    srStatus: string
    onTogglePortfolio: () => void
}

export const TelemetryHUD: React.FC<TelemetryHUDProps> = ({
    isPortfolioMode,
    activeProject,
    stats,
    portfolioStats,
    srStatus,
    onTogglePortfolio
}) => {
    return (
        <div className="flex flex-col gap-2 bg-slate-950 text-white p-3 rounded-lg border border-slate-800 shadow-lg">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-xs font-mono text-blue-400 animate-pulse">
                        <Activity size={14} /> {isPortfolioMode ? 'PORTFOLIO HUD' : 'PROJECT HUD'}
                    </div>
                    <div className="h-4 w-px bg-slate-800" />
                    <div className="text-xs text-slate-400 font-mono flex items-center gap-2 overflow-hidden whitespace-nowrap">
                        <span className="text-emerald-500">SYS_OPTIMAL</span>
                        <span>::</span>
                        <span>Latency: 42ms</span>
                        <span>::</span>
                        <span className="text-blue-400">Mode: {isPortfolioMode ? 'Consolidated Telemetry' : 'Deep Dive'}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {/* Report Generator */}
                    {!isPortfolioMode && activeProject && stats && (
                        <GenerateReportDialog projectId={activeProject.id} projectName={activeProject.name} stats={stats}>
                            <Button variant="outline" size="sm" className="h-7 text-xs font-mono border-slate-700 text-slate-400 hover:text-white bg-slate-900">
                                <FileDown className="mr-2 h-3 w-3" /> EXPORT REPORT
                            </Button>
                        </GenerateReportDialog>
                    )}

                    <Button
                        variant="ghost"
                        size="sm"
                        className={`h-7 text-xs font-mono border border-slate-700 ${isPortfolioMode ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:text-white'}`}
                        onClick={onTogglePortfolio}
                    >
                        {isPortfolioMode ? 'EXIT PORTFOLIO' : 'ENTER PORTFOLIO'}
                    </Button>
                    <Badge variant="outline" className="bg-slate-900 text-slate-300 border-slate-700 font-mono text-xs">
                        v3.2.0-STABLE
                    </Badge>
                </div>
            </div>

            {/* MARQUEE TICKER */}
            <div className="h-6 bg-black/40 rounded border border-slate-800/50 overflow-hidden flex items-center group">
                <div className="bg-red-600/20 text-red-500 px-2 py-0.5 text-xs font-bold border-r border-red-500/30 flex items-center gap-1 z-10 uppercase">
                    <AlertTriangle size={10} /> Alerts
                </div>
                <div className="flex-1 overflow-hidden relative">
                    <div className="animate-marquee whitespace-nowrap text-xs font-mono text-slate-400 flex items-center gap-8 pl-4 group-hover:[animation-play-state:paused]">
                        {isPortfolioMode ? (
                            <>
                                <span>CRITICAL: {portfolioStats?.globalAlertCounts?.CRITICAL || 0} alerts across {portfolioStats?.totalProjects || 0} projects</span>
                                <span>::</span>
                                <span>TOP RISK: {portfolioStats?.topGlobalRisks?.[0]?.description || 'None detected'} ({portfolioStats?.topGlobalRisks?.[0]?.projectName})</span>
                                <span>::</span>
                                <span>LIQUIDITY: avg CPI {(portfolioStats?.avgCpi || 1).toFixed(2)}</span>
                            </>
                        ) : (
                            <>
                                <span>SYSTEM: Monitoring {activeProject?.name || 'Active Project'}</span>
                                <span>::</span>
                                <span>ALERTS: {stats?.alertCounts?.CRITICAL || 0} Critical / {stats?.alertCounts?.MODERATE || 0} Moderate</span>
                                <span>::</span>
                                <span>HEALTH: SPI {(stats?.spi || 1).toFixed(2)} / CPI {(stats?.cpi || 1).toFixed(2)}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
        </div>
    )
}
