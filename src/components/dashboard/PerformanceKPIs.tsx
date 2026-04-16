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
        <Card className="md:col-span-2 md:row-span-1 bg-gradient-to-br from-slate-900 to-slate-950 border-slate-800 text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none" />

            <CardContent className="p-6 h-full flex flex-col justify-between relative z-10">
                <div>
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-1">
                        {isPortfolioMode ? 'Portfolio Avg Performance' : 'Project Health Index (PHI)'}
                    </h3>
                    <div className="flex items-end gap-6">
                        <div className="flex items-end gap-2">
                            <span className={`text-4xl font-mono font-bold ${ratingColor}`}>
                                {phiScore}
                            </span>
                            <span className="text-sm text-slate-500 mb-1.5 font-mono">
                                / 100
                            </span>
                        </div>
                        <div className="h-10 w-px bg-slate-800" />
                        <div className="flex flex-col">
                            <span className="text-xs text-slate-500 uppercase">Rating</span>
                            <Badge variant="outline" className={`text-xs uppercase ${badgeColor}`}>
                                {rating}
                            </Badge>
                        </div>
                        
                        {!isPortfolioMode && stats?.phi?.factors && (
                            <div className="ml-2 flex flex-col items-end gap-0.5">
                                <span className="text-xs text-slate-600 uppercase tracking-widest">Factors</span>
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
                                className="h-7 px-3 text-xs font-mono text-slate-500 hover:text-white border border-slate-800 hover:bg-blue-600 transition-all uppercase tracking-tighter rounded"
                            >
                                Analyze Impact
                            </button>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-8 mt-4">
                    <div>
                        <div className="text-xs text-slate-500 uppercase">
                            {isPortfolioMode ? 'Avg CPI' : 'CPI'}
                        </div>
                        <div className={`text-sm font-mono font-bold ${cpiValue >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {cpiValue.toFixed(2)}
                        </div>
                    </div>
                    <div>
                        <div className="text-xs text-slate-500 uppercase">
                            {isPortfolioMode ? 'Avg SPI' : 'SPI'}
                        </div>
                        <div className={`text-sm font-mono font-bold ${spiValue >= 1 ? 'text-emerald-400' : 'text-red-400'}`}>
                            {spiValue.toFixed(2)}
                        </div>
                    </div>
                    <div className="h-6 w-px bg-slate-800" />
                    <div>
                        <div className="text-xs text-slate-500 uppercase">
                            {isPortfolioMode ? 'Active Projects' : 'Cost Variance'}
                        </div>
                        <div className="text-sm font-mono text-slate-300">
                            {isPortfolioMode ? portfolioStats?.totalProjects || 0 : (
                                <>
                                    {cpiValue >= 1 ? '+' : ''}{((cpiValue - 1) * 100).toFixed(1)}%
                                </>
                            )}
                        </div>
                    </div>
                    <div className="h-6 w-px bg-slate-800" />
                    <div>
                        <div className="text-xs text-slate-500 uppercase">
                            {isPortfolioMode ? 'Total Budget' : 'Schedule Var'}
                        </div>
                        <div className="text-sm font-mono text-slate-300">
                            {isPortfolioMode ? `Rp ${((portfolioStats?.totalBudget || 0) / 1e9).toFixed(1)}B` : (
                                <>
                                    {spiValue >= 1 ? '+' : ''}{((spiValue - 1) * 100).toFixed(1)}%
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
