import React, { useEffect, useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAHSPStore } from '../../store/ahspStore'
import { formatIDR } from '../../lib/utils'
import type { PriceHistory } from '../../types/ahsp'
import { format } from 'date-fns'
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
} from 'recharts'

interface PriceHistoryDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    ahspId: string
    zoneId?: string // Optional, if we want to filter by zone
    itemName: string
}

export function PriceHistoryDialog({
    open,
    onOpenChange,
    ahspId,
    zoneId,
    itemName,
}: PriceHistoryDialogProps) {
    const { fetchPriceHistory, loading, zones } = useAHSPStore()
    const [history, setHistory] = useState<PriceHistory[]>([])

    const loadHistory = async () => {
        const data = await fetchPriceHistory(ahspId, zoneId)
        setHistory(data)
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => {
        if (open && ahspId) {
            loadHistory()
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, ahspId, zoneId])

    const getZoneName = (zoneId?: string) => {
        if (!zoneId) return 'Harga Master'
        const zone = zones.find((z) => z.id === zoneId)
        return zone ? zone.name : 'Zona Tidak Diketahui'
    }

    const chartData = history
        .slice()
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(r => ({
            date: format(new Date(r.createdAt), 'dd MMM yy'),
            price: r.newPrice,
        }))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px]">
                <DialogHeader>
                    <DialogTitle>Riwayat Harga: {itemName}</DialogTitle>
                </DialogHeader>

                {chartData.length >= 2 && (
                    <div className="h-[160px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                                <YAxis
                                    tick={{ fontSize: 10 }}
                                    stroke="var(--muted-foreground)"
                                    tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                                    width={44}
                                />
                                <RechartsTooltip
                                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                                    formatter={(value: number) => [formatIDR(value), 'Harga']}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="price"
                                    stroke="#f97316"
                                    strokeWidth={2}
                                    fill="url(#priceGradient)"
                                    dot={{ r: 3, fill: '#f97316', strokeWidth: 0 }}
                                    activeDot={{ r: 5 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}

                <ScrollArea className="h-[400px] w-full rounded-md border p-4">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Tanggal</TableHead>
                                <TableHead>Zona</TableHead>
                                <TableHead>Tipe</TableHead>
                                <TableHead className="text-right">Harga Lama</TableHead>
                                <TableHead className="text-right">Harga Baru</TableHead>
                                <TableHead className="text-right">Perubahan</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading.priceHistory ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4">
                                        Memuat riwayat...
                                    </TableCell>
                                </TableRow>
                            ) : history.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="text-center py-4 text-muted-foreground">
                                        Belum ada perubahan harga yang tercatat.
                                    </TableCell>
                                </TableRow>
                            ) : (
                                history.map((record) => {
                                    const diff = record.newPrice - (record.oldPrice || 0)
                                    const isPositive = diff > 0
                                    // Check if zoneId exists in record (we added it in store but maybe not in type yet, let's cast if needed)
                                    const recordZoneId = (record as unknown as Record<string, unknown>).zoneId as string | undefined

                                    return (
                                        <TableRow key={record.id}>
                                            <TableCell className="font-medium text-xs text-muted-foreground whitespace-nowrap">
                                                {format(new Date(record.createdAt), 'dd MMM yyyy HH:mm')}
                                            </TableCell>
                                            <TableCell className="text-xs">
                                                {getZoneName(recordZoneId)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="text-xs uppercase">
                                                    {record.changeType?.replace('_', ' ')}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right text-muted-foreground">
                                                {formatIDR(record.oldPrice || 0)}
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">
                                                {formatIDR(record.newPrice)}
                                            </TableCell>
                                            <TableCell className={`text-right text-xs ${diff !== 0 ? (isPositive ? 'text-red-500' : 'text-green-500') : ''}`}>
                                                {diff !== 0 && (
                                                    <>
                                                        {isPositive ? '+' : ''}{formatIDR(diff)}
                                                    </>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
