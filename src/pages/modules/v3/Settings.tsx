
import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
// Enterprise patterns
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, ModeSwitch, WorkspaceHeader } from '@/components/patterns'
import { Settings as SettingsIcon, Save, Users, Database, Globe, Loader2, History, Clock, CheckCircle2, Palette, Bell } from "lucide-react"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useProjectStore } from "@/store/projectStore"
import { useShallow } from 'zustand/react/shallow'
import { EmptyState } from "@/components/common/EmptyState"
import { toast } from "sonner"
import { settingsService } from "@/services/settingsService"
import { TeamManagementPanel } from "@/components/modules/TeamManagementPanel"
import { useErrorHandler } from "@/hooks/useErrorHandler"
import ModulePageState from "@/components/common/ModulePageState"
import type { Project } from "@/store/projectStore"
import { useRabStore } from "@/store/rabStore"

export default function Settings() {
    type SettingsProject = Project & {
        start_date?: string
        end_date?: string
    }

    const navigate = useNavigate()
    const { activeProjectId, projects, updateProject } = useProjectStore(
        useShallow(s => ({ activeProjectId: s.activeProjectId, projects: s.projects, updateProject: s.updateProject }))
    )
    const { handleAsync } = useErrorHandler()
    const audit = useRabStore(s => s.audit)
    const [project, setProject] = useState<SettingsProject | null>(null)
    const [loading, setLoading] = useState(false)
    const [srStatus, setSrStatus] = useState('')
    const [settingsTab, setSettingsTab] = useState('profil')

    const NOTIFICATION_EVENTS = [
        { key: 'approval_request',  label: 'Permintaan Persetujuan',   description: 'Saat ada approval masuk' },
        { key: 'approval_overdue',  label: 'Approval Terlambat',       description: 'SLA melewati batas' },
        { key: 'mrp_alert',         label: 'Peringatan MRP',           description: 'Stok material di bawah kebutuhan' },
        { key: 'budget_overrun',    label: 'Pelampauan Budget',        description: 'RAB melebihi budget proyek' },
        { key: 'schedule_delay',    label: 'Keterlambatan Jadwal',     description: 'Task melewati tanggal rencana' },
    ] as const
    type NotifKey = typeof NOTIFICATION_EVENTS[number]['key']
    const [notifPrefs, setNotifPrefs] = useState<Record<NotifKey, boolean>>(
        Object.fromEntries(NOTIFICATION_EVENTS.map(e => [e.key, true])) as Record<NotifKey, boolean>
    )
    const toggleNotif = (key: NotifKey) => setNotifPrefs(prev => ({ ...prev, [key]: !prev[key] }))
    const resetNotifPrefs = () => {
        if (confirm('Reset semua konfigurasi notifikasi ke default?')) {
            setNotifPrefs(Object.fromEntries(NOTIFICATION_EVENTS.map(e => [e.key, true])) as Record<NotifKey, boolean>)
            toast.success('Konfigurasi notifikasi direset ke default')
        }
    }

    const [activeTheme, setActiveTheme] = useState<'dark' | 'light' | 'system'>(() => {
        const saved = localStorage.getItem('theme')
        return (saved === 'light' || saved === 'system' || saved === 'dark') ? saved : 'dark'
    })

    function applyTheme(theme: 'dark' | 'light' | 'system') {
        setActiveTheme(theme)
        localStorage.setItem('theme', theme)
        if (theme === 'dark') {
            document.documentElement.classList.add('dark')
        } else if (theme === 'light') {
            document.documentElement.classList.remove('dark')
        } else {
            // system
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
            document.documentElement.classList.toggle('dark', prefersDark)
        }
    }

    const settingsTabOptions = [
        { value: 'profil', label: 'Profil', icon: <Globe className="h-3.5 w-3.5" /> },
        { value: 'tampilan', label: 'Tampilan', icon: <Palette className="h-3.5 w-3.5" /> },
        { value: 'notifikasi', label: 'Notifikasi', icon: <Bell className="h-3.5 w-3.5" /> },
        { value: 'akses', label: 'Akses & Tim', icon: <Users className="h-3.5 w-3.5" /> },
        { value: 'master', label: 'Master Data', icon: <Database className="h-3.5 w-3.5" /> },
        { value: 'audit', label: 'Audit Log', icon: <History className="h-3.5 w-3.5" /> },
    ]

    const loadProject = useCallback(async (id: string) => {
        setSrStatus('Loading project settings...')
        setLoading(true)
        const data = await handleAsync(async () => {
            return await settingsService.getProjectDetails(id)
        }, 'data.sync_failed')
        if (data) {
            setProject(data)
            setSrStatus('Project settings loaded.')
        } else {
            setSrStatus('Failed to load project settings.')
        }
        setLoading(false)
    }, [handleAsync])

    useEffect(() => {
        if (activeProjectId) {
            // projects is a Record<string, Project>, so simply access it
            const p = projects[activeProjectId]
            if (p) {
                queueMicrotask(() => setProject(p))
            } else {
                queueMicrotask(() => {
                    void loadProject(activeProjectId)
                })
            }
        }
    }, [activeProjectId, projects, loadProject])

    async function handleSave() {
        if (!project || !activeProjectId) return
        setSrStatus('Saving project settings...')
        setLoading(true)
        const result = await handleAsync(async () => {
            updateProject(activeProjectId, {
                name: project.name,
                location: project.location,
                startDate: project.start_date,
                endDate: project.end_date,
                budget: project.budget
            })
            return true
        }, 'validation.invalid_format')

        if (result) {
            toast.success("Project settings saved")
            setSrStatus('Project settings saved.')
        } else {
            setSrStatus('Failed to save project settings.')
        }

        setLoading(false)
    }

    if (!activeProjectId || !project) {
        return (
            <ModulePageState
                icon={<SettingsIcon size={18} />}
                title="Settings"
                description="Project configuration and master data."
                variant="empty"
                message="Select an active project to configure settings."
            />
        )
    }

    if (loading && !project) {
        return (
            <ModulePageState
                icon={<SettingsIcon size={18} />}
                title="Settings"
                description="Project configuration and master data."
                variant="loading"
                message="Loading project settings..."
            />
        )
    }
    // Get initials for avatar (used in UI sections if needed)
    // ... lines 112 onwards ...

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={project?.name || 'Project'}
                    syncStatus="synced"
                />
            }
            navigation={
                <ModeSwitch
                    options={settingsTabOptions}
                    value={settingsTab}
                    onChange={setSettingsTab}
                />
            }
            header={
                <WorkspaceHeader
                    title="Settings"
                    subtitle="Project configuration and master data"
                    primaryAction={{
                        label: loading ? 'Saving...' : 'Save Changes',
                        icon: loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />,
                        onClick: handleSave,
                    }}
                />
            }
        >
            <div className="sr-only" role="status" aria-live="polite" aria-atomic="true">{srStatus}</div>

            <Tabs value={settingsTab} onValueChange={setSettingsTab} className="w-full">

                {/* --- PROFIL SETTINGS --- */}
                <TabsContent value="profil">
                    <Card>
                        <CardHeader>
                            <CardTitle>Project Details</CardTitle>
                            <CardDescription>Basic information about the project.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid gap-2">
                                <Label>Project Name</Label>
                                <Input value={project.name} onChange={(e) => setProject({ ...project, name: e.target.value })} />
                            </div>
                            <div className="grid gap-2">
                                <Label>Location</Label>
                                <Input value={project.location || ''} onChange={(e) => setProject({ ...project, location: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="grid gap-2">
                                    <Label>Start Date</Label>
                                    <Input type="date" value={project.start_date || ''} onChange={(e) => setProject({ ...project, start_date: e.target.value })} />
                                </div>
                                <div className="grid gap-2">
                                    <Label>End Date</Label>
                                    <Input type="date" value={project.end_date || ''} onChange={(e) => setProject({ ...project, end_date: e.target.value })} />
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label>Total Budget (Rp)</Label>
                                <Input type="number" value={project.budget} onChange={(e) => setProject({ ...project, budget: parseFloat(e.target.value) })} />
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- TAMPILAN --- */}
                <TabsContent value="tampilan">
                    <div className="space-y-4">
                        <div>
                            <h3 className="text-base font-semibold text-white">Tampilan</h3>
                            <p className="text-sm text-muted-foreground mt-0.5">Pilih tema tampilan aplikasi</p>
                        </div>
                        <div className="grid grid-cols-3 gap-3">
                            {(
                                [
                                    {
                                        value: 'dark',
                                        label: 'Gelap',
                                        description: 'Hemat daya, nyaman di malam hari',
                                        preview: (
                                            <div className="mb-3 rounded-lg overflow-hidden bg-[#070C18] h-16 border border-white/10">
                                                <div className="h-2.5 bg-[#0E1525] border-b border-white/5 flex items-center px-2 gap-1">
                                                    <div className="w-3 h-1 rounded-sm bg-[#F97316]/70" />
                                                    <div className="w-6 h-1 rounded-sm bg-white/10" />
                                                </div>
                                                <div className="p-1.5 flex gap-1">
                                                    <div className="w-8 h-8 rounded-md bg-[#16223A] border border-white/5" />
                                                    <div className="flex-1 space-y-1">
                                                        <div className="h-1.5 rounded bg-white/15 w-3/4" />
                                                        <div className="h-1.5 rounded bg-white/[0.08] w-1/2" />
                                                    </div>
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        value: 'light',
                                        label: 'Terang',
                                        description: 'Cocok untuk presentasi & pencahayaan tinggi',
                                        preview: (
                                            <div className="mb-3 rounded-lg overflow-hidden bg-slate-50 h-16 border border-slate-200">
                                                <div className="h-2.5 bg-white border-b border-slate-100 flex items-center px-2 gap-1">
                                                    <div className="w-3 h-1 rounded-sm bg-orange-400/80" />
                                                    <div className="w-6 h-1 rounded-sm bg-slate-200" />
                                                </div>
                                                <div className="p-1.5 flex gap-1">
                                                    <div className="w-8 h-8 rounded-md bg-slate-100 border border-slate-200" />
                                                    <div className="flex-1 space-y-1">
                                                        <div className="h-1.5 rounded bg-slate-300 w-3/4" />
                                                        <div className="h-1.5 rounded bg-slate-200 w-1/2" />
                                                    </div>
                                                </div>
                                            </div>
                                        ),
                                    },
                                    {
                                        value: 'system',
                                        label: 'Sistem',
                                        description: 'Mengikuti pengaturan perangkat Anda',
                                        preview: (
                                            <div className="mb-3 rounded-lg overflow-hidden h-16 border border-white/10 flex">
                                                <div className="w-1/2 bg-[#070C18]">
                                                    <div className="h-2.5 bg-[#0E1525] border-b border-white/5" />
                                                    <div className="p-1.5"><div className="h-1.5 rounded bg-white/15 w-3/4" /></div>
                                                </div>
                                                <div className="w-1/2 bg-slate-50">
                                                    <div className="h-2.5 bg-white border-b border-slate-100" />
                                                    <div className="p-1.5"><div className="h-1.5 rounded bg-slate-300 w-3/4" /></div>
                                                </div>
                                            </div>
                                        ),
                                    },
                                ] as { value: 'dark' | 'light' | 'system'; label: string; description: string; preview: React.ReactNode }[]
                            ).map(({ value, label, description, preview }) => {
                                const isActive = activeTheme === value
                                return (
                                    <button
                                        key={value}
                                        type="button"
                                        onClick={() => applyTheme(value)}
                                        className={[
                                            'rounded-xl p-4 cursor-pointer transition-all duration-150 text-left w-full',
                                            isActive
                                                ? 'border-2 border-nl-orange bg-nl-orange-dim ring-2 ring-nl-orange/20'
                                                : 'border border-border bg-card hover:border-primary/40 hover:bg-accent/40',
                                        ].join(' ')}
                                    >
                                        {preview}
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm font-semibold text-white">{label}</span>
                                            {isActive && <CheckCircle2 className="h-4 w-4 text-nl-orange" />}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </TabsContent>

                {/* --- NOTIFIKASI --- */}
                <TabsContent value="notifikasi">
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                                    <Bell className="h-4 w-4 text-nl-orange" />
                                    Preferensi Notifikasi
                                </CardTitle>
                                <CardDescription className="text-xs">
                                    Atur saluran notifikasi dan kategori peristiwa yang ingin Anda terima.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {/* Saluran */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">Saluran</p>
                                    <div className="space-y-3">
                                        {[
                                            { key: 'email', label: 'Email', desc: 'Kirim notifikasi ke alamat email terdaftar' },
                                            { key: 'inapp', label: 'Dalam Aplikasi', desc: 'Tampilkan notifikasi di lonceng atas' },
                                        ].map(({ key, label, desc }) => (
                                            <div key={key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{label}</p>
                                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                                </div>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input type="checkbox" className="peer sr-only" defaultChecked />
                                                    <div className="peer h-5 w-9 rounded-full bg-white/20 peer-checked:bg-nl-orange transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Kategori */}
                                <div>
                                    <p className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-widest mb-3">Kategori Peristiwa</p>
                                    <div className="space-y-3">
                                        {[
                                            { key: 'approval', label: 'Approval', desc: 'Permintaan persetujuan RAP, PO, & perubahan' },
                                            { key: 'budget', label: 'Peringatan Anggaran', desc: 'Budget Guard & melebihi threshold RAP' },
                                            { key: 'deadline', label: 'Tenggat Waktu', desc: 'Milestone & milestone terlewat' },
                                            { key: 'progress', label: 'Pembaruan Progres', desc: 'Laporan harian & mingguan progres proyek' },
                                            { key: 'document', label: 'Dokumen Baru', desc: 'Upload gambar kerja, RAB, & dokumen kontrak' },
                                            { key: 'system', label: 'Sistem', desc: 'Pembaruan aplikasi & pengumuman platform' },
                                        ].map(({ key, label, desc }) => (
                                            <div key={key} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                                                <div>
                                                    <p className="text-sm font-medium text-foreground">{label}</p>
                                                    <p className="text-xs text-muted-foreground">{desc}</p>
                                                </div>
                                                <label className="relative inline-flex cursor-pointer items-center">
                                                    <input type="checkbox" className="peer sr-only" defaultChecked={key !== 'system'} />
                                                    <div className="peer h-5 w-9 rounded-full bg-white/20 peer-checked:bg-nl-orange transition-colors after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-all peer-checked:after:translate-x-full" />
                                                </label>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- AKSES & TIM --- */}
                <TabsContent value="akses">
                    {activeProjectId ? (
                        <TeamManagementPanel projectId={activeProjectId} />
                    ) : (
                        <Card>
                            <CardContent className="py-8">
                                <EmptyState title="No Project Selected" description="Select a project to manage team." />
                            </CardContent>
                        </Card>
                    )}
                </TabsContent>

                {/* --- MASTER DATA --- */}
                <TabsContent value="master">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card className="hover:border-blue-500 cursor-pointer transition-colors" onClick={() => navigate('/costing')}>
                            <CardHeader>
                                <CardTitle className="text-base">AHSP Categories</CardTitle>
                                <CardDescription>Manage standard pricing categories.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-xs text-muted-foreground">Open Project Costing module to manage AHSP data →</p>
                            </CardContent>
                        </Card>
                        <Card className="hover:border-blue-500 cursor-pointer transition-colors" onClick={() => navigate('/supply-chain')}>
                            <CardHeader>
                                <CardTitle className="text-base">Vendors</CardTitle>
                                <CardDescription>Manage supplier list for POs.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-xs text-muted-foreground">Open Supply Chain module to manage vendors →</p>
                            </CardContent>
                        </Card>
                        <Card className="hover:border-blue-500 cursor-pointer transition-colors" onClick={() => navigate('/finance')}>
                            <CardHeader>
                                <CardTitle className="text-base">Cost Centers</CardTitle>
                                <CardDescription>Define financial cost codes.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-xs text-muted-foreground">Open Finance module to manage cost categories →</p>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* --- AUDIT LOG --- */}
                <TabsContent value="audit">
                    <Card>
                        <CardHeader className="pb-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <History className="h-4 w-4 text-muted-foreground" />
                                        Audit Log
                                    </CardTitle>
                                    <CardDescription>Recent actions for this project (session only, resets on reload).</CardDescription>
                                </div>
                                <Badge variant="outline" className="text-xs">
                                    {audit.filter(e => e.projectId === activeProjectId).length} entries
                                </Badge>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {(() => {
                                const entries = audit
                                    .filter(e => e.projectId === activeProjectId)
                                    .slice()
                                    .reverse()
                                if (!entries.length) {
                                    return (
                                        <div className="flex flex-col items-center gap-3 py-12 text-muted-foreground">
                                            <Clock className="h-8 w-8 opacity-40" />
                                            <p className="text-sm">No actions recorded yet for this project.</p>
                                        </div>
                                    )
                                }
                                return (
                                    <div className="divide-y divide-border max-h-[480px] overflow-y-auto">
                                        {entries.map(entry => (
                                            <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-accent/40 transition-colors">
                                                <div className="mt-0.5 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                    <History className="h-3 w-3 text-primary" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <code className="text-xs font-mono font-semibold text-foreground bg-muted px-1.5 py-0.5 rounded">
                                                            {entry.action}
                                                        </code>
                                                        {entry.payload && typeof entry.payload === 'object' && 'id' in entry.payload && (
                                                            <span className="text-xs text-muted-foreground font-mono truncate max-w-[120px]">
                                                                #{String(entry.payload.id).slice(0, 8)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <time className="text-xs text-muted-foreground shrink-0 mt-1 tabular-nums">
                                                    {new Date(entry.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </time>
                                            </div>
                                        ))}
                                    </div>
                                )
                            })()}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </PageShell>
    )
}
