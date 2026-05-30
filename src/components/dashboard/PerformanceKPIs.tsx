import React from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { MiniSparkline } from '@/components/ui/MiniSparkline'
import { DashboardStats } from '@/services/dashboardService'

interface PerformanceKPIsProps {
    isPortfolioMode: boolean
    stats: DashboardStats | null
    portfolioStats: any
    onAnalyzeImpact: () => void
}

export const PerformanceKPIs: React.FC<PerformanceKPIsProps> = ({
    isPortfolioMode,
    stats,
    portfolioStats,
    onAnalyzeImpact
}) => {
    const phiScore = isPortfolioMode ? Math.round(portfolioStats?.avgPhi || 0) : (stats?.phi?.score || 0)
    const rating = isPortfolioMode
        ? (phiScore >= 85 ? 'OPTIMAL' : phiScore >= 70 ? 'STABLE' : 'CRITICAL')
        : (stats?.phi?.rating || 'UNKNOWN')

    const ratingColor = phiScore >= 85 ? 'text-emerald-400' : phiScore >= 70 ? 'text-amber-400' : 'text-red-400'
    const badgeColor = phiScore >= 85 ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : phiScore >= 70 ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-red-500/10 text-red-500 border-red-500/20'

    const cpiValue = isPortfolioMode ? (portfolioStats?.avgCpi || 0) : (stats?.cpi || 0)
    const spiValue = isPortfolioMode ? (portfolioStats?.avgSpi || 0) : (stats?.spi || 0)

    return (
        <Card className="md:col-span-2 md:row-span-1 bg-gradient-to-br from-[#111B2E] to-[#070C18] border-border text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[rgba(249,115,22,0.04)] rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <CardContent className="p-6 h-full flex flex-col justify-between relative z-10">
                <div>
                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">
                        {isPortfolioMode ? 'Portfolio Avg Performance' : 'Project Health Index (PHI)'}
                    </h3>
                    <div className="flex items-end gap-6">
                        <div className="flex items-end gap-2">
                            <span className={`text-4xl font-mono font-bold ${ratingColor}`}>
                                {phiScore}
                            </span>
                            <span className="text-sm text-muted-foreground mb-1.5 font-mono">
                                / 100
                            </span>
                        </div>
                        <div className="h-10 w-px bg-white/10" />
                        <div className="flex flex-col">
                            <span className="text-xs text-muted-foreground uppercase">Rating</span>
                            <Badge variant="outline" className={`text-xs uppercase ${badgeColor}`}>
                                {rating}
                            </Badge>
                        </div>
                        
                        {!isPortfolioMode && stats?.phi?.factors && (
                            <div className="ml-2 flex flex-col items-end gap-0.5">
                                <span className="text-xs text-muted-foreground/60 uppercase tracking-widest">Factors</span>
                                <MiniSparkline
                                    data={[
                                        stats.phi.factors.financial,
                                        stats.phi.factors.schedule,
                                        stats.phi.factors.risk,
                                        stats.phi.factors.integrity,
                                        stats.phi.factors.compliance,
                                    ]}
                                    width={72}
                                    height={22}
                                    color={phiScore >= 85 ? '#10b981' : phiScore >= 70 ? '#f59e0b' : '#ef4444'}
                                />
                            </div>
                        )}
                        <div className="ml-auto">
                            <button
                                onClick={onAnalyzeImpact}
                                className="h-7 px-3 text-xs font-mono text-muted-foreground hover:text-white border border-white/10 hover:bg-primary transition-all uppercase tracking-tighter rounded"
                            >
                                Analyze Impact
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-6 mt-4 flex-wrap">
                    {/* CPI — large with delta pill */}
                    <div className="flex flex-col gap-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">
                            {isPortfolioMode ? 'Avg CPI' : 'CPI'}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-2xl font-mono font-bold leading-none ${cpiValue >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {cpiValue.toFixed(2)}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
                                cpiValue >= 1
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-red-500/15 text-red-400'
                            }`}>
                                {cpiValue >= 1 ? '+' : ''}{((cpiValue - 1) * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-white/10 shrink-0" />

                    {/* SPI — large with delta pill */}
                    <div className="flex flex-col gap-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">
                            {isPortfolioMode ? 'Avg SPI' : 'SPI'}
                        </div>
                        <div className="flex items-center gap-2">
                            <span className={`text-2xl font-mono font-bold leading-none ${spiValue >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {spiValue.toFixed(2)}
                            </span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-bold ${
                                spiValue >= 1
                                    ? 'bg-emerald-500/15 text-emerald-400'
                                    : 'bg-red-500/15 text-red-400'
                            }`}>
                                {spiValue >= 1 ? '+' : ''}{((spiValue - 1) * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    <div className="h-8 w-px bg-white/10 shrink-0" />

                    {/* Budget / Projects */}
                    <div className="flex flex-col gap-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">
                            {isPortfolioMode ? 'Active Projects' : 'Cost Var'}
                        </div>
                        <div className="text-lg font-mono font-semibold text-foreground leading-none">
                            {isPortfolioMode ? portfolioStats?.totalProjects || 0 : (
                                <span className={cpiValue >= 1 ? 'text-emerald-400' : 'text-red-400'}>
                                    {cpiValue >= 1 ? '+' : ''}{((cpiValue - 1) * 100).toFixed(1)}%
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Schedule Var / Total Budget */}
                    <div className="flex flex-col gap-1">
                        <div className="text-xs text-muted-foreground uppercase tracking-widest">
                            {isPortfolioMode ? 'Total Budget' : 'Sched Var'}
                        </div>
                        <div className="text-lg font-mono font-semibold leading-none">
                            {isPortfolioMode
                                ? <span className="text-foreground">{`Rp ${((portfolioStats?.totalBudget || 0) / 1e9).toFixed(1)}B`}</span>
                                : <span className={spiValue >= 1 ? 'text-emerald-400' : 'text-red-400'}>
                                    {spiValue >= 1 ? '+' : ''}{((spiValue - 1) * 100).toFixed(1)}%
                                  </span>
                            }
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
