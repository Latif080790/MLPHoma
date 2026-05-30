import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { AlertTriangle, ShieldCheck, Clock, Zap, Activity } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import GovernanceWatchPanel from './GovernanceWatchPanel'
import { DashboardStats } from '@/services/dashboardService'

interface OperationalAlertsProps {
    isPortfolioMode: boolean
    stats: DashboardStats | null
    portfolioStats: any
    onViewChange: () => void
    onViewResources: () => void
}

export const OperationalAlerts: React.FC<OperationalAlertsProps> = ({
    isPortfolioMode,
    stats,
    portfolioStats,
    onViewChange,
    onViewResources
}) => {
    return (
        <>
            {/* A. SAFETY / RISKS / GOVERNANCE WATCH */}
            {isPortfolioMode ? (
                <div className="md:col-span-1">
                    <GovernanceWatchPanel alerts={portfolioStats?.alerts || []} />
                </div>
            ) : (
                <Card className={`md:col-span-1 border-l-4 shadow-sm ${(stats?.criticalRisks || 0) > 0
                    ? 'border-l-red-500 bg-red-50/50 dark:bg-red-950/10'
                    : 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/10'
                    }`}>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between text-muted-foreground">
                            <span>Risk Radar</span>
                            {(stats?.criticalRisks || 0) > 0 ? <AlertTriangle size={16} className="text-red-500" /> : <ShieldCheck size={16} className="text-emerald-500" />}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-3xl font-bold text-foreground">
                            {stats?.criticalRisks || 0}
                        </div>
                        <div className="mt-2 space-y-1">
                            {stats?.topRisks?.slice(0, 2).map((risk, i) => {
                                const dotColor = risk.score >= 18 ? 'bg-red-500' : risk.score >= 12 ? 'bg-amber-500' : 'bg-yellow-500'
                                const textColor = risk.score >= 18 ? 'text-red-600 dark:text-red-400' : risk.score >= 12 ? 'text-amber-600 dark:text-amber-400' : 'text-yellow-600 dark:text-yellow-400'
                                return (
                                    <div key={i} className={`text-xs ${textColor} font-medium flex items-center gap-1`}>
                                        <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} />
                                        <span className="truncate">{risk.description}</span>
                                        <span className="font-mono text-muted-foreground ml-auto shrink-0 pl-1">{risk.score}</span>
                                    </div>
                                )
                            })}
                            {!stats?.topRisks?.length && (
                                <p className="text-xs text-muted-foreground">No open critical risks.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* B. SCHEDULE ALERTS */}
            <Card className="md:col-span-1 shadow-sm border-border dark:border-border">
                <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Clock size={16} className="text-amber-500" />
                        {isPortfolioMode ? 'Global Health' : 'Schedule Health'}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex items-end gap-2">
                        <div className="text-3xl font-bold font-mono text-foreground">
                            {isPortfolioMode ? portfolioStats?.globalAlertCounts?.CRITICAL || 0 : stats?.alertCounts?.CRITICAL || 0}
                        </div>
                        <div className="text-xs text-red-500 font-bold mb-1 uppercase">Critical</div>
                    </div>
                    <div className="mt-2 flex gap-1">
                        <Badge variant="outline" className="text-xs h-4 px-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                            {isPortfolioMode ? portfolioStats?.globalAlertCounts?.MODERATE || 0 : stats?.alertCounts?.MODERATE || 0} MOD
                        </Badge>
                        <Badge variant="outline" className="text-xs h-4 px-1 bg-blue-500/10 text-blue-600 border-blue-500/20">
                            {isPortfolioMode ? portfolioStats?.globalAlertCounts?.MINOR || 0 : stats?.alertCounts?.MINOR || 0} MIN
                        </Badge>
                    </div>
                </CardContent>
            </Card>

            {/* C. STRATEGIC ANOMALIES */}
            <Card className="md:col-span-1 shadow-sm border-border dark:border-border bg-[#111B2E] text-white">
                <CardHeader className="pb-2 border-b border-border/10 flex flex-row items-center justify-between space-y-0">
                    <CardTitle className="text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <Zap size={12} className="text-yellow-400" /> Strategic Anomalies
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground hover:text-white"
                        onClick={onViewResources}
                        title="Resource Heatmap"
                    >
                        <Activity size={12} />
                    </Button>
                </CardHeader>
                <CardContent className="p-3 space-y-2 min-h-[80px] flex flex-col justify-center">
                    {isPortfolioMode ? (
                        <div className="text-xs text-muted-foreground italic text-center">
                            Analyzing global pattern drift...
                        </div>
                    ) : stats?.anomalies && stats.anomalies.length > 0 ? (
                        stats.anomalies.map((anno, idx) => (
                            <div key={idx} className="p-1.5 rounded border border-red-500/20 bg-red-500/5">
                                <div className="flex items-center gap-1 mb-0.5">
                                    <AlertTriangle size={8} className="text-red-500" />
                                    <span className="text-xs font-bold text-red-500 uppercase">{anno.type}</span>
                                </div>
                                <div className="text-xs text-foreground leading-tight">{anno.description}</div>
                            </div>
                        ))
                    ) : (
                        <div className="text-xs text-emerald-500 font-mono text-center flex flex-col items-center gap-1">
                            <Activity size={14} className="animate-pulse" />
                            SYSTEMS OPTIMAL
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
    )
}
