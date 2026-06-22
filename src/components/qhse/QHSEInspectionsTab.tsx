import React from 'react'
import { ClipboardCheck, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabsContent } from '@/components/ui/tabs'
import { format } from 'date-fns'
import type { HSEInspection } from '@/types/qhse'

interface QHSEInspectionsTabProps {
    inspections: HSEInspection[]
    onOpenScheduleDialog: () => void
}

export function QHSEInspectionsTab({ inspections, onOpenScheduleDialog }: QHSEInspectionsTabProps) {
    return (
        <TabsContent value="inspections">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">HSE Inspections ({inspections.length})</CardTitle>
                    <Button size="sm" variant="outline" onClick={onOpenScheduleDialog}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Schedule Inspection
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    {inspections.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ClipboardCheck className="mx-auto h-10 w-10 mb-3 opacity-30" />
                            <p className="text-sm">No inspections scheduled.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Inspection No.</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Scheduled</TableHead>
                                    <TableHead>Checklist</TableHead>
                                    <TableHead>Score</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {inspections.map(ins => {
                                    const totalItems = ins.checklist?.length ?? 0
                                    const completedItems = ins.checklist?.filter(i => i.status === 'OK').length ?? 0
                                    const checkPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
                                    return (
                                        <TableRow key={ins.id} style={ins.score != null && ((ins.score / (ins.max_score || 100)) * 100) < 80 ? { backgroundColor: 'rgba(245,158,11,.08)' } : undefined}>
                                            <TableCell className="font-mono text-xs">{ins.inspection_number}</TableCell>
                                            <TableCell className="font-medium text-sm">{ins.title}</TableCell>
                                            <TableCell className="text-xs">{ins.type}</TableCell>
                                            <TableCell className="text-xs">
                                                <span className={new Date(ins.scheduled_date) < new Date() && ins.status !== 'COMPLETED' ? 'text-red-600 font-medium' : ''}>
                                                    {format(new Date(ins.scheduled_date), 'dd/MM/yyyy')}
                                                </span>
                                            </TableCell>
                                            <TableCell className="text-xs min-w-[120px]">
                                                {totalItems > 0 ? (
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 h-1.5 rounded-full bg-slate-100">
                                                            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${checkPct}%` }} />
                                                        </div>
                                                        <span className="font-mono text-slate-500 shrink-0">{completedItems}/{totalItems}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {ins.score != null
                                                    ? `${((ins.score / (ins.max_score || 100)) * 100).toFixed(0)}%`
                                                    : '—'}
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={ins.status === 'COMPLETED' ? 'default' : ins.status === 'FAILED' ? 'destructive' : 'secondary'}
                                                    className="text-xs"
                                                >
                                                    {ins.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
    )
}
