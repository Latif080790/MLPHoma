import React, { useMemo } from 'react'
import { FileKey } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { TabsContent } from '@/components/ui/tabs'
import { format, differenceInDays, parseISO } from 'date-fns'
import { AlertStrip } from '@/components/patterns'
import type { WorkPermit } from '@/types/qhse'

interface QHSEPermitsTabProps {
    permits: WorkPermit[]
}

export function QHSEPermitsTab({ permits }: QHSEPermitsTabProps) {
    const expiringPermits = useMemo(() => permits.filter(p => {
        if (!p.expiry_date || p.status === 'EXPIRED') return false
        const daysLeft = differenceInDays(parseISO(p.expiry_date), new Date())
        return daysLeft >= 0 && daysLeft <= 3
    }), [permits])

    return (
        <TabsContent value="permits">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-sm">Izin Kerja / Work Permits ({permits.length})</CardTitle>
                </CardHeader>
                <CardContent>
                    {/* Expiry warning banner */}
                    {expiringPermits.length > 0 && (
                        <AlertStrip
                            severity="warning"
                            message={`${expiringPermits.length} izin kerja berakhir dalam 3 hari — segera perbarui`}
                            className="mb-3"
                        />
                    )}
                    {permits.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <FileKey className="mx-auto h-10 w-10 mb-3 opacity-30" />
                            <p className="text-sm">Belum ada izin kerja terdaftar.</p>
                            <p className="text-xs mt-1">Izin kerja (Hot Work, Confined Space, dll.) akan ditampilkan di sini.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>No. Izin</TableHead>
                                    <TableHead>Judul</TableHead>
                                    <TableHead>Tipe</TableHead>
                                    <TableHead>Ditugaskan</TableHead>
                                    <TableHead>Berlaku</TableHead>
                                    <TableHead>Berakhir</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {permits.map(p => {
                                    const daysLeft = p.expiry_date && p.status !== 'EXPIRED'
                                        ? differenceInDays(parseISO(p.expiry_date), new Date())
                                        : null
                                    const isNearExpiry = daysLeft !== null && daysLeft >= 0 && daysLeft <= 3
                                    return (
                                        <TableRow key={p.id} className={isNearExpiry ? 'bg-amber-50/60' : undefined}>
                                            <TableCell className="font-mono text-xs">{p.permit_number}</TableCell>
                                            <TableCell className="font-medium text-sm">{p.title}</TableCell>
                                            <TableCell className="text-xs">{p.type.replace(/_/g, ' ')}</TableCell>
                                            <TableCell className="text-xs">{p.issued_to}</TableCell>
                                            <TableCell className="text-xs">{format(new Date(p.issue_date), 'dd/MM/yyyy')}</TableCell>
                                            <TableCell className="text-xs">
                                                <span className={isNearExpiry ? 'text-amber-600 font-semibold' : ''}>
                                                    {format(new Date(p.expiry_date), 'dd/MM/yyyy')}
                                                    {isNearExpiry && daysLeft !== null && (
                                                        <span className="ml-1 text-amber-500">({daysLeft}h lagi)</span>
                                                    )}
                                                </span>
                                            </TableCell>
                                            <TableCell>
                                                <Badge
                                                    variant={p.status === 'ACTIVE' ? 'default' : p.status === 'EXPIRED' ? 'destructive' : 'secondary'}
                                                    className="text-xs"
                                                >
                                                    {p.status}
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
