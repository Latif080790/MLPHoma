import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis, ZAxis, Tooltip, Cell, ReferenceLine, Label } from 'recharts'

interface ProjectData {
    id: string
    name: string
    spi: number
    cpi: number
    budget: number
}

interface PortfolioHeatmapProps {
    projects: ProjectData[]
}

const PortfolioHeatmap: React.FC<PortfolioHeatmapProps> = ({ projects }) => {
    // Process data for the chart
    const data = projects.map(p => ({
        x: p.spi,
        y: p.cpi,
        z: p.budget,
        name: p.name,
        id: p.id
    }))

    const renderTooltip = (props: any) => {
        const { active, payload } = props
        if (active && payload && payload.length) {
            const item = payload[0].payload
            return (
                <div className="bg-slate-900 border border-slate-700 p-2 rounded shadow-xl text-xs font-mono text-white">
                    <div className="font-bold text-blue-400 mb-1 tracking-wider uppercase">{item.name}</div>
                    <div className="flex justify-between gap-4">
                        <span className="text-slate-500">SPI (Schedule):</span>
                        <span className={item.x >= 1 ? 'text-emerald-400' : 'text-red-400'}>{item.x.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-4">
                        <span className="text-slate-500">CPI (Cost):</span>
                        <span className={item.y >= 1 ? 'text-emerald-400' : 'text-red-400'}>{item.y.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between gap-4 mt-1 border-t border-slate-800 pt-1">
                        <span className="text-slate-500">Budget:</span>
                        <span>Rp {(item.z / 1000000).toLocaleString()}M</span>
                    </div>
                </div>
            )
        }
        return null
    }

    return (
        <Card className="bg-slate-950 border-slate-800 text-white shadow-2xl overflow-hidden">
            <CardHeader className="pb-0">
                <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">
                    Governance Heatmap: Portfolio Performance Matrix
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[400px] w-full mt-4">
                <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 40, left: 40 }}>
                        <XAxis 
                            type="number" 
                            dataKey="x" 
                            name="SPI" 
                            domain={[0.5, 1.5]} 
                            stroke="#475569" 
                            tick={{ fontSize: 10, fill: '#64748b' }}
                        >
                            <Label value="Schedule Performance Index (SPI)" position="bottom" offset={20} style={{ fill: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                        </XAxis>
                        <YAxis 
                            type="number" 
                            dataKey="y" 
                            name="CPI" 
                            domain={[0.5, 1.5]} 
                            stroke="#475569" 
                            tick={{ fontSize: 10, fill: '#64748b' }}
                        >
                            <Label value="Cost Performance Index (CPI)" angle={-90} position="left" offset={20} style={{ fill: '#94a3b8', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                        </YAxis>
                        <ZAxis type="number" dataKey="z" range={[100, 1000]} />
                        <Tooltip content={renderTooltip} cursor={{ strokeDasharray: '3 3' }} />
                        
                        {/* Quadrant Markers */}
                        <ReferenceLine x={1} stroke="#1e293b" strokeWidth={2} />
                        <ReferenceLine y={1} stroke="#1e293b" strokeWidth={2} />

                        {/* Quadrant Labels */}
                        <text x="75%" y="25%" fill="#009E73" fontSize="10" fontWeight="bold" opacity="0.4" textAnchor="middle">TARGET ZONE</text>
                        <text x="25%" y="25%" fill="#E69F00" fontSize="10" fontWeight="bold" opacity="0.4" textAnchor="middle">BURN ZONE</text>
                        <text x="75%" y="75%" fill="#0072B2" fontSize="10" fontWeight="bold" opacity="0.4" textAnchor="middle">DRIFT ZONE</text>
                        <text x="25%" y="75%" fill="#CC6600" fontSize="10" fontWeight="bold" opacity="0.4" textAnchor="middle">DANGER ZONE</text>

                        <Scatter name="Projects" data={data}>
                            {data.map((entry, index) => {
                                let color = '#10b981' // Ideal (Top Right)
                                if (entry.x < 1 && entry.y < 1) color = '#ef4444' // Danger (Bottom Left)
                                else if (entry.x < 1) color = '#f59e0b' // Burn (Top Left)
                                else if (entry.y < 1) color = '#3b82f6' // Drift (Bottom Right)
                                
                                return <Cell key={`cell-${index}`} fill={color} fillOpacity={0.6} stroke={color} strokeWidth={2} />
                            })}
                        </Scatter>
                    </ScatterChart>
                </ResponsiveContainer>
            </CardContent>
            <div className="bg-slate-900/50 p-3 border-t border-slate-800 flex justify-between gap-4 overflow-x-auto">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500" />
                    <span className="text-xs text-slate-400 uppercase tracking-tighter font-mono font-bold">Optimal (Ahead/Under)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-amber-500" />
                    <span className="text-xs text-slate-400 uppercase tracking-tighter font-mono font-bold">Burn (Behind/Under)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-blue-500" />
                    <span className="text-xs text-slate-400 uppercase tracking-tighter font-mono font-bold">Drift (Ahead/Over)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-red-500" />
                    <span className="text-xs text-slate-400 uppercase tracking-tighter font-mono font-bold">Danger (Behind/Over)</span>
                </div>
            </div>
        </Card>
    )
}

export default PortfolioHeatmap
