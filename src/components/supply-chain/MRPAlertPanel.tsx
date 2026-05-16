/**
 * MRPAlertPanel.tsx
 *
 * Dashboard card showing upcoming material shortages.
 * Color-coded by severity with quick action to create Material Request.
 * Integrates into CommandCenter and SupplyChain pages.
 */

import React, { useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { AlertTriangle, Package, Plus, Truck, Clock, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useRabStore } from '../../store/rabStore'
import { useTimelineStore } from '../../store/timelineStore'
import { useSupplyChainStore } from '../../store/supplyChainStore'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '../../lib/supabaseClient'
import { analyzeMaterialShortages, type MaterialAlert, type MRPSummary } from '../../services/mrpAlertService'
import type { TimelineTask as MRPTimelineTask } from '../../types/timeline'
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '../ui/tooltip'

// ─── Severity Badge ───

function SeverityBadge({ severity }: { severity: MaterialAlert['severity'] }) {
    const config = {
        critical: { label: 'Critical', className: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800' },
        warning: { label: 'Warning', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800' },
        info: { label: 'Info', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800' },
    }
    const c = config[severity]
    return <Badge variant="outline" className={`text-xs font-semibold ${c.className}`}>{c.label}</Badge>
}

// ─── Alert Row ───

function AlertRow({ alert, onCreateMR }: { alert: MaterialAlert; onCreateMR?: (alert: MaterialAlert) => void }) {
    return (
        <div className="flex items-center gap-3 py-2.5 px-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            {/* Icon */}
            <div className={`shrink-0 p-1.5 rounded-md ${alert.severity === 'critical' ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' :
                    alert.severity === 'warning' ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' :
                        'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                {alert.severity === 'critical' ? <AlertTriangle size={14} /> :
                    alert.severity === 'warning' ? <AlertCircle size={14} /> :
                        <Package size={14} />}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate capitalize">
                        {alert.resourceName}
                    </span>
                    <SeverityBadge severity={alert.severity} />
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    <span>Need: <strong className="text-slate-700 dark:text-slate-300">{alert.totalNeeded.toLocaleString()}</strong> {alert.unit}</span>
                    <span>Stock: <strong>{alert.currentStock.toLocaleString()}</strong></span>
                    <span className="text-red-600 dark:text-red-400 font-semibold">
                        Shortfall: {alert.shortfall.toLocaleString()}
                    </span>
                </div>
                {alert.taskName && (
                    <div className="flex items-center gap-1 mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        <Clock size={10} />
                        <span>{alert.taskName}</span>
                        {alert.daysUntilNeeded !== null && (
                            <span className="ml-1 font-semibold">
                                ({alert.daysUntilNeeded === 0 ? 'Today' : `${alert.daysUntilNeeded}d left`})
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Action */}
            {onCreateMR && (
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs shrink-0"
                                onClick={() => onCreateMR(alert)}
                            >
                                <Plus size={12} className="mr-1" /> MR
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent>Create Material Request for this shortage</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
        </div>
    )
}

// ─── Main Component ───

interface MRPAlertPanelProps {
    /** Compact mode for CommandCenter widget */
    compact?: boolean
    /** Callback when "Create MR" is clicked */
    onCreateMR?: (alert: MaterialAlert) => void
}

export function MRPAlertPanel({ compact = false, onCreateMR }: MRPAlertPanelProps) {
    const activeProjectId = useProjectStore(s => s.activeProjectId)
    const rabItems = useRabStore(s => activeProjectId ? s.getItems(activeProjectId) : [])
    const timelineTasks = useTimelineStore(s => activeProjectId ? s.getTasks(activeProjectId) : [])
    const { inventoryStock, purchaseOrders, fetchPurchaseOrders, fetchInventory } = useSupplyChainStore(
        useShallow(s => ({ inventoryStock: s.inventoryStock, purchaseOrders: s.purchaseOrders, fetchPurchaseOrders: s.fetchPurchaseOrders, fetchInventory: s.fetchInventory }))
    )

    // Realtime: auto-refresh when purchase_orders or inventory_transactions change
    useEffect(() => {
        if (!supabase || !activeProjectId) return
        const client = supabase
        const channel = client
            .channel(`mrp-supply-${activeProjectId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'purchase_orders', filter: `project_id=eq.${activeProjectId}` },
                () => { void fetchPurchaseOrders(activeProjectId) })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'inventory_transactions', filter: `project_id=eq.${activeProjectId}` },
                () => { void fetchInventory(activeProjectId) })
            .subscribe()
        return () => { void client.removeChannel(channel) }
    }, [activeProjectId, fetchPurchaseOrders, fetchInventory])

    const summary: MRPSummary = useMemo(() => {
        if (!activeProjectId) return { alerts: [], criticalCount: 0, warningCount: 0, infoCount: 0, totalShortfall: 0 }
        return analyzeMaterialShortages(rabItems, timelineTasks as unknown as MRPTimelineTask[], inventoryStock, purchaseOrders, activeProjectId)
    }, [activeProjectId, rabItems, timelineTasks, inventoryStock, purchaseOrders])

    const { alerts, criticalCount, warningCount, infoCount: _infoCount } = summary
    const totalAlerts = alerts.length
    const displayAlerts = compact ? alerts.slice(0, 3) : alerts

    return (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader className="pb-2 pt-4 px-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                            <Truck size={16} />
                        </div>
                        <CardTitle className="text-sm font-semibold">Material Alerts</CardTitle>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {criticalCount > 0 && (
                            <Badge variant="outline" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 text-xs h-5">
                                {criticalCount} Critical
                            </Badge>
                        )}
                        {warningCount > 0 && (
                            <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs h-5">
                                {warningCount} Warning
                            </Badge>
                        )}
                        {totalAlerts === 0 && (
                            <Badge variant="outline" className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 text-xs h-5">
                                <CheckCircle2 size={10} className="mr-1" /> All Clear
                            </Badge>
                        )}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4">
                {totalAlerts === 0 ? (
                    <div className="text-center py-6 text-sm text-slate-400 dark:text-slate-500">
                        <Package size={28} className="mx-auto mb-2 opacity-40" />
                        <p>No material shortages detected.</p>
                        <p className="text-xs mt-1">All materials are within planned supply levels.</p>
                    </div>
                ) : (
                    <div className="space-y-1.5 mt-1">
                        {displayAlerts.map(alert => (
                            <AlertRow key={alert.id} alert={alert} onCreateMR={onCreateMR} />
                        ))}
                        {compact && totalAlerts > 3 && (
                            <p className="text-center text-xs text-slate-400 mt-2">
                                +{totalAlerts - 3} more alerts in Supply Chain module
                            </p>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
