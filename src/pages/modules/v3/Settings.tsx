
import React, { useEffect, useState } from "react"
import { ModuleHeader } from "../../../components/modules/ModuleHeader"
import { Settings as SettingsIcon, Save, Users, Database, Globe } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../../components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../../../components/ui/card"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { Button } from "../../../components/ui/button"
import { useProjectStore } from "../../../store/projectStore"
import { EmptyState } from "../../../components/common/EmptyState"
import { toast } from "sonner"
import { assertSupabase } from "../../../lib/supabaseClient"

export default function Settings() {
    const { activeProjectId, projects, updateProject } = useProjectStore()
    const [project, setProject] = useState<any>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        if (activeProjectId) {
            // projects is a Record<string, Project>, so simply access it
            const p = projects[activeProjectId]
            if (p) setProject(p)
            else loadProject(activeProjectId)
        }
    }, [activeProjectId, projects])

    async function loadProject(id: string) {
        const client = assertSupabase()
        const { data } = await client.from('projects').select('*').eq('id', id).single()
        if (data) setProject(data)
    }

    async function handleSave() {
        if (!project || !activeProjectId) return
        setLoading(true)
        try {
            // 1. Update in Supabase (Handled by store sync usually, but here we do manual for double safety or if sync is async)
            // But since updateProject calls syncProj, we can just use that if we trust it, or use manual update.
            // Let's use manual update to ensure immediate feedback as in original code, then update store.

            const client = assertSupabase()
            const { error } = await client
                .from('projects')
                .update({
                    name: project.name,
                    location: project.location,
                    start_date: project.start_date,
                    end_date: project.end_date,
                    budget: project.budget,
                    updated_at: new Date().toISOString()
                })
                .eq('id', activeProjectId)

            if (error) throw error

            toast.success("Project settings saved")

            // 2. Update Store
            updateProject(activeProjectId, {
                name: project.name,
                location: project.location,
                startDate: project.start_date,
                endDate: project.end_date,
                budget: project.budget
            })

        } catch (err: any) {
            toast.error("Failed to save settings")
        } finally {
            setLoading(false)
        }
    }

    if (!activeProjectId || !project) return <EmptyState title="No Project Selected" description="Select a project to configure." />

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<SettingsIcon size={18} />}
                title="Settings"
                description="Project configuration and master data."
                actions={
                    <Button size="sm" className="gap-2" onClick={handleSave} disabled={loading}>
                        <Save size={16} /> Save Changes
                    </Button>
                }
            />

            <Tabs defaultValue="general" className="w-full">
                <TabsList className="mb-4">
                    <TabsTrigger value="general" className="gap-2">
                        <Globe size={14} /> General
                    </TabsTrigger>
                    <TabsTrigger value="team" className="gap-2">
                        <Users size={14} /> Team
                    </TabsTrigger>
                    <TabsTrigger value="master" className="gap-2">
                        <Database size={14} /> Master Data
                    </TabsTrigger>
                </TabsList>

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
                    <Card>
                        <CardHeader>
                            <CardTitle>Team Members</CardTitle>
                            <CardDescription>Manage access and roles.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <EmptyState
                                title="Team Management Coming Soon"
                                description="Invite users and assign roles (Project Manager, Site Engineer, etc.)."
                                imageKeyword="team"
                            />
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- MASTER DATA --- */}
                <TabsContent value="master">
                    <div className="grid gap-4 md:grid-cols-2">
                        <Card className="hover:border-blue-500 cursor-pointer transition-colors">
                            <CardHeader>
                                <CardTitle className="text-base">AHSP Categories</CardTitle>
                                <CardDescription>Manage standard pricing categories.</CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="hover:border-blue-500 cursor-pointer transition-colors">
                            <CardHeader>
                                <CardTitle className="text-base">Vendors</CardTitle>
                                <CardDescription>Manage supplier list for POs.</CardDescription>
                            </CardHeader>
                        </Card>
                        <Card className="hover:border-blue-500 cursor-pointer transition-colors">
                            <CardHeader>
                                <CardTitle className="text-base">Cost Centers</CardTitle>
                                <CardDescription>Define financial cost codes.</CardDescription>
                            </CardHeader>
                        </Card>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}
