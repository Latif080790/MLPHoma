/**
 * DocumentVersionHistory.tsx
 * Shows version history for a document group, allows reverting.
 */

import React, { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { History, RotateCcw, Check, Loader2, FileText } from "lucide-react"
import { documentVersionService, DocumentVersion } from "@/services/documentVersionService"
import { format } from "date-fns"
import { toast } from "sonner"

interface DocumentVersionHistoryProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    documentGroupId: string
    projectId: string
    documentTitle: string
    onReverted?: () => void
}

export function DocumentVersionHistory({
    open,
    onOpenChange,
    documentGroupId,
    projectId,
    documentTitle,
    onReverted,
}: DocumentVersionHistoryProps) {
    const [versions, setVersions] = useState<DocumentVersion[]>([])
    const [loading, setLoading] = useState(false)
    const [reverting, setReverting] = useState<string | null>(null)
    const [pendingRevertVersionId, setPendingRevertVersionId] = useState<string | null>(null)

    useEffect(() => {
        if (open && documentGroupId) loadHistory()
    }, [open, documentGroupId])

    const loadHistory = async () => {
        setLoading(true)
        try {
            const data = await documentVersionService.getVersionHistory(documentGroupId)
            setVersions(data)
        } catch (err) {
            console.warn("Version history load failed:", err)
        } finally {
            setLoading(false)
        }
    }

    const handleRevert = async (docId: string) => {
        setReverting(docId)
        try {
            await documentVersionService.revertToVersion(docId, documentGroupId)
            toast.success("Reverted successfully")
            loadHistory()
            onReverted?.()
        } catch (err: any) {
            toast.error("Revert failed", { description: err.message })
        } finally {
            setReverting(null)
        }
    }

    const pendingRevertVersion = versions.find((v) => v.id === pendingRevertVersionId) || null

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="h-4 w-4" />
                        Version History — {documentTitle}
                    </DialogTitle>
                </DialogHeader>

                {loading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                ) : versions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No version history found.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Version</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>Size</TableHead>
                                <TableHead>Notes</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {versions.map((v) => (
                                <TableRow key={v.id}>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <FileText className="h-4 w-4 text-blue-500" />
                                            <span className="font-medium">v{v.versionNumber}</span>
                                            {v.isLatest && (
                                                <Badge variant="default" className="text-[10px] bg-green-100 text-green-800">
                                                    <Check className="h-3 w-3 mr-1" /> Current
                                                </Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-xs">
                                        {format(new Date(v.createdAt), "dd MMM yyyy HH:mm")}
                                    </TableCell>
                                    <TableCell className="text-xs text-muted-foreground">
                                        {v.fileSize ? `${(v.fileSize / 1024).toFixed(0)} KB` : '-'}
                                    </TableCell>
                                    <TableCell className="text-xs max-w-[200px] truncate">
                                        {v.changeNotes || '-'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {!v.isLatest && (
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setPendingRevertVersionId(v.id)}
                                                disabled={reverting === v.id}
                                            >
                                                {reverting === v.id ? (
                                                    <Loader2 className="h-3 w-3 animate-spin" />
                                                ) : (
                                                    <RotateCcw className="h-3 w-3 mr-1" />
                                                )}
                                                Revert
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}

                <AlertDialog open={!!pendingRevertVersionId} onOpenChange={(open) => { if (!open) setPendingRevertVersionId(null) }}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Revert document version?</AlertDialogTitle>
                            <AlertDialogDescription>
                                {pendingRevertVersion
                                    ? `Version v${pendingRevertVersion.versionNumber} will become the current version.`
                                    : 'The current version will be marked as non-latest.'}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={async () => {
                                    if (!pendingRevertVersionId) return
                                    await handleRevert(pendingRevertVersionId)
                                    setPendingRevertVersionId(null)
                                }}
                            >
                                Revert
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </DialogContent>
        </Dialog>
    )
}
