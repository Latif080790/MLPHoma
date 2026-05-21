import React, { Suspense, useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Layout, Zap, FileDown } from 'lucide-react'
import { differenceInDays, parseISO, isValid } from 'date-fns'
import { useProjectStore } from '@/store/projectStore'
import { useShallow } from 'zustand/react/shallow'
import { supabase } from '@/lib/supabaseClient'
import { dashboardService } from '@/services/dashboardService'
import { ApprovalInbox } from '@/components/dashboard/ApprovalInbox'
import { CriticalPathWarningPanel } from '@/components/dashboard/CriticalPathWarningPanel'
import { MRPAlertPanel } from '@/components/supply-chain/MRPAlertPanel'
import { AnomalyWidget } from '@/components/common/AnomalyWidget'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { ApprovalQueueWidget } from '@/components/dashboard/ApprovalQueueWidget'
import ModulePageState from '@/components/common/ModulePageState'
import { useNavigate } from 'react-router-dom'
import { lazyRetry } from '@/lib/lazyRetry'

import { useErrorHandler } from '@/hooks/useErrorHandler'
import { approvalService } from '@/services/approvalService'
import { Badge } from '@/components/ui/badge'
// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, ModeSwitch, SummaryStrip, WorkspaceHeader, AlertStrip } from '@/components/patterns'

// ── Modular Dashboard Components ───────────────────────────────────────────
import { TelemetryHUD } from '@/components/dashboard/TelemetryHUD'
import { PerformanceKPIs } from '@/components/dashboard/PerformanceKPIs'
import { OperationalAlerts } from '@/components/dashboard/OperationalAlerts'
import { ActivityLogStream } from '@/components/dashboard/ActivityLogStream'

const CommandCenterCashflowChart = lazyRetry(() => import('@/components/dashboard/CommandCenterCashflowChart'))

export default function CommandCenter() {
    type PortfolioStats = Awaited<ReturnType<typeof dashboardService.getPortfolioStats>>
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    const { activeProjectId, projects } = useProjectStore(
        useShallow(s => ({ activeProjectId: s.activeProjectId, projects: s.projects }))
    )
    const [isPortfolioMode, setIsPortfolioMode] = useState(false)
    const [srStatus, setSrStatus] = useState('')

    // ── react-query: project dashboard stats ─────────────────────────────────
    const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<ReturnType<typeof dashboardService.getProjectStats> extends Promise<infer T> ? T : never>({
        queryKey: ['dashboard', 'project', activeProjectId],
        queryFn: () => dashboardService.getProjectStats(activeProjectId!),
        enabled: !isPortfolioMode && !!activeProjectId,
        staleTime: 30_000,
    })

    // ── react-query: portfolio stats ─────────────────────────────────────────
    const { data: portfolioStats, isLoading: portfolioLoading, error: portfolioError } = useQuery<PortfolioStats>({
        queryKey: ['dashboard', 'portfolio'],
        queryFn: () => dashboardService.getPortfolioStats(),
        enabled: isPortfolioMode,
        staleTime: 30_000,
    })

    // ── react-query: overdue / escalated approvals for SLA indicators ────────
    const { data: overdueApprovals = [] } = useQuery({
        queryKey: ['approvals', 'overdue', activeProjectId],
        queryFn: () => approvalService.getOverdueApprovals(activeProjectId ?? undefined),
        enabled: !isPortfolioMode && !!activeProjectId,
        staleTime: 60_000,
    })

    const overdueCount = overdueApprovals.length
    const escalatedCount = overdueApprovals.filter(a => a.status === 'ESCALATED').length

    const loading = isPortfolioMode ? portfolioLoading : statsLoading
    const pageError = isPortfolioMode
        ? (portfolioError ? 'Unable to load portfolio telemetry data.' : null)
        : (statsError ? 'Unable to load command center metrics for the active project.' : null)

    const { handleError: _handleError } = useErrorHandler()

    // Realtime: auto-refresh when timeline_tasks change for the active project
    useEffect(() => {
        if (!supabase || !activeProjectId) return
        const channel = supabase
            .channel(`cmd-center-tasks-${activeProjectId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'timeline_tasks',
                filter: `project_id=eq.${activeProjectId}`,
            }, () => {
                void queryClient.invalidateQueries({ queryKey: ['dashboard', 'project', activeProjectId] })
            })
            .subscribe()
        return () => { void supabase?.removeChannel(channel) }
    }, [activeProjectId, queryClient])

    const activeProject = projects[activeProjectId || '']

    // ── Day X of Y counter ───────────────────────────────────────────────────
    const dayCounter = React.useMemo(() => {
        if (!activeProject?.startDate || !activeProject?.endDate) return null
        const start = parseISO(activeProject.startDate)
        const end = parseISO(activeProject.endDate)
        if (!isValid(start) || !isValid(end)) return null
        const today = new Date()
        const elapsed = differenceInDays(today, start) + 1
        const total = differenceInDays(end, start) + 1
        const remaining = differenceInDays(end, today)
        if (total <= 0) return null
        return { elapsed: Math.max(1, elapsed), total, remaining }
    }, [activeProject])

    if (!activeProjectId) {
        return (
            <ModulePageState
                icon={<Layout size={18} />}
                title="Command Center"
                description="Project telemetry and operational overview."
                variant="empty"
                message="Select an active project to initialize the Command Center telemetry panel."
            />
        )
    }

    if (loading && !stats && !portfolioStats) {
        return (
            <ModulePageState
                icon={<Layout size={18} />}
                title="Command Center"
                description="Project telemetry and operational overview."
                variant="loading"
                message="Loading command center telemetry..."
            />
        )
    }

    if (pageError && !stats && !portfolioStats) {
        return (
            <ModulePageState
                icon={<Layout size={18} />}
                title="Command Center"
                description="Project telemetry and operational overview."
                variant="error"
                message={pageError}
            />
        )
    }

    // ── Build health items for context bar ───────────────────────────────────
    const healthItems = stats ? [
        {
            label: 'PHI',
            level: ((stats.phi?.score ?? 0) >= 85 ? 'good' : (stats.phi?.score ?? 0) >= 70 ? 'warning' : 'critical') as 'good' | 'warning' | 'critical',
            value: `${stats.phi?.score ?? 0}`,
        },
        {
            label: 'CPI',
            level: ((stats.cpi ?? 1) >= 1 ? 'good' : 'critical') as 'good' | 'warning' | 'critical',
            value: (stats.cpi ?? 1).toFixed(2),
        },
        {
            label: 'SPI',
            level: ((stats.spi ?? 1) >= 1 ? 'good' : 'critical') as 'good' | 'warning' | 'critical',
            value: (stats.spi ?? 1).toFixed(2),
        },
    ] : []

    // ── SummaryStrip metrics ─────────────────────────────────────────────────
    const summaryItems = isPortfolioMode
        ? [
            { label: 'Projects', value: portfolioStats?.totalProjects || 0, status: 'neutral' as const },
            { label: 'Avg PHI', value: Math.round(portfolioStats?.avgPhi || 0), status: ((portfolioStats?.avgPhi ?? 0) >= 85 ? 'success' : (portfolioStats?.avgPhi ?? 0) >= 70 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger' },
            { label: 'Avg CPI', value: (portfolioStats?.avgCpi || 0).toFixed(2), status: ((portfolioStats?.avgCpi ?? 1) >= 1 ? 'success' : 'danger') as 'success' | 'danger' },
            { label: 'Avg SPI', value: (portfolioStats?.avgSpi || 0).toFixed(2), status: ((portfolioStats?.avgSpi ?? 1) >= 1 ? 'success' : 'danger') as 'success' | 'danger' },
            { label: 'Total Budget', value: `Rp ${((portfolioStats?.totalBudget || 0) / 1e9).toFixed(1)}B`, status: 'neutral' as const },
        ]
        : stats ? [
            { label: 'PHI', value: stats.phi?.score || 0, status: ((stats.phi?.score ?? 0) >= 85 ? 'success' : (stats.phi?.score ?? 0) >= 70 ? 'warning' : 'danger') as 'success' | 'warning' | 'danger' },
            { label: 'CPI', value: (stats.cpi || 0).toFixed(2), status: ((stats.cpi ?? 1) >= 1 ? 'success' : 'danger') as 'success' | 'danger' },
            { label: 'SPI', value: (stats.spi || 0).toFixed(2), status: ((stats.spi ?? 1) >= 1 ? 'success' : 'danger') as 'success' | 'danger' },
            { label: 'Critical', value: stats.alertCounts?.CRITICAL || 0, status: ((stats.alertCounts?.CRITICAL || 0) > 0 ? 'danger' : 'success') as 'danger' | 'success' },
            { label: 'Risks', value: stats.criticalRisks || 0, status: ((stats.criticalRisks || 0) > 0 ? 'warning' : 'success') as 'warning' | 'success' },
            ...(dayCounter
                ? [{
                    label: `Hari ${dayCounter.elapsed}/${dayCounter.total}`,
                    value: `${dayCounter.remaining >= 0 ? dayCounter.remaining : 0} hari lagi`,
                    status: (dayCounter.remaining < 0 ? 'danger' : dayCounter.remaining < dayCounter.total * 0.2 ? 'warning' : 'success') as 'success' | 'warning' | 'danger',
                }]
                : []),
            { label: 'SLA Breach', value: overdueCount, status: (overdueCount > 0 ? 'danger' : 'success') as 'danger' | 'success' },
        ] : []

    const criticalCount = isPortfolioMode ? (portfolioStats?.globalAlertCounts?.CRITICAL || 0) : (stats?.alertCounts?.CRITICAL || 0)

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={isPortfolioMode ? 'All Projects' : (activeProject?.name || 'Active Project')}
                    packageName={isPortfolioMode ? 'Portfolio Mode' : undefined}
                    versionLabel="v3.2.0"
                    syncStatus="synced"
                    healthItems={isPortfolioMode ? [] : healthItems}
                    actions={[
                        ...(!isPortfolioMode && activeProject && stats ? [{
                            label: 'Export',
                            icon: <FileDown className="h-3 w-3" />,
                            onClick: () => { /* handled by GenerateReportDialog via TelemetryHUD */ },
                        }] : []),
                    ]}
                />
            }
            navigation={
                <ModeSwitch
                    options={[
                        { value: 'project', label: 'Project', icon: <Layout className="h-3.5 w-3.5" /> },
                        { value: 'portfolio', label: 'Portfolio', icon: <Zap className="h-3.5 w-3.5" /> },
                    ]}
                    value={isPortfolioMode ? 'portfolio' : 'project'}
                    onChange={(v) => {
                        setIsPortfolioMode(v === 'portfolio')
                        setSrStatus(v === 'portfolio' ? 'Switched to portfolio mode.' : 'Switched to project mode.')
                    }}
                />
            }
            header={
                <WorkspaceHeader
                    title="Command Center"
                    subtitle={isPortfolioMode ? 'Consolidated portfolio telemetry' : `${activeProject?.name || 'Project'} — operational overview`}
                    primaryAction={!isPortfolioMode && activeProject && stats ? {
                        label: 'Analyze Impact',
                        icon: <Zap className="h-3.5 w-3.5" />,
                        onClick: () => navigate('/strategy-simulation'),
                    } : undefined}
                    secondaryActions={!isPortfolioMode && activeProject && stats ? [{
                        label: 'Export Report',
                        icon: <FileDown className="h-3.5 w-3.5" />,
                        onClick: () => { /* handled by TelemetryHUD internally */ },
                    }] : []}
                />
            }
            summary={
                summaryItems.length > 0 ? <SummaryStrip items={summaryItems} variant="chips" /> : undefined
            }
            alert={
                (overdueCount > 0 || criticalCount > 0) ? (
                    <>
                        {overdueCount > 0 && (
                            <AlertStrip
                                severity="danger"
                                message={`${overdueCount} approval request melewati SLA deadline — butuh tindakan segera`}
                                action={{ label: 'Lihat Approval', onClick: () => navigate('/approvals') }}
                            />
                        )}
                        {criticalCount > 0 && (
                            <AlertStrip
                                severity="danger"
                                message={`${criticalCount} critical alert${criticalCount > 1 ? 's' : ''} require immediate attention`}
                                action={{ label: 'View Risks', onClick: () => navigate('/change-management') }}
                            />
                        )}
                    </>
                ) : undefined
            }
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
            
            <TelemetryHUD
                isPortfolioMode={isPortfolioMode}
                activeProject={activeProject ? { id: activeProjectId!, name: activeProject.name } : null}
                stats={stats ?? null}
                portfolioStats={portfolioStats ?? null}
                srStatus={srStatus}
                onTogglePortfolio={() => setIsPortfolioMode(!isPortfolioMode)}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)] mt-4">
                <PerformanceKPIs
                    isPortfolioMode={isPortfolioMode}
                    stats={stats ?? null}
                    portfolioStats={portfolioStats ?? null}
                    onAnalyzeImpact={() => navigate('/strategy-simulation')}
                />

                <OperationalAlerts
                    isPortfolioMode={isPortfolioMode}
                    stats={stats ?? null}
                    portfolioStats={portfolioStats ?? null}
                    onViewChange={() => navigate('/change-management')}
                    onViewResources={() => navigate('/portfolio-resources')}
                />

                {/* E. FINANCIAL FLOW (Wide Chart) */}
                <Suspense fallback={<div className="md:col-span-3 h-[300px] w-full animate-pulse rounded-md bg-slate-100 dark:bg-slate-800" />}>
                   <div className="md:col-span-3 md:row-span-2">
                    <CommandCenterCashflowChart
                            isPortfolioMode={isPortfolioMode}
                            cashflow={isPortfolioMode ? [] : (stats?.cashflow || [])}
                        />
                   </div>
                </Suspense>

                <ActivityLogStream activityFeed={stats?.activityFeed} />

                {/* F. APPROVAL INBOX & MRP ALERTS (Side by Side) */}
                <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-1">
                        {escalatedCount > 0 && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0 h-4 font-semibold tracking-wide">
                                {escalatedCount} ESCALATED
                            </Badge>
                        )}
                    </div>
                    <ApprovalQueueWidget projectId={activeProjectId} />
                </div>
                <div className="md:col-span-2">
                    <ApprovalInbox />
                </div>
                <div className="md:col-span-2">
                    <MRPAlertPanel compact />
                </div>
                <div className="md:col-span-2">
                    <AnomalyWidget projectId={activeProjectId} compact />
                </div>

                {/* G. CRITICAL PATH WARNING PANEL */}
                <div className="md:col-span-4">
                    <CriticalPathWarningPanel
                        projectId={activeProjectId}
                        maxAlerts={5}
                    />
                </div>

                {/* H. AUDIT TRAIL (Recent Activity) */}
                <div className="md:col-span-4">
                    <AuditLogViewer compact title="Recent Activity" />
                </div>
            </div>
        </PageShell>
    )
}

