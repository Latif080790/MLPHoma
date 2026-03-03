/**
 * CriticalPathWarningPanel.tsx
 * Displays schedule alerts and critical path warnings.
 * Helps PMs quickly identify tasks that are behind schedule.
 */

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { AlertTriangle, AlertCircle, Info, Clock, TrendingDown, ChevronDown, ChevronUp } from 'lucide-react'
import { scheduleAlertService, type ScheduleAlert } from '../../services/scheduleAlertService'
import { cn } from '../../lib/utils'

interface CriticalPathWarningPanelProps {
    projectId: string
    compact?: boolean
    maxAlerts?: number
}

const SEVERITY_CONFIG = {
    CRITICAL: {
        icon: AlertTriangle,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        badgeVariant: 'destructive' as const,
        label: 'Critical',
    },
    MODERATE: {
        icon: AlertCircle,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        badgeVariant: 'default' as const,
        label: 'Moderate',
    },
    MINOR: {
        icon: Info,
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
        badgeVariant: 'secondary' as const,
        label: 'Minor',
    },
}

export function CriticalPathWarningPanel({ 
    projectId, 
    compact: _compact = false,
    maxAlerts = 5 
}: CriticalPathWarningPanelProps) {
    const [alerts, setAlerts] = useState<ScheduleAlert[]>([])
    const [loading, setLoading] = useState(true)
    const [expanded, setExpanded] = useState<string[]>([])
    const [showAll, setShowAll] = useState(false)
    
    useEffect(() => {
        loadAlerts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId])
    
    const loadAlerts = async () => {
        setLoading(true)
        try {
            const data = await scheduleAlertService.getProjectAlerts(projectId)
            setAlerts(data)
        } catch {
            console.error('Failed to load schedule alerts')
        } finally {
            setLoading(false)
        }
    }
    
    const toggleExpand = (alertId: string) => {
        setExpanded(prev => 
            prev.includes(alertId) 
                ? prev.filter(id => id !== alertId)
                : [...prev, alertId]
        )
    }
    
    const displayedAlerts = showAll ? alerts : alerts.slice(0, maxAlerts)
    const hasMore = alerts.length > maxAlerts
    
    const criticalCount = alerts.filter(a => a.severity === 'CRITICAL').length
    const moderateCount = alerts.filter(a => a.severity === 'MODERATE').length
    const minorCount = alerts.filter(a => a.severity === 'MINOR').length
    
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Schedule Alerts
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground">Loading alerts...</div>
                </CardContent>
            </Card>
        )
    }
    
    if (alerts.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-5 w-5" />
                        Schedule Alerts
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-green-600 flex items-center gap-2">
                        <Info className="h-4 w-4" />
                        All tasks are on schedule!
                    </div>
                </CardContent>
            </Card>
        )
    }
    
    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-base flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-600" />
                        Schedule Alerts
                        {alerts.length > 0 && (
                            <Badge variant="outline">
                                {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        {criticalCount > 0 && (
                            <Badge variant="destructive" className="text-xs">
                                {criticalCount} Critical
                            </Badge>
                        )}
                        {moderateCount > 0 && (
                            <Badge variant="default" className="text-xs bg-amber-500">
                                {moderateCount} Moderate
                            </Badge>
                        )}
                        {minorCount > 0 && (
                            <Badge variant="secondary" className="text-xs">
                                {minorCount} Minor
                            </Badge>
                        )}
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                {displayedAlerts.map((alert) => {
                    const config = SEVERITY_CONFIG[alert.severity]
                    const Icon = config.icon
                    const isExpanded = expanded.includes(alert.id)
                    
                    return (
                        <div
                            key={alert.id}
                            className={cn(
                                'border rounded-lg p-3 space-y-2',
                                config.borderColor,
                                config.bgColor
                            )}
                        >
                            {/* Alert Header */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-start gap-2 flex-1 min-w-0">
                                    <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.color)} />
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm">
                                            {alert.taskCode && (
                                                <span className="text-muted-foreground mr-2">[{alert.taskCode}]</span>
                                            )}
                                            {alert.taskName}
                                        </div>
                                        <div className={cn('text-xs mt-1', config.color)}>
                                            {alert.message}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <Badge variant={config.badgeVariant} className="text-xs">
                                        {config.label}
                                    </Badge>
                                    {alert.isCriticalPath && (
                                        <Badge variant="outline" className="text-xs bg-red-100 border-red-300">
                                            Critical Path
                                        </Badge>
                                    )}
                                </div>
                            </div>
                            
                            {/* Metrics */}
                            <div className="grid grid-cols-3 gap-2 text-xs">
                                <div className="bg-white/50 rounded p-2">
                                    <div className="text-muted-foreground">Days Behind</div>
                                    <div className={cn('font-semibold', config.color)}>
                                        {alert.daysBehind} days
                                    </div>
                                </div>
                                <div className="bg-white/50 rounded p-2">
                                    <div className="text-muted-foreground">Progress</div>
                                    <div className="font-semibold">
                                        {alert.currentProgress.toFixed(0)}%
                                    </div>
                                </div>
                                <div className="bg-white/50 rounded p-2">
                                    <div className="text-muted-foreground">Projected Delay</div>
                                    <div className={cn('font-semibold', alert.projectedDelayDays > 0 ? 'text-red-600' : '')}>
                                        {alert.projectedDelayDays > 0 ? `+${alert.projectedDelayDays}` : '0'} days
                                    </div>
                                </div>
                            </div>
                            
                            {/* Expandable Recommendations */}
                            {alert.recommendations.length > 0 && (
                                <div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs -ml-2"
                                        onClick={() => toggleExpand(alert.id)}
                                    >
                                        {isExpanded ? (
                                            <>
                                                <ChevronUp className="h-3 w-3 mr-1" />
                                                Hide Recommendations
                                            </>
                                        ) : (
                                            <>
                                                <ChevronDown className="h-3 w-3 mr-1" />
                                                Show {alert.recommendations.length} Recommendation{alert.recommendations.length !== 1 ? 's' : ''}
                                            </>
                                        )}
                                    </Button>
                                    
                                    {isExpanded && (
                                        <div className="mt-2 bg-white/50 rounded p-2 space-y-1">
                                            {alert.recommendations.map((rec, idx) => (
                                                <div key={idx} className="flex gap-2 text-xs">
                                                    <TrendingDown className="h-3 w-3 mt-0.5 flex-shrink-0 text-blue-600" />
                                                    <span>{rec}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )
                })}
                
                {/* Show More/Less Button */}
                {hasMore && (
                    <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setShowAll(!showAll)}
                    >
                        {showAll ? (
                            <>
                                <ChevronUp className="h-4 w-4 mr-1" />
                                Show Less
                            </>
                        ) : (
                            <>
                                <ChevronDown className="h-4 w-4 mr-1" />
                                Show {alerts.length - maxAlerts} More Alert{alerts.length - maxAlerts !== 1 ? 's' : ''}
                            </>
                        )}
                    </Button>
                )}
            </CardContent>
        </Card>
    )
}
