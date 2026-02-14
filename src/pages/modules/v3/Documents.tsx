
import React, { useEffect, useState } from "react"
import { ModuleHeader } from "@/components/modules/ModuleHeader"
import { Folder, FileText, Upload, Download, Trash2, Search, History } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useProjectStore } from "@/store/projectStore"
import { documentService, ProjectDocument } from "@/services/documentService"
import { format } from "date-fns"
import { EmptyState } from "@/components/common/EmptyState"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { DocumentVersionHistory } from "@/components/modules/DocumentVersionHistory"

const CATEGORIES = ["Contracts", "Drawings", "Reports", "Invoices", "Correspondence", "Other"]

export default function Documents() {
    const { activeProjectId } = useProjectStore()
    const [documents, setDocuments] = useState<ProjectDocument[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState("")
    const [uploadOpen, setUploadOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState("All")

    // Upload Form State
    const [newDocTitle, setNewDocTitle] = useState("")
    const [newDocCategory, setNewDocCategory] = useState("Reports")
    const [newDocUrl, setNewDocUrl] = useState("")

    // Version History State
    const [versionDoc, setVersionDoc] = useState<ProjectDocument | null>(null)

    useEffect(() => {
        if (activeProjectId) loadDocs()
    }, [activeProjectId])

    async function loadDocs() {
        if (!activeProjectId) return
        setLoading(true)
        try {
            const data = await documentService.getDocuments(activeProjectId)
            setDocuments(data)
        } catch (err: any) {
            toast.error("Failed to load documents")
        } finally {
            setLoading(false)
        }
    }

    async function handleUpload() {
        if (!newDocTitle) return toast.error("Title required")

        try {
            await documentService.uploadDocument({
                project_id: activeProjectId!,
                title: newDocTitle,
                category: newDocCategory,
                file_url: newDocUrl || 'https://example.com/file.pdf' // Mock URL if empty
            })
            toast.success("Document uploaded")
            setUploadOpen(false)
            loadDocs()
            setNewDocTitle("")
            setNewDocUrl("")
        } catch (err: any) {
            toast.error(err.message)
        }
    }

    async function handleDelete(id: string) {
        if (confirm("Delete this document?")) {
            await documentService.deleteDocument(id)
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
                    {filteredDocs.map(doc => (
                        <Card key={doc.id} className="hover:border-blue-500 transition-colors group">
                            <CardContent className="p-4 flex flex-col justify-between h-full min-h-[140px]">
                                <div className="flex items-start justify-between">
                                    <div className="bg-blue-50 p-2 rounded text-blue-600">
                                        <FileText size={20} />
                                    </div>
                                    <div className="flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-neutral-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => setVersionDoc(doc)}
                                            title="Version History"
                                        >
                                            <History size={14} />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            onClick={() => handleDelete(doc.id)}
                                        >
                                            <Trash2 size={14} />
                                        </Button>
                                    </div>
                                </div>
                                <div>
                                    <h4 className="font-semibold truncate" title={doc.title}>{doc.title}</h4>
                                    <p className="text-xs text-neutral-500">{doc.category} • v{doc.version_number}</p>
                                    <div className="text-xs text-neutral-400 mt-1">{format(new Date(doc.created_at), 'dd MMM yyyy')}</div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
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
                            <Label>File URL (Optional Mock)</Label>
                            <Input value={newDocUrl} onChange={e => setNewDocUrl(e.target.value)} placeholder="https://..." />
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
        </div>
    )
}
