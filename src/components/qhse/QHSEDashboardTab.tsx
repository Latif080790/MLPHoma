import React from 'react'
import { ShieldCheck } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { TabsContent } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { SEVERITY_BADGE_CONFIG, INCIDENT_TYPE_LABEL, RISK_LEVEL_COLORS } from '@/components/qhse/qhseConstants'
import type { SafetyIncident, IBPREntry, QHSESummary } from '@/types/qhse'

interface QHSEDashboardTabProps {
    summary: QHSESummary | null
    incidents: SafetyIncident[]
    ibpr: IBPREntry[]
}

export function QHSEDashboardTab({ summary, incidents, ibpr }: QHSEDashboardTabProps) {
    return (
        <>
            {/* KPI Cards */}
            {summary && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <Card className="border-l-4 border-l-red-500">
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Lost Time Injuries</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className={`text-3xl font-bold ${summary.ltiCount > 0 ? 'text-red-600' : 'text-green-600'}`}>{summary.ltiCount}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">LTI this project</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Total Incidents</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className="text-3xl font-bold">{summary.totalIncidents}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">{summary.nearMissCount} near misses</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">HSE Score</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className={`text-3xl font-bold ${summary.avgInspectionScore >= 85 ? 'text-green-600' : summary.avgInspectionScore >= 70 ? 'text-yellow-600' : 'text-red-600'}`}>
                                {summary.avgInspectionScore.toFixed(0)}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">avg inspection score</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader className="pb-1 pt-4 px-4">
                            <CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">TRIR</CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4 px-4">
                            <p className={`text-3xl font-bold ${summary.trir > 1 ? 'text-red-600' : 'text-green-600'}`}>{summary.trir.toFixed(2)}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">per 200,000 man-hours</p>
                        </CardContent>
                    </Card>
                </div>
            )}

            <TabsContent value="dashboard">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Recent Incidents</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {incidents.slice(0, 5).map(inc => (
                                <div key={inc.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0">
                                    {(() => {
                                        const cfg = SEVERITY_BADGE_CONFIG[inc.severity] ?? SEVERITY_BADGE_CONFIG.LOW
                                        return (
                                            <span className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs font-semibold shrink-0 ${cfg.cls}`}>
                                                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                                {inc.severity}
                                            </span>
                                        )
                                    })()}
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{inc.title}</p>
                                        <p className="text-xs text-muted-foreground">{INCIDENT_TYPE_LABEL[inc.type]} · {format(new Date(inc.incident_date), 'dd/MM/yyyy')}</p>
                                    </div>
                                    <Badge variant={inc.status === 'CLOSED' ? 'default' : 'secondary'} className="text-xs shrink-0">
                                        {inc.status}
                                    </Badge>
                                </div>
                            ))}
                            {incidents.length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    <ShieldCheck className="mx-auto h-8 w-8 mb-2 text-green-500" />
                                    Zero incidents reported.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle className="text-sm">Critical Hazards (IBPR)</CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            {ibpr.filter(i => i.risk_level === 'CRITICAL' || i.risk_level === 'HIGH').slice(0, 5).map(entry => (
                                <div key={entry.id} className="flex items-start gap-3 px-4 py-3 border-b last:border-b-0">
                                    <span className={`text-xs font-bold tabular-nums ${RISK_LEVEL_COLORS[entry.risk_level]}`}>
                                        RS:{entry.risk_score}
                                    </span>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">{entry.hazard}</p>
                                        <p className="text-xs text-muted-foreground truncate">{entry.activity}</p>
                                    </div>
                                    <Badge variant={entry.status === 'MITIGATED' ? 'default' : 'destructive'} className="text-xs shrink-0">
                                        {entry.status}
                                    </Badge>
                                </div>
                            ))}
                            {ibpr.filter(i => i.risk_level === 'CRITICAL' || i.risk_level === 'HIGH').length === 0 && (
                                <div className="text-center py-8 text-muted-foreground text-sm">
                                    <ShieldCheck className="mx-auto h-8 w-8 mb-2 text-green-500" />
                                    No critical or high hazards.
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </TabsContent>
        </>
    )
}
