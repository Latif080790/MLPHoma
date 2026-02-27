/**
 * QRValidationBadge.tsx
 *
 * Visual badge for Document cards showing QR validation status.
 * Click to view actual QR code if document is approved, or prompt to generate.
 */

import React, { useState, useEffect } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { QrCode, ShieldCheck, AlertCircle, Copy, ExternalLink, Shield } from 'lucide-react'
import { toast } from 'sonner'
import { qrValidationService, type QRValidationRecord } from '@/services/qrValidationService'
import { useAuthStore } from '@/store/authStore'
import { usePermissions, ACTIONS } from '@/hooks/usePermissions'

interface QRValidationBadgeProps {
    documentId: string
    projectId: string
    documentTitle: string
    versionNumber: number
    category: string
    status: string // e.g. 'APPROVED', 'DRAFT'
}

export function QRValidationBadge({ documentId, projectId, documentTitle, versionNumber, category, status }: QRValidationBadgeProps) {
    const [record, setRecord] = useState<QRValidationRecord | undefined>(undefined)
    const [open, setOpen] = useState(false)
    const profile = useAuthStore(s => s.profile)
    const { can } = usePermissions()

    useEffect(() => {
        // Only fetch if document is approved
        if (status === 'APPROVED') {
            const activeQR = qrValidationService.getActiveQR(documentId)
            setRecord(activeQR)
        }
    }, [documentId, status])

    const handleGenerate = () => {
        if (status !== 'APPROVED') {
            toast.error('Only APPROVED documents can have QR validation.')
            return
        }

        const userName = profile?.full_name || 'System'
        const newRecord = qrValidationService.generate({
            documentId,
            projectId,
            documentTitle,
            versionNumber,
            category,
            issuedBy: userName,
            expiryDays: category === 'PERMIT' ? 365 : 0 // Expiry example
        })

        setRecord(newRecord)
        toast.success('Validation QR Generated', { description: newRecord.validationHash })
    }

    const handleRevoke = () => {
        if (!record) return
        const userName = profile?.full_name || 'System'
        qrValidationService.revoke(record.validationHash, userName)
        setRecord(undefined)
        setOpen(false)
        toast.success('QR Code Revoked')
    }

    const handleCopyHash = () => {
        if (!record) return
        navigator.clipboard.writeText(record.validationHash)
        toast.success('Hash copied to clipboard')
    }

    // Visual variants based on state
    if (status !== 'APPROVED') {
        return (
            <Badge variant="outline" className="text-[10px] text-slate-400 border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 px-1 py-0 h-4">
                <Shield size={10} className="mr-1" /> No QR (Draft)
            </Badge>
        )
    }

    return (
        <>
            <div
                onClick={(e) => { e.stopPropagation(); setOpen(true) }}
                className="cursor-pointer"
                title="View Document QR Validation"
            >
                {record ? (
                    <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 px-1 py-0 h-4 hover:bg-emerald-100 dark:hover:bg-emerald-800 transition-colors">
                        <QrCode size={10} className="mr-1" /> Validated
                    </Badge>
                ) : (
                    <Badge variant="outline" className="text-[10px] text-blue-600 border-blue-200 bg-blue-50 dark:bg-blue-900/30 px-1 py-0 h-4 hover:bg-blue-100 dark:hover:bg-blue-800 transition-colors">
                        <QrCode size={10} className="mr-1" /> Gen QR
                    </Badge>
                )}
            </div>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-xs sm:max-w-sm text-center" onClick={(e) => e.stopPropagation()}>
                    <DialogHeader>
                        <DialogTitle className="text-center flex justify-center items-center gap-2">
                            <ShieldCheck className="text-emerald-500" />
                            Document Authenticity
                        </DialogTitle>
                        <DialogDescription className="text-center">
                            Provide this code to third parties to verify document authenticity.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-6 flex flex-col items-center justify-center space-y-4">
                        {!record ? (
                            <div className="space-y-4">
                                <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg text-slate-500 flex flex-col items-center">
                                    <QrCode size={48} className="opacity-50 mb-2" />
                                    <p className="text-sm">No QR validation generated yet.</p>
                                </div>
                                {can(ACTIONS.CREATE_PROJECT) && ( // Reusing high-level action check, or add CREATE_QR
                                    <Button onClick={handleGenerate} className="w-full">Generate QR Validation</Button>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-4 w-full">
                                <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm inline-block mx-auto relative group">
                                    {/* Simulated QR Code using CSS grid and icon */}
                                    <div className="w-32 h-32 border-4 border-slate-900 p-2 flex items-center justify-center relative">
                                        <QrCode size={96} className="text-slate-900" />
                                        <div className="absolute inset-0 border-[8px] border-white/50 border-r-transparent border-b-transparent"></div>
                                        <div className="absolute inset-0 border-[8px] border-white/50 border-l-transparent border-t-transparent"></div>
                                    </div>
                                </div>

                                <div className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-left space-y-2 border">
                                    <div>
                                        <div className="text-[10px] text-slate-500 uppercase font-semibold">Validation Hash</div>
                                        <div className="font-mono text-sm font-bold flex items-center justify-between">
                                            {record.validationHash}
                                            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={handleCopyHash}><Copy size={12} /></Button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-semibold">Issued By</div>
                                            <div className="font-medium truncate">{record.issuedBy}</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-slate-500 uppercase font-semibold">Version</div>
                                            <div className="font-medium">v{record.versionNumber}</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex gap-2">
                                    <Button variant="outline" className="flex-1 text-xs" onClick={() => window.open(qrValidationService.getQRUrl(record.validationHash), '_blank')}>
                                        <ExternalLink size={14} className="mr-1.5" /> Test Link
                                    </Button>
                                    {can(ACTIONS.CREATE_PROJECT) && (
                                        <Button variant="outline" className="flex-1 text-xs text-red-600 hover:bg-red-50 hover:text-red-700" onClick={handleRevoke}>
                                            <AlertCircle size={14} className="mr-1.5" /> Revoke
                                        </Button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
