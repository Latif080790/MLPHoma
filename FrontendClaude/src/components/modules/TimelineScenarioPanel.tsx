/**
 * TimelineScenarioPanel.tsx
 * What-If scenario analysis for timeline tasks.
 * Allows users to simulate delay/acceleration on a task and see propagated impact.
 */

import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FlaskConical, Save, Loader2, AlertTriangle, Clock } from "lucide-react"
import { timelineScenarioService, ScenarioResult, ScenarioModification } from "@/services/timelineScenarioService"
import { toast } from "sonner"

interface TimelineScenarioPanelProps {
    projectId: string
}

export function TimelineScenarioPanel({ projectId }: TimelineScenarioPanelProps) {
    const [taskId, setTaskId] = useState("")
    const [delayDays, setDelayDays] = useState(0)
    const [scenarioName, setScenarioName] = useState("Scenario 1")
    const [loading, setLoading] = useState(false)
    const [result, setResult] = useState<ScenarioResult | null>(null)
    const [saving, setSaving] = useState(false)

    const runScenario = async () => {
        if (!taskId || delayDays === 0) {
            toast.error("Enter a Task ID and delay/acceleration days.")
            return
        }
        setLoading(true)
        try {
            const modifications: ScenarioModification[] = [{
                taskId,
                taskName: taskId,
                field: 'duration_days',
                originalValue: 0,
                newValue: delayDays,
            }]
            const r = await timelineScenarioService.runScenario(projectId, scenarioName, modifications)
            setResult(r)
        } catch (err: unknown) {
            toast.error("Scenario failed", { description: (err as Error).message })
        } finally {
            setLoading(false)
        }
    }

    const saveScenario = async () => {
        if (!result) return
        setSaving(true)
        try {
            await timelineScenarioService.saveScenario(projectId, result)
            toast.success("Scenario saved to project metadata")
        } catch (err: unknown) {
            toast.error("Save failed", { description: (err as Error).message })
        } finally {
            setSaving(false)
        }
    }

    const affectedTasks = result?.tasks.filter(t => t.deltaFromOriginal !== 0) || []

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <FlaskConical className="h-4 w-4" />
                        What-If Scenario Simulator
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">
                        Simulate delays or acceleration on a specific task to see the cascading impact on dependent tasks and project end date.
                    </p>
                    <div className="grid gap-4 md:grid-cols-4">
                        <div>
                            <Label>Scenario Name</Label>
                            <Input
                                placeholder="e.g., Delay Foundation"
                                value={scenarioName}
                                onChange={(e) => setScenarioName(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>Task ID</Label>
                            <Input
                                placeholder="e.g., task-abc123"
                                value={taskId}
                                onChange={(e) => setTaskId(e.target.value)}
                            />
                        </div>
                        <div>
                            <Label>New Duration (days)</Label>
                            <Input
                                type="number"
                                value={delayDays}
                                onChange={(e) => setDelayDays(Number(e.target.value))}
                            />
                        </div>
                        <div className="flex items-end">
                            <Button onClick={runScenario} disabled={loading} className="w-full gap-2">
                                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
                                Run Scenario
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {result && (
                <Card>
                    <CardHeader className="pb-3">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-base">Scenario Results: {result.name}</CardTitle>
                            <Button variant="outline" size="sm" className="gap-2" onClick={saveScenario} disabled={saving}>
                                {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                Save Scenario
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                                <div className="text-xs text-muted-foreground">Original End Date</div>
                                <div className="font-bold">{result.originalProjectEnd}</div>
                            </div>
                            <div className={`p-3 rounded-lg ${result.scenarioProjectEnd !== result.originalProjectEnd ? 'bg-red-50 dark:bg-red-900/20' : 'bg-green-50 dark:bg-green-900/20'}`}>
                                <div className="text-xs text-muted-foreground">New End Date</div>
                                <div className="font-bold">{result.scenarioProjectEnd}</div>
                            </div>
                            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20">
                                <div className="text-xs text-muted-foreground">Total Delay</div>
                                <div className="font-bold">
                                    {result.totalDelayDays > 0 ? '+' : ''}{result.totalDelayDays} days
                                </div>
                            </div>
                        </div>

                        <div className={`flex items-center gap-2 p-3 rounded-lg border ${result.totalDelayDays > 0 ? 'bg-red-50 dark:bg-red-900/20 border-red-200' : 'bg-green-50 dark:bg-green-900/20 border-green-200'}`}>
                            <AlertTriangle className={`h-4 w-4 ${result.totalDelayDays > 0 ? 'text-red-600' : 'text-green-600'}`} />
                            <span className="text-sm font-medium">{result.impactSummary}</span>
                        </div>

                        {affectedTasks.length > 0 && (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Task</TableHead>
                                        <TableHead>Start</TableHead>
                                        <TableHead>End</TableHead>
                                        <TableHead>Duration</TableHead>
                                        <TableHead>Critical</TableHead>
                                        <TableHead className="text-right">Shift</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {affectedTasks.map((t) => (
                                        <TableRow key={t.id}>
                                            <TableCell className="font-medium text-sm">{t.name}</TableCell>
                                            <TableCell className="text-xs">{t.startDate}</TableCell>
                                            <TableCell className="text-xs">{t.endDate}</TableCell>
                                            <TableCell className="text-xs">{t.durationDays}d</TableCell>
                                            <TableCell>
                                                {t.isCritical && <Badge variant="destructive" className="text-xs">Critical</Badge>}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Badge variant={t.deltaFromOriginal > 0 ? "destructive" : "default"} className="text-xs">
                                                    <Clock className="h-3 w-3 mr-1" />
                                                    {t.deltaFromOriginal > 0 ? '+' : ''}{t.deltaFromOriginal}d
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
