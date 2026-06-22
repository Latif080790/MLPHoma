import React from 'react'
import { ShieldCheck, Plus } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabsContent } from '@/components/ui/tabs'
import { RISK_LEVEL_COLORS } from '@/components/qhse/qhseConstants'
import type { IBPREntry } from '@/types/qhse'

interface QHSEIBPRTabProps {
    ibpr: IBPREntry[]
    onOpenHazardDialog: () => void
}

export function QHSEIBPRTab({ ibpr, onOpenHazardDialog }: QHSEIBPRTabProps) {
    return (
        <TabsContent value="ibpr">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">IBPR — Identifikasi Bahaya & Penilaian Risiko ({ibpr.length})</CardTitle>
                    <Button size="sm" variant="outline" onClick={onOpenHazardDialog}>
                        <Plus className="h-3.5 w-3.5 mr-1" />Add Hazard
                    </Button>
                </CardHeader>
                <CardContent className="p-0">
                    {ibpr.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <ShieldCheck className="mx-auto h-10 w-10 mb-3 opacity-30" />
                            <p className="text-sm">No hazard entries found.</p>
                            <p className="text-xs mt-1">Document project hazards for risk management compliance.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Activity</TableHead>
                                    <TableHead>Hazard</TableHead>
                                    <TableHead>Type</TableHead>
                                    <TableHead className="text-center">L</TableHead>
                                    <TableHead className="text-center">S</TableHead>
                                    <TableHead className="text-center">Risk Score</TableHead>
                                    <TableHead>Level</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ibpr.map(entry => (
                                    <TableRow key={entry.id}>
                                        <TableCell className="text-xs max-w-[140px] truncate">{entry.activity}</TableCell>
                                        <TableCell className="text-sm font-medium max-w-[160px] truncate">{entry.hazard}</TableCell>
                                        <TableCell className="text-xs">{entry.hazard_type}</TableCell>
                                        <TableCell className="text-center text-xs font-mono">{entry.likelihood}</TableCell>
                                        <TableCell className="text-center text-xs font-mono">{entry.severity}</TableCell>
                                        <TableCell className="text-center">
                                            <span className={`text-sm font-bold ${RISK_LEVEL_COLORS[entry.risk_level]}`}>{entry.risk_score}</span>
                                        </TableCell>
                                        <TableCell>
                                            <span className={`text-xs font-semibold ${RISK_LEVEL_COLORS[entry.risk_level]}`}>{entry.risk_level}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={entry.status === 'MITIGATED' || entry.status === 'ELIMINATED' ? 'default' : 'secondary'} className="text-xs">
                                                {entry.status}
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
