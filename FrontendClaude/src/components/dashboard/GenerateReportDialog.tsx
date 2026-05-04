import React, { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react'
import { reportingService, ReportType, ReportFormat } from '@/services/reportingService'
import { DashboardStats } from '@/services/dashboardService'
import { toast } from 'sonner'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface Props {
    projectId: string
    projectName: string
    stats: DashboardStats
    children: React.ReactNode
}

export function GenerateReportDialog({ projectId, projectName, stats, children }: Props) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [type, setType] = useState<ReportType>('EXECUTIVE_SUMMARY')
    const [format, setFormat] = useState<ReportFormat>('PDF')

    const handleGenerate = async () => {
        if (!projectId || !stats) {
            toast.error('Data not available for report')
            return
        }

        setLoading(true)
        try {
            await reportingService.generateReport({
                projectId,
                projectName,
                stats,
                type,
                format
            })
            toast.success(`${format} report generated successfully!`)
            setOpen(false)
        } catch (error: unknown) {
            toast.error('Failed to generate report: ' + (error as Error).message)
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Generate Executive Report</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium">Report Type</label>
                        <Select value={type} onValueChange={(v: ReportType) => setType(v)}>
                            <SelectTrigger className="col-span-3">
                                <SelectValue placeholder="Select type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="EXECUTIVE_SUMMARY">Executive Summary</SelectItem>
                                <SelectItem value="WEEKLY_STATUS">Weekly Status Update</SelectItem>
                                <SelectItem value="RISK_AUDIT">Risk Audit Report</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid grid-cols-4 items-center gap-4">
                        <label className="text-right text-sm font-medium">Format</label>
                        <div className="col-span-3 flex gap-2">
                            <Button
                                variant={format === 'PDF' ? 'default' : 'outline'}
                                className="flex-1"
                                onClick={() => setFormat('PDF')}
                            >
                                <FileText className="mr-2 h-4 w-4" /> PDF
                            </Button>
                            <Button
                                variant={format === 'EXCEL' ? 'default' : 'outline'}
                                className="flex-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                                onClick={() => setFormat('EXCEL')}
                            >
                                <FileSpreadsheet className="mr-2 h-4 w-4" /> CSV/Excel
                            </Button>
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
                    <Button onClick={handleGenerate} disabled={loading} className="bg-blue-600 hover:bg-blue-700 text-white">
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Generate Now
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
