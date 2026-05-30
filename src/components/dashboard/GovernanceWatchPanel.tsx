import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, ArrowRight, ShieldAlert, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { forecastingService } from '@/services/forecastingService'
import { useNavigate } from 'react-router-dom'

interface AlertProject {
    id: string
    name: string
    spi: number
    cpi: number
    eac: number
    isRedAlert: boolean
}

interface GovernanceWatchPanelProps {
    alerts: AlertProject[]
}

const GovernanceWatchPanel: React.FC<GovernanceWatchPanelProps> = ({ alerts }) => {
    const navigate = useNavigate()
    const redAlerts = alerts.filter(a => a.isRedAlert)

    if (redAlerts.length === 0) {
        return (
            <Card className="bg-muted/20 border-border border-dashed">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center mb-3">
                        <ShieldAlert className="text-emerald-500" size={20} />
                    </div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Governance Clear</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">No projects currently meeting Red Alert drift criteria.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-[#0B1220] border-red-500/30 shadow-2xl overflow-hidden relative group">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500 animate-pulse" />
            <CardHeader className="pb-2 border-b border-border/50 bg-red-500/5">
                <CardTitle className="text-xs font-bold uppercase tracking-[0.2em] text-red-500 flex items-center gap-2">
                    <AlertCircle size={14} className="animate-bounce" /> Governance Watch: Red Alert Feed
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 max-h-[400px] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
                {redAlerts.map((project) => {
                    const mitigations = forecastingService.getMitigationSuggestions(project.spi, project.cpi)
                    
                    return (
                        <div key={project.id} className="p-4 border-b border-border/50 last:border-0 hover:bg-muted/20 transition-colors">
                            <div className="flex items-start justify-between mb-3">
                                <div>
                                    <h4 className="text-sm font-bold text-white font-mono uppercase truncate max-w-[220px]">
                                        {project.name}
                                    </h4>
                                    <div className="flex gap-2 mt-1">
                                        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20 font-mono">
                                            SPI: {project.spi.toFixed(2)}
                                        </Badge>
                                        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/20 font-mono">
                                            CPI: {project.cpi.toFixed(2)}
                                        </Badge>
                                    </div>
                                </div>
                                <Button 
                                    size="sm" 
                                    variant="ghost" 
                                    className="h-7 text-xs font-mono text-muted-foreground hover:text-white"
                                    onClick={() => navigate(`/cost-forecast?projectId=${project.id}`)}
                                >
                                    EAC DRILLDOWN <ArrowRight size={10} className="ml-1" />
                                </Button>
                            </div>

                            <div className="space-y-1.5 border-l-2 border-border pl-3">
                                <div className="text-xs uppercase font-bold text-muted-foreground flex items-center gap-1 mb-1">
                                    <Zap size={10} className="text-yellow-500" /> Prescriptive Mitigations
                                </div>
                                {mitigations.slice(0, 2).map((m, idx) => (
                                    <div key={idx} className="text-xs text-foreground leading-tight">
                                        • {m}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                })}
            </CardContent>
            <div className="p-2 bg-red-950/20 text-center">
                <span className="text-xs uppercase font-bold text-red-400 tracking-widest">
                    Executive attention mandatory for listed items
                </span>
            </div>
        </Card>
    )
}

export default GovernanceWatchPanel
