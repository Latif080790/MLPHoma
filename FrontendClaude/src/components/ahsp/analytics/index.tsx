import React, { useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend
} from 'recharts'
import { useAHSPStore, getAHSPSummary } from '@/store/ahspStore'
import { formatIDR } from '@/lib/utils'

const COLORS = ['#0072B2', '#009E73', '#E69F00', '#CC6600', '#CC79A7']

export function BenchmarkingDashboard() {
    const { ahspItems, resources } = useAHSPStore()
    const storeState = useAHSPStore() as unknown as Parameters<typeof getAHSPSummary>[0]
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const summary = useMemo(() => getAHSPSummary(storeState), [ahspItems, resources])

    const categoryData = useMemo(() => {
        return Object.entries(summary.priceByCategory).map(([name, data]) => ({
            name,
            count: data.count,
            avgPrice: data.count > 0 ? data.totalPrice / data.count : 0
        })).sort((a, b) => b.avgPrice - a.avgPrice)
    }, [summary])

    const resourceData = useMemo(() => {
        return Object.entries(summary.resourcesByType).map(([name, data]) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value: data.count
        }))
    }, [summary])

    if (ahspItems.length === 0) {
        return (
            <div className="flex h-[400px] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
                No data available for analytics
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Average Price by Category</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" />
                                    <XAxis type="number" tickFormatter={(val) => `Rp ${(val / 1000000).toFixed(1)}M`} />
                                    <YAxis dataKey="name" type="category" width={100} style={{ fontSize: '12px' }} />
                                    <Tooltip
                                        formatter={(value: number) => formatIDR(value)}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Bar dataKey="avgPrice" fill="#0072B2" radius={[0, 4, 4, 0]} name="Avg Price" />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Resource Distribution</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[350px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={resourceData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {resourceData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
