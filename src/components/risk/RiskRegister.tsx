
import React, { useEffect, useState } from "react"
import { useRiskStore } from "@/store/riskStore"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, Edit, Trash2, AlertTriangle, ShieldCheck } from "lucide-react"
import { RiskDialog } from "./RiskDialog"
import { format } from "date-fns"
import { EmptyState } from "@/components/common/EmptyState"

interface RiskRegisterProps {
    projectId: string
}

export default function RiskRegister({ projectId }: RiskRegisterProps) {
    const { risks, fetchRisks, deleteRisk, loading } = useRiskStore()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [editingRisk, setEditingRisk] = useState<any>(null)

    useEffect(() => {
        if (projectId) {
            fetchRisks(projectId)
        }
    }, [projectId, fetchRisks])

    const handleEdit = (risk: any) => {
        setEditingRisk(risk)
        setDialogOpen(true)
    }

    const handleNew = () => {
        setEditingRisk(null)
        setDialogOpen(true)
    }

    const handleDelete = async (id: string) => {
        if (confirm("Are you sure you want to delete this risk?")) {
            await deleteRisk(id)
        }
    }

    // Calculate stats
    const highRisks = risks.filter(r => r.risk_score >= 15).length
    const mitigatedRisks = risks.filter(r => r.status === 'MITIGATED' || r.status === 'CLOSED').length

    return (
        <div className="space-y-6">
            <div className="flex gap-4">
                <Card className="flex-1 bg-red-50 border-red-100">
                    <CardContent className="p-4 flex items-center gap-3">
                        <AlertTriangle className="text-red-500" />
                        <div>
                            <div className="text-2xl font-bold text-red-700">{highRisks}</div>
                            <div className="text-xs text-red-600">High Risks</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="flex-1 bg-green-50 border-green-100">
                    <CardContent className="p-4 flex items-center gap-3">
                        <ShieldCheck className="text-green-500" />
                        <div>
                            <div className="text-2xl font-bold text-green-700">{mitigatedRisks}</div>
                            <div className="text-xs text-green-600">Mitigated / Closed</div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="flex-1">
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="text-sm text-neutral-500">Total Risks</div>
                        <div className="text-2xl font-bold">{risks.length}</div>
                    </CardContent>
                </Card>
            </div>

            <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Risk Register</h3>
                <Button size="sm" onClick={handleNew} className="gap-2">
                    <Plus size={16} /> Add Risk
                </Button>
            </div>

            {risks.length === 0 ? (
                <EmptyState title="No Risks Logged" description="Identify and track project risks here." imageKeyword="risk" />
            ) : (
                <div className="border rounded-md overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-muted/50 text-left">
                            <tr>
                                <th className="p-3">Risk Description</th>
                                <th className="p-3">Category</th>
                                <th className="p-3 text-center">Prob</th>
                                <th className="p-3 text-center">Imp</th>
                                <th className="p-3 text-center">Score</th>
                                <th className="p-3">Mitigation</th>
                                <th className="p-3">Status</th>
                                <th className="p-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(risks || []).map(risk => {
                                const score = risk.risk_score
                                let scoreColor = "bg-green-100 text-green-800"
                                if (score >= 10) scoreColor = "bg-yellow-100 text-yellow-800"
                                if (score >= 15) scoreColor = "bg-red-100 text-red-800"

                                return (
                                    <tr key={risk.id} className="border-t hover:bg-muted/50">
                                        <td className="p-3 max-w-[300px]">
                                            <div className="font-medium">{risk.description}</div>
                                            {risk.wbs_name && (
                                                <div className="text-xs text-neutral-500 mt-1">
                                                    Linked to: {risk.wbs_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3">
                                            <Badge variant="outline">{risk.category}</Badge>
                                        </td>
                                        <td className="p-3 text-center">{risk.probability}</td>
                                        <td className="p-3 text-center">{risk.impact}</td>
                                        <td className="p-3 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${scoreColor}`}>
                                                {risk.risk_score}
                                            </span>
                                        </td>
                                        <td className="p-3 max-w-[250px] text-neutral-600 truncate" title={risk.mitigation_plan}>
                                            {risk.mitigation_plan || '-'}
                                        </td>
                                        <td className="p-3">
                                            <Badge variant={risk.status === 'OPEN' ? 'destructive' : risk.status === 'MITIGATED' ? 'secondary' : 'outline'}>
                                                {risk.status}
                                            </Badge>
                                        </td>
                                        <td className="p-3 text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button size="icon" variant="ghost" onClick={() => handleEdit(risk)}>
                                                    <Edit size={14} />
                                                </Button>
                                                <Button size="icon" variant="ghost" className="text-red-500" onClick={() => handleDelete(risk.id)}>
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
            )}

            <RiskDialog
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                projectId={projectId}
                riskToEdit={editingRisk}
            />
        </div>
    )
}
