import React, { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { useProjectStore } from '../../store/projectStore'
import { toast } from 'sonner'
import { Settings2, Percent, Calculator, TrendingUp } from 'lucide-react'

interface ProjectSettingsDialogProps {
    projectId: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function ProjectSettingsDialog({ projectId, open, onOpenChange }: ProjectSettingsDialogProps) {
    const { getProject, updateProject } = useProjectStore()
    const project = getProject(projectId)

    const [profit, setProfit] = useState<number>(0)
    const [overhead, setOverhead] = useState<number>(0)
    const [isSaving, setIsSaving] = useState(false)

    useEffect(() => {
        if (project && open) {
            setProfit(Number(project.meta?.targetProfitPercentage ?? 10))
            setOverhead(Number(project.meta?.defaultOverheadPercentage ?? 10))
        }
    }, [project, open])

    const handleSave = async () => {
        setIsSaving(true)
        try {
            await updateProject(projectId, {
                meta: {
                    ...project?.meta,
                    targetProfitPercentage: profit,
                    defaultOverheadPercentage: overhead,
                }
            })
            toast.success('Project settings updated')
            onOpenChange(false)
        } catch {
            toast.error('Failed to update settings')
        } finally {
            setIsSaving(false)
        }
    }

    if (!project) return null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Settings2 className="h-5 w-5 text-blue-600" />
                        Project Costing Settings
                    </DialogTitle>
                    <DialogDescription>
                        Configure financial targets and default multipliers for {project.name}.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label htmlFor="profit" className="text-sm font-semibold flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-500" />
                            Target Profit Percentage
                        </Label>
                        <div className="relative">
                            <Input
                                id="profit"
                                type="number"
                                value={profit}
                                onChange={(e) => setProfit(Number(e.target.value))}
                                className="pr-10"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                <Percent size={14} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 italic">Used as a benchmark in RAP simulations and AHSP calculations.</p>
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="overhead" className="text-sm font-semibold flex items-center gap-2">
                            <Calculator className="h-4 w-4 text-amber-500" />
                            Default Overhead Percentage
                        </Label>
                        <div className="relative">
                            <Input
                                id="overhead"
                                type="number"
                                value={overhead}
                                onChange={(e) => setOverhead(Number(e.target.value))}
                                className="pr-10"
                            />
                            <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
                                <Percent size={14} />
                            </div>
                        </div>
                        <p className="text-xs text-slate-500 italic">Default overhead applied to new AHSP items in this project.</p>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving}>
                        {isSaving ? 'Saving...' : 'Save Settings'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

