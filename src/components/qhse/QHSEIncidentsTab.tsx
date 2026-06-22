import React from 'react'
import { ShieldCheck, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabsContent } from '@/components/ui/tabs'
import { format } from 'date-fns'
import { INCIDENT_TYPE_LABEL, SEVERITY_BADGE_CONFIG } from '@/components/qhse/qhseConstants'
import type { SafetyIncident } from '@/types/qhse'

interface QHSEIncidentsTabProps {
    incidents: SafetyIncident[]
    onOpenReportDialog: () => void
}

export function QHSEIncidentsTab({ incidents, onOpenReportDialog }: QHSEIncidentsTabProps) {
    return (
        <TabsContent value="incidents">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Safety Incidents ({incidents.length})</CardTitle>
                    <Button size="sm" variant="outline" onClick={onOpenReportDialog}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Report Incident
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    {incidents.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ShieldCheck className="mx-auto h-10 w-10 mb-3 text-green-400" />
                            <p className="text-sm font-medium text-green-600">Zero incidents recorded.</p>
                            <p className="text-xs mt-1 text-muted-foreground">Maintain this record by following safety protocols.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Incident No.</TableHead>
                                    <TableHead>Title</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead>Severity</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {incidents.map(inc => (
                                    <TableRow key={inc.id} style={inc.type === 'FATALITY' ? { backgroundColor: 'rgba(239,68,68,.15)' } : undefined}>
                                        <TableCell className="font-mono text-xs">{inc.incident_number}</TableCell>
                                        <TableCell>
                                            <div className="font-medium text-sm">{inc.title}</div>
                                            {inc.location && <div className="text-xs text-muted-foreground">{inc.location}</div>}
                                        </TableCell>
                                        <TableCell className="text-xs">{INCIDENT_TYPE_LABEL[inc.type]}</TableCell>
                                        <TableCell>
                                            {(() => {
                                                const cfg = SEVERITY_BADGE_CONFIG[inc.severity] ?? SEVERITY_BADGE_CONFIG.LOW
                                                return (
                                                    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>
                                                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                                                        {inc.severity}
                                                    </span>
                                                )
                                            })()}
                                        </TableCell>
                                        <TableCell className="text-xs">{format(new Date(inc.incident_date), 'dd/MM/yyyy')}</TableCell>
                                        <TableCell>
                                            <Badge variant={inc.status === 'CLOSED' ? 'default' : 'secondary'} className="text-xs">
                                                {inc.status.replace('_', ' ')}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </TabsContent>
    )
}
