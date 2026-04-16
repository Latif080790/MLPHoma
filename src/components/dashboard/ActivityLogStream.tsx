import React from 'react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { format } from 'date-fns'
import { DashboardStats } from '@/services/dashboardService'

interface ActivityLogStreamProps {
    activityFeed?: DashboardStats['activityFeed']
}

export const ActivityLogStream: React.FC<ActivityLogStreamProps> = ({ activityFeed }) => {
    return (
        <Card className="md:col-span-1 md:row-span-2 bg-slate-950 border-slate-800 text-slate-300 shadow-xl flex flex-col">
            <CardHeader className="py-3 border-b border-slate-800">
                <CardTitle className="text-xs font-mono font-bold uppercase tracking-widest text-slate-500">
                    LOG: ACTIVITY_STREAM
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-0 overflow-hidden relative">
                <div className="absolute inset-0 overflow-y-auto p-4 space-y-2.5 font-mono text-xs scrollbar-thin scrollbar-thumb-slate-700">
                    {activityFeed?.map((item, i) => {
                        const avatarCfg =
                            item.type === 'RISK' ? { bg: 'bg-red-600', text: '!', label: 'RISK' } :
                                item.type === 'PO' ? { bg: 'bg-blue-600', text: '₱', label: 'PO' } :
                                    { bg: 'bg-emerald-600', text: '★', label: 'MILESTONE' }
                        return (
                            <div key={i} className="flex items-start gap-2.5 opacity-90 hover:opacity-100 transition-opacity group">
                                <div className={`h-6 w-6 rounded-full ${avatarCfg.bg} flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5`}
                                    title={avatarCfg.label}>
                                    {avatarCfg.text}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="text-slate-600">[{format(new Date(item.date), 'HH:mm')}]</span>
                                        <span className={`text-xs uppercase font-bold tracking-wider px-1 py-0.5 rounded ${item.type === 'RISK' ? 'text-red-400 bg-red-400/10' :
                                            item.type === 'PO' ? 'text-blue-400 bg-blue-400/10' :
                                                'text-emerald-400 bg-emerald-400/10'
                                            }`}>{item.type}</span>
                                    </div>
                                    <div className="text-slate-300 truncate mt-0.5">{item.message}</div>
                                </div>
                            </div>
                        )
                    })}
                    {(!activityFeed || activityFeed.length === 0) && (
                        <div className="text-slate-600 italic">-- No recent events --</div>
                    )}
                    {/* Cursor blink effect */}
                    <div className="h-4 w-2 bg-blue-500 animate-pulse mt-2" />
                </div>
            </CardContent>
        </Card>
    )
}
