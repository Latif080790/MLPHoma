import React, { useState, useMemo } from 'react'
import { useTimelineStore } from '@/store/timelineStore'
import { useProjectStore } from '@/store/projectStore'
import { useCurvaSStore } from '@/store/curvaSStore'
import { Camera, MapPin, CheckCircle2, Clock, Calendar, Check, AlertCircle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { timelineService } from '@/services/timelineService'

export default function FieldTasks() {
    const project = useProjectStore((s) => s.getActiveProject?.() ?? null)
    const projectId = project?.id ?? 'demo'

    const { getTasks, updateTask } = useTimelineStore()
    const { addDataPoint } = useCurvaSStore()

    const tasks = getTasks(projectId)

    const [activeTab, setActiveTab] = useState<'todo' | 'completed'>('todo')
    const [selectedTask, setSelectedTask] = useState<string | null>(null)

    // Form State
    const [progressVal, setProgressVal] = useState<number>(0)
    const [notes, setNotes] = useState('')
    const [photoUrl, setPhotoUrl] = useState('')
    const [uploading, setUploading] = useState(false)
    const [gpsCoords, setGpsCoords] = useState<{ latitude: number; longitude: number } | null>(null)
    const [gpsLoading, setGpsLoading] = useState(false)

    const filteredTasks = useMemo(() => {
        return tasks.filter(t => {
            const isDone = (t.progress || 0) >= 100 || t.status === 'completed'
            if (activeTab === 'todo') return !isDone
            return isDone
        }).sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    }, [tasks, activeTab])

    const openLogDialog = (taskId: string) => {
        const t = tasks.find(x => x.id === taskId)
        if (t) {
            setSelectedTask(taskId)
            setProgressVal(t.progress || 0)
            setNotes('')
            setPhotoUrl('')
            setGpsCoords(null)
        }
    }

    const captureGps = () => {
        if (!navigator.geolocation) {
            toast.error("Geolocation not supported")
            return
        }
        setGpsLoading(true)
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                setGpsCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude })
                setGpsLoading(false)
                toast.success("GPS Captured")
            },
            (err) => {
                toast.error("Could not capture GPS.")
                setGpsLoading(false)
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        try {
            const url = await timelineService.uploadProgressPhoto(file, `progress/${projectId}`)
            setPhotoUrl(url)
            toast.success("Photo uploaded successfully")
        } catch (err: any) {
            toast.error("Upload failed", { description: err.message })
        } finally {
            setUploading(false)
        }
    }

    const handleSubmit = () => {
        if (!selectedTask) return
        if (!photoUrl) {
            toast.warning("Photo evidence is required for field reports.")
            return
        }
        if (!gpsCoords) {
            toast.warning("GPS location is required for field reports.")
            return
        }

        const t = tasks.find(x => x.id === selectedTask)
        if (!t) return

        // Calculate generic cost increment based on progress delta (for demo logic) if needed.
        // Real logic would calculate from RAB / AHSP.
        const delta = Math.max(0, progressVal - (t.progress || 0))
        const costIncrement = delta > 0 ? 500000 : 0 // dummy allocation mapping

        // 1. Update timeline task
        let status = t.status || 'in_progress'
        if (progressVal >= 100) status = 'completed'
        else if (progressVal > 0) status = 'in_progress'

        updateTask(projectId, t.id, { progress: progressVal, status })

        // 2. Log to CurvaS
        addDataPoint(projectId, {
            id: crypto.randomUUID(),
            projectId,
            date: new Date().toISOString().split('T')[0],
            plannedProgress: t.progress || 0,
            plannedCost: 0,
            actualProgress: progressVal,
            actualCost: costIncrement,
            notes: notes || `Field Update: ${t.name}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        } as any)

        toast.success("Progress logged successfully.")
        setSelectedTask(null)
    }

    return (
        <div className="flex flex-col h-[calc(100vh-60px)] md:h-[calc(100vh-100px)] bg-background">
            {/* Mobile Header */}
            <div className="bg-muted/50 border-b border-border px-4 py-3 z-10 shrink-0">
                <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-nl-orange" />
                    <h1 className="text-base font-bold text-foreground tracking-tight">Field Tasks</h1>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 pl-4">{project?.name || 'Loading Project...'}</p>
            </div>

            {/* Tabs */}
            <div className="flex bg-card border-b border-border shrink-0">
                <button
                    onClick={() => setActiveTab('todo')}
                    className={`flex-1 min-h-[44px] py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'todo' ? 'border-nl-orange text-nl-orange' : 'border-transparent text-muted-foreground hover:text-muted-foreground'}`}
                >
                    To Do ({tasks.filter(t => (t.progress || 0) < 100).length})
                </button>
                <button
                    onClick={() => setActiveTab('completed')}
                    className={`flex-1 min-h-[44px] py-3 text-sm font-bold transition-colors border-b-2 ${activeTab === 'completed' ? 'border-nl-orange text-nl-orange' : 'border-transparent text-muted-foreground hover:text-muted-foreground'}`}
                >
                    Completed ({tasks.filter(t => (t.progress || 0) >= 100).length})
                </button>
            </div>

            {/* Task List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {filteredTasks.length === 0 && (
                    <div className="text-center py-10">
                        <CheckCircle2 className="mx-auto h-12 w-12 text-muted-foreground/40 mb-3" />
                        <p className="text-muted-foreground font-medium">No tasks found in this tab.</p>
                    </div>
                )}

                {filteredTasks.map(task => (
                    <Card
                        key={task.id}
                        className="border border-border bg-card active:scale-[0.98] transition-all cursor-pointer overflow-hidden hover:border-border"
                        onClick={() => openLogDialog(task.id)}
                    >
                        <CardContent className="p-0">
                            <div className="flex items-stretch">
                                <div className={`w-1.5 shrink-0 ${task.status === 'completed' ? 'bg-green-500' : task.status === 'delayed' ? 'bg-red-500' : 'bg-blue-400'}`} />
                                <div className="flex-1 p-4">
                                    <div className="flex justify-between items-start mb-2 gap-2">
                                        <h3 className="font-bold text-foreground/90 leading-tight text-sm">{task.name}</h3>
                                        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono font-semibold shrink-0 ${task.status === 'completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-blue-500/10 text-blue-400 border-blue-500/20'}`}>
                                            {task.progress || 0}%
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                                        <span className="flex items-center gap-1">
                                            <Calendar size={11} />
                                            {new Date(task.startDate).toLocaleDateString()}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Clock size={11} />
                                            {task.duration} days
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Action Dialog */}
            <Dialog open={!!selectedTask} onOpenChange={(open) => !open && setSelectedTask(null)}>
                <DialogContent className="max-w-[400px] w-[95vw] rounded-xl p-0 overflow-hidden flex flex-col max-h-[90vh] border border-border bg-background">
                    <DialogHeader className="p-4 bg-muted/30 border-b border-border shrink-0">
                        <DialogTitle className="text-base text-foreground">Update Progress</DialogTitle>
                        <p className="text-xs text-muted-foreground line-clamp-1">{tasks.find(t => t.id === selectedTask)?.name}</p>
                    </DialogHeader>

                    <div className="p-4 flex-1 overflow-y-auto space-y-5">
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-foreground/80">Physical Progress (%)</label>
                            <div className="flex items-center gap-4">
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    className="flex-1 h-10 accent-orange-500"
                                    value={progressVal}
                                    onChange={(e) => setProgressVal(Number(e.target.value))}
                                />
                                <Input
                                    type="number"
                                    className="w-24 text-center font-bold text-lg field-input-mobile bg-muted/20 border-border text-foreground"
                                    value={progressVal}
                                    onChange={(e) => setProgressVal(Number(e.target.value))}
                                    min={0} max={100}
                                />
                            </div>
                        </div>

                        {/* Evidence: Photo */}
                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground/80 flex justify-between">
                                <span>Field Photo Evidence</span>
                                {photoUrl && <Check className="text-green-400" size={16} />}
                            </label>
                            <div className="border-2 border-dashed border-border rounded-lg p-4 text-center bg-muted/10">
                                {photoUrl ? (
                                    <div className="relative group rounded-md overflow-hidden">
                                        <img src={photoUrl} alt="Progress" className="w-full h-32 object-cover" />
                                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                            <label className="cursor-pointer text-foreground text-sm font-medium flex items-center gap-2">
                                                <Camera size={16} /> Retake
                                                <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleFileUpload} />
                                            </label>
                                        </div>
                                    </div>
                                ) : (
                                    <label className="cursor-pointer flex flex-col items-center gap-2 py-4">
                                        <div className="h-12 w-12 bg-nl-orange/10 text-nl-orange rounded-full flex items-center justify-center">
                                            <Camera size={24} />
                                        </div>
                                        <span className="text-sm font-medium text-muted-foreground">Tap to snap a photo</span>
                                        <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" className="hidden" onChange={handleFileUpload} />
                                    </label>
                                )}
                                {uploading && <p className="text-xs text-nl-cyan mt-2 animate-pulse">Uploading...</p>}
                            </div>
                        </div>

                        {/* Evidence: GPS */}
                        <div className="space-y-3">
                            <label className="text-sm font-bold text-foreground/80 flex justify-between">
                                <span>GPS Location Pin</span>
                                {gpsCoords && <Check className="text-green-400" size={16} />}
                            </label>
                            <Button
                                variant={gpsCoords ? 'outline' : 'default'}
                                className={`w-full gap-2 field-button ${gpsCoords ? 'border-green-500/20 bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-accent hover:bg-accent/80 text-foreground border-border'}`}
                                onClick={captureGps}
                                disabled={gpsLoading}
                            >
                                <MapPin size={18} />
                                {gpsLoading ? 'Acquiring GPS...' : gpsCoords ? `Verified: ${gpsCoords.latitude.toFixed(4)}, ${gpsCoords.longitude.toFixed(4)}` : 'Tag Current Location'}
                            </Button>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-semibold text-foreground/80">Notes (Optional)</label>
                            <textarea
                                className="w-full border border-border bg-muted/20 rounded-md p-2 text-sm text-foreground/90 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-nl-orange/50 min-h-[60px]"
                                placeholder="Any issues, weather delays, or material shortages..."
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="p-4 bg-muted/20 border-t border-border shrink-0 flex gap-3">
                        <Button variant="outline" className="flex-1 field-button border-border text-muted-foreground hover:text-foreground/90 hover:bg-white/[0.04]" onClick={() => setSelectedTask(null)}>Cancel</Button>
                        <Button className="flex-1 bg-nl-orange hover:bg-nl-orange/90 text-white field-button" onClick={handleSubmit}>
                            Submit Log
                        </Button>
                    </div>

                </DialogContent>
            </Dialog>
        </div>
    )
}
