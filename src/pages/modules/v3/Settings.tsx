
import React, { useCallback, useEffect, useState } from "react"
// Enterprise patterns
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, ModeSwitch, WorkspaceHeader } from '@/components/patterns'
import { Settings as SettingsIcon, Save, Users, Database, Globe, Loader2 } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { useProjectStore } from "@/store/projectStore"
import { EmptyState } from "@/components/common/EmptyState"
import { toast } from "sonner"
import { settingsService } from "@/services/settingsService"
import { TeamManagementPanel } from "@/components/modules/TeamManagementPanel"
import { useErrorHandler } from "@/hooks/useErrorHandler"
import ModulePageState from "@/components/common/ModulePageState"
import type { Project } from "@/store/projectStore"

export default function Settings() {
    type SettingsProject = Project & {
        start_date?: string
        end_date?: string
    }

    const { activeProjectId, projects, updateProject } = useProjectStore()
    const { handleAsync } = useErrorHandler()
    const [project, setProject] = useState<SettingsProject | null>(null)
    const [loading, setLoading] = useState(false)
    const [srStatus, setSrStatus] = useState('')
    const [settingsTab, setSettingsTab] = useState('general')

    const settingsTabOptions = [
        { value: 'general', label: 'General', icon: <Globe className="h-3.5 w-3.5" /> },
        { value: 'team', label: 'Team', icon: <Users className="h-3.5 w-3.5" /> },
        { value: 'master', label: 'Master Data', icon: <Database className="h-3.5 w-3.5" /> },
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
                        <Card className="hover:border-blue-500 cursor-pointer transition-colors" onClick={() => window.location.hash = '/costing'}>
                            <CardHeader>
                                <CardTitle className="text-base">AHSP Categories</CardTitle>
                                <CardDescription>Manage standard pricing categories.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-xs text-muted-foreground">Open Project Costing module to manage AHSP data →</p>
                            </CardContent>
                        </Card>
                        <Card className="hover:border-blue-500 cursor-pointer transition-colors" onClick={() => window.location.hash = '/supply-chain'}>
                            <CardHeader>
                                <CardTitle className="text-base">Vendors</CardTitle>
                                <CardDescription>Manage supplier list for POs.</CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <p className="text-xs text-muted-foreground">Open Supply Chain module to manage vendors →</p>
                            </CardContent>
                        </Card>
                        <Card className="hover:border-blue-500 cursor-pointer transition-colors" onClick={() => window.location.hash = '/finance'}>
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
            </Tabs>
        </PageShell>
    )
}
