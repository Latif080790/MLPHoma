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
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { useProjectStore } from '@/store/projectStore'
import { toast } from 'sonner'
import { assertSupabase } from '@/lib/supabaseClient'

import { HandoverSummary, OutstandingIssue, handoverService } from '@/services/handoverService'

export default function HandoverWizard() {
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

    useEffect(() => {
        if (!projectId) { setLoading(false); return }
        let cancelled = false
        const load = async () => {
            setLoading(true)
            try {
                const [s, o] = await Promise.all([
                    handoverService.getHandoverSummary(projectId),
                    handoverService.getOutstandingIssues(projectId)
                ])
                if (!cancelled) {
                    setSummary(s)
                    setOutstanding(o)
                }
            } catch (error) {
                if (!cancelled) toast.error("Failed to load handover data")
            } finally {
                if (!cancelled) setLoading(false)
            }
        }
        load()
        return () => { cancelled = true }
    }, [projectId])




    const handleGenerateReport = async () => {
        setGenerating(true)

        // Simulate heavy processing
        await new Promise(r => setTimeout(r, 2000))

        try {
            const element = document.getElementById('handover-report-content')
            if (!element) return

            const canvas = await html2canvas(element, { scale: 2 })
            const imgData = canvas.toDataURL('image/png')
            const pdf = new jsPDF('p', 'mm', 'a4')
            const pdfWidth = pdf.internal.pageSize.getWidth()
            const pdfHeight = (canvas.height * pdfWidth) / canvas.width

            pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight)
            pdf.save(`Final_Report_${project?.code || 'PROJECT'}.pdf`)

            setReportReady(true)
            toast.success("Report Generated Successfully")
        } catch (error) {
            toast.error("Failed to generate report")
        } finally {
            setGenerating(false)
        }
    }

    const handleMarkResolved = (issueId: string) => {
        setOutstanding(prev => prev.filter(i => i.id !== issueId))
        toast.success('Issue marked as resolved')
    }

    const handleArchiveProject = async () => {
        try {
            const client = assertSupabase()
            const { error } = await client
                .from('projects')
                .update({
                    status: 'ARCHIVED',
                    archived_at: new Date().toISOString()
                })
                .eq('id', project!.id)

            if (error) throw error
            toast.success("Project Archived!")
            setConfirmArchiveOpen(false)
            window.location.reload() // Force reload to refresh context
        } catch (err: any) {
            toast.error("Archive Failed", { description: err.message })
        }
    }

    if (!project) return <div className="p-8 text-center text-muted-foreground">Select a project to start handover.</div>

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-6">
            <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Project Handover Wizard</h1>
                <p className="text-muted-foreground">Finalize "{project.name}" and generate completion documents.</p>
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
                        <div className="flex flex-col items-center justify-center p-12 space-y-4">
                            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                            <p className="text-muted-foreground animate-pulse">Fetching project metrics...</p>
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
                                            {summary?.inventory.map((i: any, idx: number) => (
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
                                        <Button onClick={handleGenerateReport} disabled={generating}>
                                            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                                            {reportReady ? 'Download Again' : 'Generate & Download PDF'}
                                        </Button>
                                    </div>

                                    <div className="pt-6 border-t">
                                        <h3 className="font-medium text-red-600 mb-2">Danger Zone</h3>
                                        <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
                                            <div>
                                                <div className="font-medium text-red-900">Archive Project</div>
                                                <div className="text-sm text-red-700">Make read-only and hide from main dashboard.</div>
                                            </div>
                                            <Button
                                                variant="destructive"
                                                onClick={() => setConfirmArchiveOpen(true)}
                                                disabled={outstanding.length > 0}
                                            >
                                                Archive Project
                                            </Button>
                                            {outstanding.length > 0 && (
                                                <p className="text-[10px] text-red-500 mt-1">
                                                    Resolve all issues to archive
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

            {/* Hidden Report Template for PDF Generation */}
            <div id="handover-report-content" className="fixed top-0 left-[-9999px] w-[800px] h-auto bg-white p-12 text-slate-900">
                <h1 className="text-4xl font-bold mb-2">{project.name}</h1>
                <div className="text-xl text-slate-500 mb-8">Final Handover Report</div>

                <div className="space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold border-b pb-2 mb-4">1. Executive Summary</h2>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-slate-100 rounded">
                                <div className="text-sm">Final Budget</div>
                                <div className="text-xl font-bold">
                                    Rp {summary?.budget.actual.toLocaleString() || '0'}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-100 rounded">
                                <div className="text-sm">Completion Date</div>
                                <div className="text-xl font-bold">{summary?.schedule.actualFinish || '-'}</div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold border-b pb-2 mb-4">2. Asset Handover</h2>
                        <table className="w-full text-left">
                            <thead className="bg-slate-100">
                                <tr>
                                    <th className="p-2">Item</th>
                                    <th className="p-2">Qty</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summary?.inventory.map((i: any, idx: number) => (
                                    <tr key={idx} className="border-b">
                                        <td className="p-2">{i.materialName}</td>
                                        <td className="p-2">{i.current} {i.unit}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>

                    <div className="mt-12 pt-8 border-t flex justify-between">
                        <div>
                            <div className="mb-16">Approved By:</div>
                            <div className="border-t w-48 pt-2">Project Manager</div>
                        </div>
                        <div>
                            <div className="mb-16">Received By:</div>
                            <div className="border-t w-48 pt-2">Owner / Client</div>
                        </div>
                    </div>
                </div>
            </div>

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
