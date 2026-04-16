import React, { Suspense, useEffect, useState } from 'react'
import { Layout, Zap, FileDown } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { dashboardService, DashboardStats } from '@/services/dashboardService'
import { toast } from 'sonner'
import { ApprovalInbox } from '@/components/dashboard/ApprovalInbox'
import { CriticalPathWarningPanel } from '@/components/dashboard/CriticalPathWarningPanel'
import { MRPAlertPanel } from '@/components/supply/MRPAlertPanel'
import { AuditLogViewer } from '@/components/audit/AuditLogViewer'
import { ApprovalQueueWidget } from '@/components/dashboard/ApprovalQueueWidget'
import ModulePageState from '@/components/common/ModulePageState'
import { useNavigate } from 'react-router-dom'
import { lazyRetry } from '@/lib/lazyRetry'

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
    const { activeProjectId, projects } = useProjectStore()
    const [stats, setStats] = useState<DashboardStats | null>(null)
    const [portfolioStats, setPortfolioStats] = useState<PortfolioStats | null>(null)
    const [isPortfolioMode, setIsPortfolioMode] = useState(false)
    const [loading, setLoading] = useState(false)
    const [pageError, setPageError] = useState<string | null>(null)
    const [srStatus, setSrStatus] = useState('')

    // Load Data
    useEffect(() => {
        queueMicrotask(() => {
            setLoading(true)
            setPageError(null)
            setSrStatus(isPortfolioMode ? 'Loading portfolio command center telemetry...' : 'Loading project command center telemetry...')
        })
        if (isPortfolioMode) {
            dashboardService.getPortfolioStats()
                .then((data) => {
                    setPortfolioStats(data)
                    setSrStatus('Portfolio command center telemetry loaded.')
                })
                .catch(() => {
                    setPageError('Unable to load portfolio telemetry data.')
                    toast.error("Failed to load portfolio data")
                    setSrStatus('Failed to load portfolio telemetry data.')
                })
                .finally(() => setLoading(false))
        } else if (activeProjectId) {
            dashboardService.getProjectStats(activeProjectId)
                .then((data) => {
                    setStats(data)
                    setSrStatus('Project command center telemetry loaded.')
                })
                .catch(() => {
                    setPageError('Unable to load command center metrics for the active project.')
                    toast.error("Failed to load project data")
                    setSrStatus('Failed to load project command center telemetry data.')
                })
                .finally(() => setLoading(false))
        } else {
            setSrStatus('No active project selected for command center.')
            queueMicrotask(() => setLoading(false))
        }
    }, [activeProjectId, isPortfolioMode])

    const activeProject = projects[activeProjectId || '']

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
                criticalCount > 0 ? (
                    <AlertStrip
                        severity="danger"
                        message={`${criticalCount} critical alert${criticalCount > 1 ? 's' : ''} require immediate attention`}
                        action={{ label: 'View Risks', onClick: () => navigate('/change-management') }}
                    />
                ) : undefined
            }
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
            
            <TelemetryHUD
                isPortfolioMode={isPortfolioMode}
                activeProject={activeProject ? { id: activeProjectId!, name: activeProject.name } : null}
                stats={stats}
                portfolioStats={portfolioStats}
                srStatus={srStatus}
                onTogglePortfolio={() => setIsPortfolioMode(!isPortfolioMode)}
            />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)] mt-4">
                <PerformanceKPIs
                    isPortfolioMode={isPortfolioMode}
                    stats={stats}
                    portfolioStats={portfolioStats}
                    onAnalyzeImpact={() => navigate('/strategy-simulation')}
                />

                <OperationalAlerts
                    isPortfolioMode={isPortfolioMode}
                    stats={stats}
                    portfolioStats={portfolioStats}
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
                    <ApprovalQueueWidget projectId={activeProjectId} />
                </div>
                <div className="md:col-span-2">
                    <ApprovalInbox />
                </div>
                <div className="md:col-span-2">
                    <MRPAlertPanel compact />
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

