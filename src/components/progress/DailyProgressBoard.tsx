/**
 * DailyProgressBoard.tsx
 *
 * Kanban-style "Today's Tasks" board for site progress capture.
 * Shows tasks active today (from Timeline), overdue tasks,
 * and provides evidence-based progress submission (photo, notes, weather, crew).
 */

import React, { useState, useMemo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'
import { Slider } from '../ui/slider'
import { Textarea } from '../ui/textarea'
import { Input } from '../ui/input'
import {
    Sun, Cloud, CloudRain, CloudLightning,
    Camera, Users, Clock, CheckCircle2, AlertTriangle,
    MapPin, Send, CalendarClock, ChevronDown, ChevronRight,
    Wifi, WifiOff, ShieldCheck, Database
} from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import {
    progressCaptureService, type WeatherCondition, type ProgressEntry,
} from '../../services/progressCaptureService'
import { geofenceService } from '../../services/geofenceService'
import { exifService, type PhotoMetadata } from '../../services/exifService'
import { useOfflineQueueStore } from '../../store/offlineQueueStore'
import type { TimelineTask } from '../../store/timelineStore'
import { toast } from 'sonner'
import { format } from 'date-fns'

// ─── Weather Picker ───

const WEATHER_OPTIONS: { value: WeatherCondition; icon: React.ReactNode; label: string }[] = [
    { value: 'sunny', icon: <Sun size={16} />, label: 'Cerah' },
    { value: 'cloudy', icon: <Cloud size={16} />, label: 'Berawan' },
    { value: 'rainy', icon: <CloudRain size={16} />, label: 'Hujan' },
    { value: 'stormy', icon: <CloudLightning size={16} />, label: 'Badai' },
]

// ─── Task Card ───

interface TaskCardProps {
    task: TimelineTask
    projectId: string
    isOverdue?: boolean
    existingEntry?: ProgressEntry
    onSubmitted: () => void
}

function TaskCard({ task, projectId, isOverdue, existingEntry, onSubmitted }: TaskCardProps) {
    const [expanded, setExpanded] = useState(false)
    const [progress, setProgress] = useState(task.progress)
    const [notes, setNotes] = useState('')
    const [photoCount, setPhotoCount] = useState(0)
    const [weather, setWeather] = useState<WeatherCondition>('sunny')
    const [crewCount, setCrewCount] = useState(0)
    const [submitting, setSubmitting] = useState(false)
    const [locationValid, setLocationValid] = useState(false)
    const [verifyingLocation, setVerifyingLocation] = useState(false)
    const [userCoords, setUserCoords] = useState<{ lat: number, lon: number } | null>(null)
    const [photoMetadata, setPhotoMetadata] = useState<PhotoMetadata[]>([])

    const progressGain = progress - task.progress

    const handleVerifyLocation = async () => {
        setVerifyingLocation(true)
        try {
            // Get actual browser geolocation
            navigator.geolocation.getCurrentPosition(
                async (pos) => {
                    const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude }
                    setUserCoords(coords)
                    const result = await geofenceService.isWithinProjectBounds(projectId, coords)
                    
                    if (result.inside) {
                        setLocationValid(true)
                        toast.success("Location verified. You are within the project bounds.", {
                            description: `Distance: ${Math.round(result.distance)}m`
                        })
                    } else {
                        setLocationValid(false)
                        toast.error("Location out of bounds", {
                            description: `You are ${Math.round(result.distance)}m away. Move closer to the site.`
                        })
                    }
                    setVerifyingLocation(false)
                },
                (err) => {
                    toast.error("GPS Error", { description: err.message })
                    setVerifyingLocation(false)
                },
                { enableHighAccuracy: true }
            )
        } catch (err) {
            setVerifyingLocation(false)
            toast.error("Failed to acquire GPS")
        }
    }

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || [])
        if (files.length === 0) return

        setPhotoCount(prev => prev + files.length)
        
        toast.promise(Promise.all(files.map(f => exifService.extractMetadata(f))), {
            loading: "Extracting metadata from evidence...",
            success: (metas) => {
                setPhotoMetadata(prev => [...prev, ...metas])
                return `Extracted metadata for ${files.length} photos`
            },
            error: "Failed to extract metadata"
        })
    }

    const handleSubmit = async () => {
        if (progress <= task.progress) {
            toast.warning('Progress harus lebih besar dari sebelumnya')
            return
        }
        setSubmitting(true)
        try {
            progressCaptureService.submitProgress({
                projectId,
                taskId: task.id,
                taskName: task.name,
                wbsId: task.wbsId,
                progressBefore: task.progress,
                progressAfter: progress,
                photoCount,
                photoNames: [],
                notes,
                weather,
                crewCount,
                capturedBy: 'current_user',
                latitude: userCoords?.lat,
                longitude: userCoords?.lon,
                metadata: {
                    photoExif: photoMetadata as unknown as Record<string, unknown>[],
                    geofenceVerified: locationValid
                }
            })
            toast.success('Progress submitted', { description: `${task.name}: ${task.progress}% → ${progress}%` })
            setExpanded(false)
            setLocationValid(false) // reset for next time
            setPhotoMetadata([])
            setUserCoords(null)
            onSubmitted()
        } catch (err: unknown) {
            toast.error('Failed', { description: (err as Error).message })
        } finally {
            setSubmitting(false)
        }
    }

    return (
        <div className={`rounded-lg border transition-all ${isOverdue ? 'border-red-300 bg-red-50/50 dark:border-red-900 dark:bg-red-950/10' :
            existingEntry ? 'border-emerald-300 bg-emerald-50/50 dark:border-emerald-900 dark:bg-emerald-950/10' :
                'border-border hover:border-blue-300 dark:hover:border-blue-700'
            }`}>
            {/* Header */}
            <button
                className="w-full flex items-center gap-3 p-3 text-left"
                onClick={() => setExpanded(!expanded)}
            >
                <div className="shrink-0">
                    {expanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground truncate">{task.name}</span>
                        {isOverdue && <Badge variant="destructive" className="text-xs h-4">Overdue</Badge>}
                        {existingEntry && <Badge className="text-xs h-4 bg-emerald-100 text-emerald-700">Updated</Badge>}
                        {task.wbsCode && (
                            <Badge variant="outline" className="text-xs h-4 text-muted-foreground">{task.wbsCode}</Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                            <Clock size={10} /> {task.startDate} → {task.endDate}
                        </span>
                        <span className="font-mono font-semibold text-muted-foreground">
                            {task.progress}%
                        </span>
                    </div>
                </div>
                {/* Mini progress bar */}
                <div className="w-16 shrink-0">
                    <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${task.progress >= 100 ? 'bg-emerald-500' :
                            isOverdue ? 'bg-red-500' : 'bg-blue-500'
                            }`} style={{ width: `${Math.min(task.progress, 100)}%` }} />
                    </div>
                </div>
            </button>

            {/* Expanded Form */}
            {expanded && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                    {/* Progress Slider */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground uppercase font-semibold">Progress Update</span>
                            <span className="text-sm font-mono font-bold text-blue-600">
                                {task.progress}% → {progress}%
                                {progressGain > 0 && <span className="text-emerald-600 ml-1">(+{progressGain}%)</span>}
                            </span>
                        </div>
                        <Slider
                            value={[progress]}
                            onValueChange={([v]) => setProgress(v)}
                            min={task.progress}
                            max={100}
                            step={1}
                            className="mt-1"
                        />
                    </div>

                    {/* Evidence Row */}
                    <div className="grid grid-cols-3 gap-3">
                        {/* Photo Count */}
                        <div>
                            <label className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                <Camera size={10} /> Foto Evidence
                            </label>
                            <label className="flex items-center justify-center w-full h-8 mt-1 border border-dashed border-border rounded cursor-pointer hover:bg-muted/30 transition-colors">
                                <span className="text-xs text-muted-foreground font-bold">{photoCount > 0 ? `${photoCount} Photos Loaded` : 'Tap to Upload'}</span>
                                <input type="file" multiple accept="image/*" className="hidden" onChange={handlePhotoUpload} />
                            </label>
                        </div>
                        {/* Crew Count */}
                        <div>
                            <label className="text-xs text-muted-foreground uppercase font-semibold flex items-center gap-1">
                                <Users size={10} /> Jumlah Crew
                            </label>
                            <Input
                                type="number"
                                min={0}
                                value={crewCount}
                                onChange={e => setCrewCount(Number(e.target.value))}
                                className="h-8 mt-1 text-xs"
                                placeholder="0"
                            />
                        </div>
                        {/* Weather */}
                        <div>
                            <label className="text-xs text-muted-foreground uppercase font-semibold">Cuaca</label>
                            <div className="flex gap-1 mt-1">
                                {WEATHER_OPTIONS.map(w => (
                                    <button
                                        key={w.value}
                                        onClick={() => setWeather(w.value)}
                                        className={`p-1.5 rounded-md transition-colors ${weather === w.value
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                            : 'bg-muted/50 text-muted-foreground hover:bg-muted'
                                            }`}
                                        title={w.label}
                                    >
                                        {w.icon}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Notes */}
                    <Textarea
                        placeholder="Catatan progress hari ini..."
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        className="h-16 text-xs resize-none"
                    />

                    {/* Submit Actions */}
                    <div className="flex flex-col sm:flex-row justify-between items-center bg-muted/30 border border-border rounded-md p-2 mt-2 gap-2">
                        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                            <MapPin size={12} className={locationValid ? 'text-emerald-500' : 'text-amber-500'} />
                            {locationValid ? (
                                <span className="text-emerald-600 font-medium">Site Area Verified</span>
                            ) : (
                                <span className="text-amber-600">Location required (500m radius)</span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            {!locationValid ? (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleVerifyLocation}
                                    disabled={verifyingLocation}
                                    className="w-full sm:w-auto h-8 text-xs gap-1.5 bg-card"
                                >
                                    <MapPin size={12} />
                                    {verifyingLocation ? 'Acquiring GPS...' : 'Verify Location'}
                                </Button>
                            ) : (
                                <Button
                                    size="sm"
                                    disabled={submitting || progress <= task.progress}
                                    onClick={handleSubmit}
                                    className="w-full sm:w-auto h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90 text-primary-foreground"
                                >
                                    <Send size={12} /> Submit Progress
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Main Board ───

export function DailyProgressBoard() {
    const activeProjectId = useProjectStore(s => s.activeProjectId)
    const [refreshKey, setRefreshKey] = useState(0)
    const [isOnline, setIsOnline] = useState(navigator.onLine)
    const pendingLogsCount = useOfflineQueueStore(state => state.queue.length)

    useEffect(() => {
        const handleOnline = () => setIsOnline(true)
        const handleOffline = () => setIsOnline(false)
        window.addEventListener('online', handleOnline)
        window.addEventListener('offline', handleOffline)
        return () => {
            window.removeEventListener('online', handleOnline)
            window.removeEventListener('offline', handleOffline)
        }
    }, [])

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const todayTasks = useMemo(() => {
        if (!activeProjectId) return []
        return progressCaptureService.getTodayTasks(activeProjectId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectId, refreshKey])

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const overdueTasks = useMemo(() => {
        if (!activeProjectId) return []
        return progressCaptureService.getOverdueTasks(activeProjectId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectId, refreshKey])

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const todayEntries = useMemo(() => {
        if (!activeProjectId) return []
        return progressCaptureService.getTodayEntries(activeProjectId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectId, refreshKey])

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const report = useMemo(() => {
        if (!activeProjectId) return null
        return progressCaptureService.getDailyReport(activeProjectId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeProjectId, refreshKey])

    const entryMap = new Map(todayEntries.map(e => [e.taskId, e]))

    if (!activeProjectId) return null

    const _totalTasks = todayTasks.length + overdueTasks.length

    return (
        <div className="space-y-4">
            {/* Summary Header */}
            <div className="grid grid-cols-4 gap-3">
                <Card className="border-blue-200 dark:border-blue-900">
                    <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Tugas Hari Ini</p>
                        <p className="text-2xl font-bold text-blue-600 mt-1">{todayTasks.length}</p>
                    </CardContent>
                </Card>
                <Card className={overdueTasks.length > 0 ? 'border-red-300 dark:border-red-900' : ''}>
                    <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Overdue</p>
                        <p className={`text-2xl font-bold mt-1 ${overdueTasks.length > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
                            {overdueTasks.length}
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Sudah Update</p>
                        <p className="text-2xl font-bold text-emerald-600 mt-1">{todayEntries.length}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground uppercase font-semibold">Crew Deployed</p>
                        <p className="text-2xl font-bold text-muted-foreground mt-1">
                            {report?.totalCrewDeployed || 0}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Overdue Tasks */}
            {overdueTasks.length > 0 && (
                <Card className="border-red-200 dark:border-red-900">
                    <CardHeader className="pb-2 pt-3 px-4">
                        <CardTitle className="text-sm flex items-center gap-2 text-red-600">
                            <AlertTriangle size={14} />
                            Overdue Tasks ({overdueTasks.length})
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-2">
                        {overdueTasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                projectId={activeProjectId}
                                isOverdue
                                existingEntry={entryMap.get(task.id)}
                                onSubmitted={() => setRefreshKey(k => k + 1)}
                            />
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Today's Tasks */}
            <Card>
                <CardHeader className="pb-2 pt-3 px-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-sm flex items-center gap-2">
                            <CalendarClock size={14} className="text-blue-600" />
                            Tugas Aktif Hari Ini
                            <Badge variant="outline" className="text-xs h-5">{format(new Date(), 'EEEE, dd MMM yyyy')}</Badge>
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            {isOnline ? (
                                <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                                    <Wifi className="w-3 h-3 mr-1" /> Online
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-amber-600 border-amber-200 bg-amber-50">
                                    <WifiOff className="w-3 h-3 mr-1" /> Offline Mode
                                </Badge>
                            )}

                            {pendingLogsCount > 0 && (
                                <Badge variant="secondary" className="bg-blue-100 text-blue-700 animate-pulse">
                                    <Database className="w-3 h-3 mr-1" /> {pendingLogsCount} Pending Sync
                                </Badge>
                            )}

                            {/* Note: locationValid is a state from TaskCard. For a board-level badge,
                                    it would typically come from a global state or be determined differently.
                                    Implementing as per instruction, assuming a global context for it. */}
                            <Badge variant="outline" className="text-muted-foreground">
                                <MapPin className="w-3 h-3 mr-1" /> GPS Required
                            </Badge>
                        </div>
                        {report && report.avgProgressGain > 0 && (
                            <Badge className="text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                                Avg +{report.avgProgressGain.toFixed(1)}% progress
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                    {todayTasks.length === 0 ? (
                        <div className="text-center py-8">
                            <CheckCircle2 size={28} className="mx-auto mb-2 text-emerald-400 opacity-40" />
                            <p className="text-sm text-muted-foreground">Tidak ada tugas aktif hari ini.</p>
                            <p className="text-xs text-muted-foreground mt-1">Tugas akan muncul berdasarkan jadwal Timeline.</p>
                        </div>
                    ) : (
                        todayTasks.map(task => (
                            <TaskCard
                                key={task.id}
                                task={task}
                                projectId={activeProjectId}
                                existingEntry={entryMap.get(task.id)}
                                onSubmitted={() => setRefreshKey(k => k + 1)}
                            />
                        ))
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
