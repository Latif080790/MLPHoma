import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Check, Download, AlertTriangle, FileText, ArrowRight, Loader2 } from "lucide-react"
import { useProjectStore } from '@/store/projectStore'
import { PermissionGuard } from '@/components/common/PermissionGuard'
import { toast } from 'sonner'
import { useErrorHandler } from '@/hooks/useErrorHandler'
import ModulePageState from '@/components/common/ModulePageState'
import { Skeleton } from '@/components/common/LoadingSkeleton'

import { HandoverSummary, OutstandingIssue, handoverService } from '@/services/handoverService'
import { prerequisiteCheckService, HandoverReadiness } from '@/services/prerequisiteCheckService'

export default function HandoverWizard() {
    type InventoryItem = HandoverSummary['inventory'][number]
    const { handleAsync } = useErrorHandler()
    const activeProjectId = useProjectStore((s) => s.activeProjectId)
    const projects = useProjectStore((s) => s.projects)
    const project = activeProjectId ? projects[activeProjectId] : null
    const projectId = project?.id ?? null
    const [step, setStep] = useState(1)
    const [generating, setGenerating] = useState(false)
    const [reportReady, setReportReady] = useState(false)
    const [loading, setLoading] = useState(true)
    const [summary, setSummary] = useState<HandoverSummary | null>(null)
    const [outstanding, setOutstanding] = useState<OutstandingIssue[]>([])
    const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false)
    const [pageError, setPageError] = useState<string | null>(null)
    const [srStatus, setSrStatus] = useState('')
    const [readiness, setReadiness] = useState<HandoverReadiness | null>(null)
    const [checkingReadiness, setCheckingReadiness] = useState(false)

    useEffect(() => {
        if (!projectId) {
            queueMicrotask(() => setLoading(false))
            return
        }
        let cancelled = false
        const load = async () => {
            queueMicrotask(() => {
                setSrStatus('Loading handover metrics...')
                setLoading(true)
                setPageError(null)
            })
            const result = await handleAsync(async () => {
                const [s, o] = await Promise.all([
                    handoverService.getHandoverSummary(projectId),
                    handoverService.getOutstandingIssues(projectId)
                ])
                return { s, o }
            }, 'data.sync_failed', { showToast: false })

            if (result && !cancelled) {
                setSummary(result.s)
                setOutstanding(result.o)
                setSrStatus('Handover metrics loaded.')
                
                // Perform readiness check
                setCheckingReadiness(true)
                const readyResult = await prerequisiteCheckService.checkHandoverReady(projectId)
                if (!cancelled) {
                    setReadiness(readyResult)
                    setCheckingReadiness(false)
                }
            }

            if (!result && !cancelled) {
                setPageError('Failed to load handover metrics and outstanding issues.')
                toast.error("Failed to load handover data")
                setSrStatus('Failed to load handover data.')
            }

            if (!cancelled) setLoading(false)
        }
        load()
        return () => { cancelled = true }
    }, [projectId, handleAsync])




    const handleGenerateReport = async () => {
        setSrStatus('Generating handover PDF report...')
        setGenerating(true)
        if (summary && project) {
            const generated = await handleAsync(async () => {
                await handoverService.generateHandoverReport(project.id, summary, outstanding)
                return true
            }, 'document.general')

            if (generated) {
                setReportReady(true)
                toast.success("Report Generated Successfully")
                setSrStatus('Handover report generated successfully.')
            } else {
                setSrStatus('Failed to generate handover report.')
            }
        }

        setGenerating(false)
    }

    const handleMarkResolved = (issueId: string) => {
        setOutstanding(prev => prev.filter(i => i.id !== issueId))
        toast.success('Issue marked as resolved')
        setSrStatus('Outstanding issue marked as resolved.')
    }

    const handleArchiveProject = async () => {
        const archived = await handleAsync(async () => {
            await useProjectStore.getState().archiveProject(project!.id)
            return true
        }, 'document.general')

        if (archived) {
            setConfirmArchiveOpen(false)
            setSrStatus('Project archived successfully.')
        } else {
            setSrStatus('Failed to archive project.')
        }
    }

    if (!project) {
        return (
            <ModulePageState
                icon={<Check size={18} />}
                title="Project Handover Wizard"
                description="Finalize project and generate handover documents."
                variant="empty"
                message="Select an active project to start handover workflow."
            />
        )
    }

    if (loading && !summary) {
        return (
            <ModulePageState
                icon={<Check size={18} />}
                title="Project Handover Wizard"
                description="Finalize project and generate handover documents."
                variant="loading"
                message="Loading handover readiness data..."
            />
        )
    }

    if (pageError && !summary) {
        return (
            <ModulePageState
                icon={<Check size={18} />}
                title="Project Handover Wizard"
                description="Finalize project and generate handover documents."
                variant="error"
                message={pageError}
            />
        )
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Project Handover Wizard</h1>
                <p className="text-muted-foreground">Finalize &quot;{project.name}&quot; and generate completion documents.</p>
            </div>

            {/* Steps Indicator */}
            <div className="flex justify-center gap-4">
                {[1, 2, 3, 4].map(s => (
                    <div key={s} className={`flex items-center gap-2 ${step >= s ? 'text-blue-600' : 'text-neutral-400'}`}>
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center border font-bold ${step >= s ? 'bg-blue-100 border-blue-600' : 'bg-white'}`}>
                            {step > s ? <Check className="w-5 h-5" /> : s}
                        </div>
                        <span className="text-sm font-medium hidden md:block">
                            {s === 1 ? 'Summary' : s === 2 ? 'Inventory' : s === 3 ? 'Outstanding' : 'Finalize'}
                        </span>
                        {s < 4 && <div className="w-8 h-px bg-neutral-200" />}
                    </div>
                ))}
            </div>

            <Card className="min-h-[400px] flex flex-col">
                <CardHeader>
                    <CardTitle>
                        {step === 1 && "Executive Summary Check"}
                        {step === 2 && "Remaining Asset Inventory"}
                        {step === 3 && "Outstanding Issues & Defects"}
                        {step === 4 && "Final Report & Archival"}
                    </CardTitle>
                    <CardDescription>
                        {step === 1 && "Review high-level metrics before closing."}
                        {step === 2 && "Items that need to be returned or transferred."}
                        {step === 3 && "Ensure all punch-list items are resolved or noted."}
                        {step === 4 && "Generate official documentation and archive project."}
                    </CardDescription>
                </CardHeader>

                <CardContent className="flex-1">
                    {loading ? (
                        <div className="space-y-6 p-4" aria-live="polite" aria-busy="true">
                            <div className="grid gap-4 md:grid-cols-3">
                                {Array.from({ length: 3 }).map((_, idx) => (
                                    <div key={`hw-kpi-skeleton-${idx}`} className="rounded-lg border p-4 space-y-2">
                                        <Skeleton className="h-4 w-28" />
                                        <Skeleton className="h-8 w-20" />
                                        <Skeleton className="h-3 w-24" />
                                    </div>
                                ))}
                            </div>
                            <div className="rounded-md border p-4 space-y-3">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                                <Skeleton className="h-10 w-full" />
                            </div>
                            <p className="text-sm text-muted-foreground">Fetching project metrics...</p>
                        </div>
                    ) : (
                        <>
                            {step === 1 && summary && (
                                <div className="grid gap-6 md:grid-cols-3">
                                    <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                                        <div className="text-sm text-green-700 font-medium">Budget Efficiency</div>
                                        <div className="text-2xl font-bold text-green-800">
                                            {summary.budget.variance >= 0 ? '+' : ''}{summary.budget.variance}%
                                        </div>
                                        <div className="text-xs text-green-600 mt-1">
                                            {summary.budget.variance >= 0 ? 'Under Budget' : 'Over Budget'}
                                        </div>
                                    </div>
                                    <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                                        <div className="text-sm text-blue-700 font-medium">Schedule Status</div>
                                        <div className="text-2xl font-bold text-blue-800">{summary.schedule.status}</div>
                                        <div className="text-xs text-blue-600 mt-1">Actual: {summary.schedule.actualFinish}</div>
                                    </div>
                                    <div className="p-4 border rounded-lg bg-slate-50 border-slate-200">
                                        <div className="text-sm text-slate-700 font-medium">Safety Record</div>
                                        <div className="text-2xl font-bold text-slate-800">{summary.safety.incidents} Incidents</div>
                                        <div className="text-xs text-slate-600 mt-1">{summary.safety.manhours.toLocaleString()} Manhours</div>
                                    </div>
                                </div>
                            )}


                            {step === 2 && (
                                <div className="rounded-md border">
                                    <table className="w-full text-sm">
                                        <thead className="bg-slate-50 border-b">
                                            <tr>
                                                <th className="p-3 text-left">Item Name</th>
                                                <th className="p-3 text-right">Qty</th>
                                                <th className="p-3 text-right">Est. Value</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary?.inventory.map((i: InventoryItem, idx: number) => (
                                                <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                                                    <td className="p-3">{i.materialName}</td>
                                                    <td className="p-3 text-right">{i.current} {i.unit}</td>
                                                    <td className="p-3 text-right">Rp {i.value.toLocaleString()}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    <div className="p-4 bg-yellow-50 text-yellow-800 text-sm mt-4 rounded border border-yellow-200 flex gap-2">
                                        <AlertTriangle className="w-4 h-4 shrink-0" />
                                        These items must be transferred to Warehouse or sold before closing.
                                    </div>
                                </div>
                            )}

                            {step === 3 && (
                                <div className="space-y-4">
                                    {outstanding.map(issue => (
                                        <div key={issue.id} className="flex items-center gap-4 p-4 border rounded-lg">
                                            <AlertTriangle className="text-orange-500 w-5 h-5" />
                                            <div className="flex-1">
                                                <div className="font-medium">{issue.desc}</div>
                                                <Badge variant="outline">{issue.priority}</Badge>
                                            </div>
                                            <Button variant="ghost" size="sm" onClick={() => handleMarkResolved(issue.id)}>Mark Resolved</Button>
                                        </div>
                                    ))}
                                    {outstanding.length === 0 && (
                                        <div className="text-center p-8 text-neutral-400">No outstanding issues. Good job!</div>
                                    )}
                                </div>
                            )}

                            {step === 4 && (
                                <div className="space-y-6">
                                    <div className="p-6 border-2 border-dashed rounded-lg bg-slate-50 flex flex-col items-center justify-center text-center space-y-4">
                                        <FileText className="w-12 h-12 text-slate-400" />
                                        <div>
                                            <h3 className="font-medium">Final Project Report</h3>
                                            <p className="text-sm text-muted-foreground max-w-sm">
                                                Generates a comprehensive PDF including Budget, Schedule, Assets, and Safety records.
                                            </p>
                                        </div>
                                        <Button onClick={handleGenerateReport} disabled={generating} aria-busy={generating}>
                                            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                            {generating ? 'Generating PDF...' : reportReady ? 'Download Again' : 'Generate & Download PDF'}
                                        </Button>
                                    </div>

                                    {readiness && !readiness.isReady && (
                                        <div className="p-4 border rounded-lg bg-red-50 border-red-200 space-y-2">
                                            <div className="flex items-center gap-2 text-red-800 font-semibold">
                                                <AlertTriangle className="w-5 h-5" />
                                                Compliance Blockers Detected
                                            </div>
                                            <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                                                {readiness.reasons.map((reason, idx) => (
                                                    <li key={idx}>{reason}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {readiness && readiness.isReady && (
                                        <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                                            <div className="flex items-center gap-2 text-green-800 font-semibold">
                                                <Check className="w-5 h-5" />
                                                Handover Compliance Met
                                            </div>
                                            <p className="text-sm text-green-700">All physical and financial prerequisites have been verified.</p>
                                        </div>
                                    )}

                                    <div className="pt-6 border-t">
                                        <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
                                        <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                                            <div>
                                                <div className="font-medium text-red-900">Archive Project</div>
                                                <div className="text-sm text-red-700">Make read-only and hide from main dashboard.</div>
                                            </div>
                                            <PermissionGuard requiredRole="manager" showDisabled>
                                                <Button
                                                    variant="destructive"
                                                    onClick={() => setConfirmArchiveOpen(true)}
                                                    disabled={outstanding.length > 0 || !readiness?.isReady || checkingReadiness}
                                                >
                                                    {checkingReadiness ? 'Checking...' : 'Archive Project'}
                                                </Button>
                                            </PermissionGuard>
                                            {(outstanding.length > 0 || !readiness?.isReady) && (
                                                <p className="text-xs text-red-500 mt-1">
                                                    Resolve all compliance issues to archive
                                                </p>
                                            )}

                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>

                <div className="p-6 border-t bg-slate-50 flex justify-between">
                    <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
                        Back
                    </Button>
                    <Button onClick={() => setStep(s => Math.min(4, s + 1))} disabled={step === 4} className={step === 4 ? 'hidden' : ''}>
                        Next Step <ArrowRight className="ml-2 w-4 h-4" />
                    </Button>
                    {step === 4 && (
                        <Button variant="outline" onClick={() => { window.location.hash = '/' }}>
                            Close Wizard
                        </Button>
                    )}
                </div>
            </Card>

            {/* Hidden Report Template removed as we generate PDF programmatically now */}

            <AlertDialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Archive this project?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will hide the project from the main dashboard and mark it as archived.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleArchiveProject}>Archive</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
