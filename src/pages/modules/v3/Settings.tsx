
import React, { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
// Enterprise patterns
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, ModeSwitch, WorkspaceHeader } from '@/components/patterns'
import { Settings as SettingsIcon, Save, Users, Database, Globe, Loader2, History, Clock } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
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
    const [settingsTab, setSettingsTab] = useState('general')

    const settingsTabOptions = [
        { value: 'general', label: 'General', icon: <Globe className="h-3.5 w-3.5" /> },
        { value: 'team', label: 'Team', icon: <Users className="h-3.5 w-3.5" /> },
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

                {/* --- GENERAL SETTINGS --- */}
                <TabsContent value="general">
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

                {/* --- TEAM MANAGEMENT --- */}
                <TabsContent value="team">
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
                                        <History className="h-4 w-4 text-slate-500" />
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
                                        <div className="flex flex-col items-center gap-3 py-12 text-slate-400">
                                            <Clock className="h-8 w-8 opacity-40" />
                                            <p className="text-sm">No actions recorded yet for this project.</p>
                                        </div>
                                    )
                                }
                                return (
                                    <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[480px] overflow-y-auto">
                                        {entries.map(entry => (
                                            <div key={entry.id} className="flex items-start gap-3 px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                                                <div className="mt-0.5 h-6 w-6 rounded-full bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center shrink-0">
                                                    <History className="h-3 w-3 text-blue-500" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <code className="text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">
                                                            {entry.action}
                                                        </code>
                                                        {entry.payload && typeof entry.payload === 'object' && 'id' in entry.payload && (
                                                            <span className="text-xs text-slate-400 font-mono truncate max-w-[120px]">
                                                                #{String(entry.payload.id).slice(0, 8)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                                <time className="text-xs text-slate-400 shrink-0 mt-1 tabular-nums">
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
