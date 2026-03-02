/**
 * CashflowForecastWidget.tsx
 * Displays rolling cashflow forecast with visual chart and summary metrics.
 * Helps PMs plan for upcoming financial needs.
 */

import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { TrendingUp, TrendingDown, AlertTriangle, DollarSign, Info } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import {
    calculateCashflowForecast,
    buildHistoricalTransactionsFromFinance,
    buildScheduledTransactionsFromFinance,
    formatCurrency,
    type CashflowForecast,
} from '../../lib/cashflowForecast'
import { cn } from '../../lib/utils'
import type { Invoice, ClientClaim, FinanceTransaction } from '../../types/finance'

interface CashflowForecastWidgetProps {
    projectId: string
    forecastWeeks?: 4 | 8
    currentBalance?: number
    compact?: boolean
    invoices?: Invoice[]
    claims?: ClientClaim[]
    transactions?: FinanceTransaction[]
}

const HEALTH_CONFIG = {
    HEALTHY: {
        icon: TrendingUp,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        badgeVariant: 'default' as const,
        label: 'Healthy',
        description: 'Positive cashflow projected',
    },
    WARNING: {
        icon: AlertTriangle,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        badgeVariant: 'default' as const,
        label: 'Warning',
        description: 'Cashflow concerns detected',
    },
    CRITICAL: {
        icon: TrendingDown,
        color: 'text-red-600',
        bgColor: 'bg-red-50',
        borderColor: 'border-red-200',
        badgeVariant: 'destructive' as const,
        label: 'Critical',
        description: 'Urgent cashflow action needed',
    },
}

export function CashflowForecastWidget({
    projectId,
    forecastWeeks = 4,
    currentBalance = 500000000, // Default 500M IDR
    _compact = false,
    invoices = [],
    claims = [],
    transactions = [],
}: CashflowForecastWidgetProps) {
    const [forecast, setForecast] = useState<CashflowForecast | null>(null)
    const [loading, setLoading] = useState(true)
    const [showWeeks, setShowWeeks] = useState<4 | 8>(forecastWeeks)
    
    useEffect(() => {
        loadForecast()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, showWeeks, currentBalance, invoices, claims, transactions])
    
    const loadForecast = async () => {
        setLoading(true)
        try {
            const historicalTransactions = buildHistoricalTransactionsFromFinance({
                invoices,
                claims,
                transactions,
            })
            const scheduledTransactions = buildScheduledTransactionsFromFinance(
                { invoices, claims, transactions },
                showWeeks,
            )
            
            const result = calculateCashflowForecast(
                currentBalance,
                historicalTransactions,
                showWeeks,
                true,
                scheduledTransactions,
            )
            
            setForecast(result)
        } catch (error) {
            console.error('Failed to calculate cashflow forecast:', error)
        } finally {
            setLoading(false)
        }
    }
    
    if (loading) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Cashflow Forecast
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground">Loading forecast...</div>
                </CardContent>
            </Card>
        )
    }
    
    if (!forecast) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-5 w-5" />
                        Cashflow Forecast
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-sm text-muted-foreground">No data available</div>
                </CardContent>
            </Card>
        )
    }
    
    const config = HEALTH_CONFIG[forecast.summary.healthStatus]
    const Icon = config.icon
    
    // Prepare chart data
    const chartData = forecast.weeks.map(w => ({
        week: w.week,
        Inflow: w.inflow,
        Outflow: -w.outflow, // Negative for visual clarity
        Net: w.net,
    }))
    
    return (
        <Card className={cn('shadow-sm', config.borderColor, 'border-l-4')}>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-emerald-600" />
                        Cashflow Forecast
                        <Badge variant="outline" className="ml-2 text-xs">
                            {showWeeks}-Week
                        </Badge>
                    </CardTitle>
                    
                    <div className="flex items-center gap-2">
                        <Badge variant={config.badgeVariant} className="text-xs flex items-center gap-1">
                            <Icon className="h-3 w-3" />
                            {config.label}
                        </Badge>
                        <div className="flex gap-1">
                            <Button
                                variant={showWeeks === 4 ? 'default' : 'outline'}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setShowWeeks(4)}
                            >
                                4w
                            </Button>
                            <Button
                                variant={showWeeks === 8 ? 'default' : 'outline'}
                                size="sm"
                                className="h-7 text-xs"
                                onClick={() => setShowWeeks(8)}
                            >
                                8w
                            </Button>
                        </div>
                    </div>
                </div>
            </CardHeader>
            
            <CardContent className="space-y-4">
                {/* Summary Metrics */}
                <div className="grid grid-cols-4 gap-3">
                    <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground mb-1">Current Balance</div>
                        <div className="text-sm font-semibold">
                            {formatCurrency(forecast.currentBalance)}
                        </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground mb-1">Projected Balance</div>
                        <div className={cn(
                            'text-sm font-semibold',
                            forecast.projectedBalance > forecast.currentBalance ? 'text-green-600' : 'text-red-600'
                        )}>
                            {formatCurrency(forecast.projectedBalance)}
                        </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground mb-1">Net Cashflow</div>
                        <div className={cn(
                            'text-sm font-semibold',
                            forecast.summary.netCashflow >= 0 ? 'text-green-600' : 'text-red-600'
                        )}>
                            {forecast.summary.netCashflow >= 0 ? '+' : ''}
                            {formatCurrency(Math.abs(forecast.summary.netCashflow))}
                        </div>
                    </div>
                    
                    <div className="bg-muted/50 rounded-lg p-3">
                        <div className="text-xs text-muted-foreground mb-1">Runway</div>
                        <div className={cn(
                            'text-sm font-semibold',
                            forecast.summary.runwayDays < 0 ? '' :
                            forecast.summary.runwayDays < 14 ? 'text-red-600' :
                            forecast.summary.runwayDays < 30 ? 'text-amber-600' : 'text-green-600'
                        )}>
                            {forecast.summary.runwayDays < 0 ? 'Infinite' : `${forecast.summary.runwayDays}d`}
                        </div>
                    </div>
                </div>
                
                {/* Chart */}
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.1)" />
                            <XAxis
                                dataKey="week"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                dy={5}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
                                tickFormatter={(value) => {
                                    const absValue = Math.abs(value)
                                    if (absValue >= 1000000) return `${(absValue / 1000000).toFixed(0)}M`
                                    if (absValue >= 1000) return `${(absValue / 1000).toFixed(0)}K`
                                    return value.toString()
                                }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--popover))',
                                    borderColor: 'hsl(var(--border))',
                                    borderRadius: '8px',
                                    fontSize: '12px'
                                }}
                                formatter={(value: number, name: string) => {
                                    const absValue = Math.abs(value)
                                    return [formatCurrency(absValue), name]
                                }}
                            />
                            <Legend
                                wrapperStyle={{ fontSize: '11px' }}
                                iconType="circle"
                            />
                            <Bar dataKey="Inflow" fill="#10b981" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="Outflow" fill="#ef4444" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                
                {/* Health Warning */}
                {forecast.summary.healthStatus !== 'HEALTHY' && (
                    <div className={cn('rounded-lg p-3 flex items-start gap-2', config.bgColor, config.borderColor, 'border')}>
                        <Icon className={cn('h-5 w-5 mt-0.5 flex-shrink-0', config.color)} />
                        <div className="flex-1">
                            <div className={cn('text-sm font-medium', config.color)}>
                                {config.description}
                            </div>
                            {forecast.summary.healthStatus === 'CRITICAL' && forecast.summary.runwayDays > 0 && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    Cash reserves projected to deplete in {forecast.summary.runwayDays} days. 
                                    Consider accelerating receivables or deferring non-critical payments.
                                </div>
                            )}
                            {forecast.summary.healthStatus === 'WARNING' && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    Negative cashflow trend detected. Monitor upcoming payments and receivables closely.
                                </div>
                            )}
                        </div>
                    </div>
                )}
                
                {/* Info Note */}
                <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/30 rounded p-2">
                    <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                    <span>
                        Forecast based on {showWeeks === 4 ? '4' : '8'}-week historical average. 
                        Actual results may vary based on payment timing and project changes.
                    </span>
                </div>
            </CardContent>
        </Card>
    )
}
