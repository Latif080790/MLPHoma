
import React, { useEffect, useState } from "react"
import { useRiskStore } from "@/store/riskStore"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Plus, Edit, Trash2, AlertTriangle, ShieldCheck } from "lucide-react"
import { RiskDialog } from "./RiskDialog"
import type { Risk } from '@/types/risk'
import { EmptyState } from "@/components/common/EmptyState"

interface RiskRegisterProps {
    projectId: string
}

export default function RiskRegister({ projectId }: RiskRegisterProps) {
    const { risks, fetchRisks, deleteRisk } = useRiskStore()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingRisk, setEditingRisk] = useState<Risk | null>(null)
    const [pendingDeleteRisk, setPendingDeleteRisk] = useState<Risk | null>(null)

    useEffect(() => {
        if (projectId) {
            fetchRisks(projectId)
        }
    }, [projectId, fetchRisks])

    const handleEdit = (risk: Risk) => {
        setEditingRisk(risk)
        setDialogOpen(true)
    }

    const handleNew = () => {
        setEditingRisk(null)
        setDialogOpen(true)
    }

    const handleDelete = (risk: Risk) => {
        setPendingDeleteRisk(risk)
    }

    const handleDeleteConfirm = async () => {
        if (!pendingDeleteRisk) return
        await deleteRisk(pendingDeleteRisk.id)
        setPendingDeleteRisk(null)
    }

    // Calculate stats
    const highRisks = risks.filter(r => r.risk_score >= 15).length
    const mitigatedRisks = risks.filter(r => r.status === 'MITIGATED' || r.status === 'CLOSED').length

    return (
        <div className="space-y-4 density-compact">
            <div className="grid gap-3 md:grid-cols-3">
                <Card className="flex-1 border-red-100 bg-red-50 hover-interactive">
                    <CardContent className="p-4 flex items-center gap-3">
                        <AlertTriangle className="text-red-500" />
                        <div>
                            <div className="text-2xl font-bold text-red-700">{highRisks}</div>
                            <div className="text-xs text-red-600">High Risks</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="flex-1 border-green-100 bg-green-50 hover-interactive">
                    <CardContent className="p-4 flex items-center gap-3">
                        <ShieldCheck className="text-green-500" />
                        <div>
                            <div className="text-2xl font-bold text-green-700">{mitigatedRisks}</div>
                            <div className="text-xs text-green-600">Mitigated / Closed</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="flex-1 hover-interactive">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="text-sm text-neutral-500">Total Risks</div>
                        <div className="text-2xl font-bold">{risks.length}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="sticky-glass-panel flex items-center justify-between p-3">
                <h3 className="text-lg font-semibold">Risk Register</h3>
                <Button size="sm" onClick={handleNew} className="h-8 gap-2 text-xs">
                    <Plus size={16} /> Add Risk
                </Button>
            </div>

            {risks.length === 0 ? (
                <EmptyState title="No Risks Logged" description="Identify and track project risks here." imageKeyword="risk" />
            ) : (
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    <div className="max-h-[560px] overflow-auto">
                    <table className="w-full text-sm">
                        <thead className="sticky-glass-tablehead z-10 bg-muted/70 text-left">
                            <tr>
                                <th className="p-2.5 text-xs font-semibold uppercase tracking-wider">Risk Description</th>
                                <th className="p-2.5 text-xs font-semibold uppercase tracking-wider">Category</th>
                                <th className="p-2.5 text-center text-xs font-semibold uppercase tracking-wider">Prob</th>
                                <th className="p-2.5 text-center text-xs font-semibold uppercase tracking-wider">Imp</th>
                                <th className="p-2.5 text-center text-xs font-semibold uppercase tracking-wider">Score</th>
                                <th className="p-2.5 text-xs font-semibold uppercase tracking-wider">Mitigation</th>
                                <th className="p-2.5 text-xs font-semibold uppercase tracking-wider">Status</th>
                                <th className="p-2.5 text-right text-xs font-semibold uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(risks || []).map(risk => {
                                const score = risk.risk_score
                                let scoreColor = "bg-green-100 text-green-800"
                                if (score >= 10) scoreColor = "bg-yellow-100 text-yellow-800"
                                if (score >= 15) scoreColor = "bg-red-100 text-red-800"

                                return (
                                    <tr key={risk.id} className="group border-t transition-colors hover:bg-muted/50">
                                        <td className="max-w-[300px] p-2.5">
                                            <div className="font-medium">{risk.description}</div>
                                            {risk.wbs_name && (
                                                <div className="text-xs text-neutral-500 mt-1">
                                                    Linked to: {risk.wbs_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-2.5">
                                            <Badge variant="outline" className="text-xs uppercase tracking-wider">{risk.category}</Badge>
                                        </td>
                                        <td className="p-2.5 text-center text-xs">{risk.probability}</td>
                                        <td className="p-2.5 text-center text-xs">{risk.impact}</td>
                                        <td className="p-2.5 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${scoreColor}`}>
                                                {risk.risk_score}
                                            </span>
                                        </td>
                                        <td className="max-w-[250px] truncate p-2.5 text-xs text-neutral-600" title={risk.mitigation_plan}>
                                            {risk.mitigation_plan || '-'}
                                        </td>
                                        <td className="p-2.5">
                                            <Badge variant={risk.status === 'OPEN' ? 'destructive' : risk.status === 'MITIGATED' ? 'secondary' : 'outline'} className="text-xs uppercase tracking-wider">
                                                {risk.status}
                                            </Badge>
                                        </td>
                                        <td className="p-2.5 text-right">
                                            <div className="flex justify-end gap-1 opacity-80 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEdit(risk)}>
                                                    <Edit size={14} />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDelete(risk)}>
                                                    <Trash2 size={14} />
                                                </Button>
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                    </div>
                </div>
            )}

            <RiskDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                projectId={projectId}
                riskToEdit={editingRisk}
            />

            <AlertDialog open={!!pendingDeleteRisk} onOpenChange={(open) => { if (!open) setPendingDeleteRisk(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete risk entry?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDeleteRisk ? `"${pendingDeleteRisk.description}" will be removed from the risk register.` : 'This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDeleteConfirm}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
