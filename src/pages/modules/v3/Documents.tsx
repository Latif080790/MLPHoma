
import React, { useEffect, useState } from "react"
import { ModuleHeader } from "@/components/modules/ModuleHeader"
import { Folder, FileText, Upload, Download, Trash2, Search, History, Lock, LockOpen, Archive, ArchiveRestore } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProjectStore } from "@/store/projectStore"
import { useAuthStore } from "@/store/authStore"
import { documentService, ProjectDocument, getDocumentGovernanceState } from "@/services/documentService"
import { format } from "date-fns"
import { EmptyState } from "@/components/common/EmptyState"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { DocumentVersionHistory } from "@/components/modules/DocumentVersionHistory"
import { QRValidationBadge } from "@/components/document/QRValidationBadge"
import { useErrorHandler } from "@/hooks/useErrorHandler"

const CATEGORIES = ["Contracts", "Drawings", "Reports", "Invoices", "Correspondence", "Other"]

export default function Documents() {
    const { activeProjectId } = useProjectStore()
    const { handleAsync } = useErrorHandler()
    const { user } = useAuthStore()
    const [documents, setDocuments] = useState<ProjectDocument[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState("")
    const [uploadOpen, setUploadOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState("All")

    // Upload Form State
    const [newDocTitle, setNewDocTitle] = useState("")
    const [newDocCategory, setNewDocCategory] = useState("Reports")
    const [newDocFile, setNewDocFile] = useState<File | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // Version History State
    const [versionDoc, setVersionDoc] = useState<ProjectDocument | null>(null)
    const [pendingDeleteDoc, setPendingDeleteDoc] = useState<ProjectDocument | null>(null)

    useEffect(() => {
        if (activeProjectId) loadDocs()
    }, [activeProjectId])

    async function loadDocs() {
        if (!activeProjectId) return
        setLoading(true)
        const data = await handleAsync(async () => {
            const data = await documentService.getDocuments(activeProjectId, true) // Include archived
            return data
        }, 'document.general', { showToast: false })

        if (data) {
            setDocuments(data)
        } else {
            toast.error("Failed to load documents")
        }

        setLoading(false)
    }

    async function handleUpload() {
        if (!newDocTitle) return toast.error("Title required")

        const uploaded = await handleAsync(async () => {
            await documentService.uploadDocument({
                project_id: activeProjectId!,
                title: newDocTitle,
                category: newDocCategory,
            }, newDocFile || undefined, user?.id, user?.user_metadata?.full_name || user?.email || 'User')
            return true
        }, 'document.general')

        if (uploaded) {
            toast.success("Document uploaded")
            setUploadOpen(false)
            loadDocs()
            setNewDocTitle("")
            setNewDocFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        }
    }

    function handleDownload(doc: ProjectDocument) {
        if (doc.file_url) {
            window.open(doc.file_url, '_blank')
        } else {
            toast.error('No file URL available')
        }
    }

    async function handleToggleLock(doc: ProjectDocument) {
        const done = await handleAsync(async () => {
            if (doc.is_locked) {
                await documentService.unlockDocument(doc.id, user?.id, user?.user_metadata?.full_name || user?.email || 'User')
                toast.success("Document unlocked")
            } else {
                await documentService.lockDocument(doc.id, user?.id || '', user?.user_metadata?.full_name || user?.email || 'User')
                toast.success("Document locked")
            }
            return true
        }, 'document.general')

        if (done) {
            loadDocs()
        }
    }

    async function handleToggleArchive(doc: ProjectDocument) {
        const done = await handleAsync(async () => {
            if (doc.status === 'ARCHIVED') {
                await documentService.unarchiveDocument(doc.id)
                toast.success("Document restored")
            } else {
                await documentService.archiveDocument(doc.id, user?.id, user?.user_metadata?.full_name || user?.email || 'User')
                toast.success("Document archived")
            }
            return true
        }, 'document.general')

        if (done) {
            loadDocs()
        }
    }

    async function handleDelete() {
        if (!pendingDeleteDoc) return
        const done = await handleAsync(async () => {
            await documentService.deleteDocument(pendingDeleteDoc.id, user?.id, user?.user_metadata?.full_name || user?.email || 'User')
            return true
        }, 'document.general')

        if (done) {
            setPendingDeleteDoc(null)
            loadDocs()
        }
    }

    const filteredDocs = documents.filter(doc => {
        const matchesSearch = doc.title.toLowerCase().includes(search.toLowerCase())
        const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory
        return matchesSearch && matchesCategory
    })

    if (!activeProjectId) return <EmptyState title="No Project Selected" description="Select a project to view documents." />

    return (
        <div className="space-y-6">
            <ModuleHeader
                icon={<Folder size={18} />}
                title="Documents"
                description="Centralized project repository."
                actions={
                    <Button size="sm" className="gap-2" onClick={() => setUploadOpen(true)}>
                        <Upload size={16} /> Upload Document
                    </Button>
                }
            />

            <div className="flex gap-4 items-center">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-neutral-500" />
                    <Input
                        placeholder="Search documents..."
                        className="pl-8"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="All">All Categories</SelectItem>
                        {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>

            {filteredDocs.length === 0 ? (
                <EmptyState title="No Documents Found" description="Upload contracts, drawings, or reports." imageKeyword="files" />
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                    {filteredDocs.map(doc => {
                        const isArchived = doc.status === 'ARCHIVED'
                        const isSuperseded = doc.status === 'SUPERSEDED'
                        const isLocked = doc.is_locked
                        const governance = getDocumentGovernanceState(doc)

                        return (
                            <Card
                                key={doc.id}
                                className={`hover:border-blue-500 transition-colors group ${isArchived ? 'opacity-60 border-slate-300' :
                                    isSuperseded ? 'opacity-50 border-yellow-300' : ''
                                    }`}
                            >
                                <CardContent className="p-4 flex flex-col justify-between h-full min-h-[140px]">
                                    <div className="flex items-start justify-between">
                                        <div className={`p-2 rounded ${isArchived ? 'bg-slate-50 text-slate-400' :
                                            isSuperseded ? 'bg-yellow-50 text-yellow-600' :
                                                'bg-blue-50 text-blue-600'
                                            }`}>
                                            <FileText size={20} />
                                        </div>
                                        <div className="flex gap-1">
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-neutral-400 hover:text-green-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleDownload(doc)}
                                                title="Download"
                                            >
                                                <Download size={14} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`text-neutral-400 hover:text-orange-500 opacity-0 group-hover:opacity-100 transition-opacity ${isLocked ? 'text-orange-500 opacity-100' : ''}`}
                                                onClick={() => handleToggleLock(doc)}
                                                disabled={!governance.canLock && !governance.canUnlock}
                                                title={isLocked ? `Locked by ${doc.locked_by}` : 'Lock document'}
                                            >
                                                {isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className={`text-neutral-400 hover:text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity ${isArchived ? 'text-slate-500 opacity-100' : ''}`}
                                                onClick={() => handleToggleArchive(doc)}
                                                disabled={!governance.canArchive && !governance.canUnarchive}
                                                title={isArchived ? 'Restore from archive' : 'Archive document'}
                                            >
                                                {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-neutral-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => setVersionDoc(doc)}
                                                disabled={!governance.canCreateVersion && doc.status === 'ACTIVE'}
                                                title="Version History"
                                            >
                                                <History size={14} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => setPendingDeleteDoc(doc)}
                                                disabled={!governance.canDelete}
                                            >
                                                <Trash2 size={14} />
                                            </Button>
                                        </div>
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <h4 className="font-semibold truncate flex-1" title={doc.title}>{doc.title}</h4>
                                            {(isArchived || isSuperseded || isLocked || doc.status === 'ACTIVE') && (
                                                <div className="flex gap-1">
                                                    {doc.status === 'ACTIVE' && !isLocked && (
                                                        <Badge variant="outline" className="text-xs px-1 py-0 bg-emerald-50 text-emerald-700 border-emerald-200">
                                                            ACTIVE
                                                        </Badge>
                                                    )}
                                                    {isLocked && (
                                                        <Badge variant="outline" className="text-xs px-1 py-0 bg-orange-50 text-orange-700 border-orange-200">
                                                            <Lock className="h-2 w-2 mr-0.5" /> LOCKED
                                                        </Badge>
                                                    )}
                                                    {isArchived && (
                                                        <Badge variant="outline" className="text-xs px-1 py-0 bg-slate-100 text-slate-600 border-slate-300">
                                                            ARCHIVED
                                                        </Badge>
                                                    )}
                                                    {isSuperseded && (
                                                        <Badge variant="outline" className="text-xs px-1 py-0 bg-yellow-50 text-yellow-700 border-yellow-200">
                                                            SUPERSEDED
                                                        </Badge>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                        <p className="text-xs text-neutral-500">{doc.category} • v{doc.version_number}</p>
                                        <div className="text-xs text-neutral-400 mt-1">
                                            {format(new Date(doc.created_at), 'dd MMM yyyy')}
                                            {doc.file_size ? ` • ${(doc.file_size / 1024).toFixed(0)} KB` : ''}
                                        </div>
                                        {isLocked && doc.locked_by && (
                                            <div className="text-xs text-orange-600 mt-1">
                                                🔒 {doc.locked_by}
                                            </div>
                                        )}
                                        <div className="mt-3 flex justify-end">
                                            <QRValidationBadge
                                                documentId={doc.id}
                                                projectId={activeProjectId!}
                                                documentTitle={doc.title}
                                                versionNumber={doc.version_number}
                                                category={doc.category}
                                                status={isLocked ? 'APPROVED' : 'DRAFT'}
                                            />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}

            {/* Upload Dialog */}
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Upload Document</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid gap-2">
                            <Label>Title</Label>
                            <Input value={newDocTitle} onChange={e => setNewDocTitle(e.target.value)} placeholder="e.g. Contract v1" />
                        </div>
                        <div className="grid gap-2">
                            <Label>Category</Label>
                            <Select value={newDocCategory} onValueChange={setNewDocCategory}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="grid gap-2">
                            <Label>File</Label>
                            <Input
                                ref={fileInputRef}
                                type="file"
                                onChange={e => setNewDocFile(e.target.files?.[0] || null)}
                                accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.dwg,.zip"
                            />
                            {newDocFile && (
                                <p className="text-xs text-neutral-500">
                                    {newDocFile.name} ({(newDocFile.size / 1024).toFixed(1)} KB)
                                </p>
                            )}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
                        <Button onClick={handleUpload} disabled={loading}>{loading ? 'Uploading...' : 'Upload'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Version History Dialog */}
            {versionDoc && (
                <DocumentVersionHistory
                    open={!!versionDoc}
                    onOpenChange={(open) => { if (!open) setVersionDoc(null) }}
                    documentGroupId={versionDoc.document_group_id || versionDoc.id}
                    projectId={activeProjectId!}
                    documentTitle={versionDoc.title}
                    onReverted={loadDocs}
                />
            )}

            <AlertDialog open={!!pendingDeleteDoc} onOpenChange={(open) => { if (!open) setPendingDeleteDoc(null) }}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete this document?</AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingDeleteDoc ? `"${pendingDeleteDoc.title}" will be deleted from the repository.` : 'This action cannot be undone.'}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
