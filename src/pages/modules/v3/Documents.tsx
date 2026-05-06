
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { Folder, FileText, Upload, Download, Trash2, History, Lock, LockOpen, Archive, ArchiveRestore, Loader2, Eye } from "lucide-react"
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
import ModulePageState from "@/components/common/ModulePageState"
import ModuleListToolbar from "@/components/common/ModuleListToolbar"
import { CardSkeleton } from "@/components/common/LoadingSkeleton"

// ── Enterprise Pattern Imports ──────────────────────────────────────────────
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip } from '@/components/patterns'

const CATEGORIES = ["Contracts", "Drawings", "Reports", "Invoices", "Correspondence", "Other"]
const DOC_SORTS = [
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
    { value: 'title-asc', label: 'Title A-Z' },
    { value: 'title-desc', label: 'Title Z-A' },
]

export default function Documents() {
    const { activeProjectId } = useProjectStore()
    const activeProjectName = useProjectStore(s => activeProjectId ? s.projects[activeProjectId]?.name || 'Project' : 'Project')
    const { handleAsync } = useErrorHandler()
    const { user } = useAuthStore()
    const [documents, setDocuments] = useState<ProjectDocument[]>([])
    const [loading, setLoading] = useState(false)
    const [search, setSearch] = useState(() => {
        try { return localStorage.getItem('documents.toolbar.query') || '' } catch { return '' }
    })
    const [uploadOpen, setUploadOpen] = useState(false)
    const [selectedCategory, setSelectedCategory] = useState(() => {
        try { return localStorage.getItem('documents.toolbar.category') || 'All' } catch { return 'All' }
    })
    const [sortBy, setSortBy] = useState(() => {
        try { return localStorage.getItem('documents.toolbar.sort') || 'newest' } catch { return 'newest' }
    })
    const [selectedUploader, setSelectedUploader] = useState(() => {
        try { return localStorage.getItem('documents.toolbar.uploader') || 'All' } catch { return 'All' }
    })
    const [dateFrom, setDateFrom] = useState(() => {
        try { return localStorage.getItem('documents.toolbar.dateFrom') || '' } catch { return '' }
    })
    const [dateTo, setDateTo] = useState(() => {
        try { return localStorage.getItem('documents.toolbar.dateTo') || '' } catch { return '' }
    })

    // Upload Form State
    const [newDocTitle, setNewDocTitle] = useState("")
    const [newDocCategory, setNewDocCategory] = useState("Reports")
    const [newDocFile, setNewDocFile] = useState<File | null>(null)
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    // Version History State
    const [versionDoc, setVersionDoc] = useState<ProjectDocument | null>(null)
    const [pendingDeleteDoc, setPendingDeleteDoc] = useState<ProjectDocument | null>(null)
    const [previewDoc, setPreviewDoc] = useState<ProjectDocument | null>(null)
    const [pageError, setPageError] = useState<string | null>(null)
    const [srStatus, setSrStatus] = useState('')

    const loadDocs = useCallback(async () => {
        if (!activeProjectId) return
        setSrStatus('Loading documents...')
        setLoading(true)
        setPageError(null)
        const data = await handleAsync(async () => {
            const data = await documentService.getDocuments(activeProjectId, true) // Include archived
            return data
        }, 'document.general', { showToast: false })

        if (data) {
            setDocuments(data)
            setSrStatus(`Loaded ${data.length} documents.`)
        } else {
            setPageError('Failed to load document repository data.')
            toast.error("Failed to load documents")
            setSrStatus('Failed to load documents.')
        }

        setLoading(false)
    }, [activeProjectId, handleAsync])

    useEffect(() => {
        if (activeProjectId) {
            queueMicrotask(() => {
                void loadDocs()
            })
        }
    }, [activeProjectId, loadDocs])

    useEffect(() => {
        try {
            localStorage.setItem('documents.toolbar.query', search)
            localStorage.setItem('documents.toolbar.category', selectedCategory)
            localStorage.setItem('documents.toolbar.sort', sortBy)
            localStorage.setItem('documents.toolbar.uploader', selectedUploader)
            localStorage.setItem('documents.toolbar.dateFrom', dateFrom)
            localStorage.setItem('documents.toolbar.dateTo', dateTo)
        } catch {
            // ignore storage errors
        }
    }, [search, selectedCategory, sortBy, selectedUploader, dateFrom, dateTo])

    async function handleUpload() {
        if (!newDocTitle) {
            setSrStatus('Title is required before upload.')
            return toast.error("Title required")
        }

        setSrStatus('Uploading document...')

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
            setSrStatus('Document uploaded successfully.')
            setUploadOpen(false)
            loadDocs()
            setNewDocTitle("")
            setNewDocFile(null)
            if (fileInputRef.current) fileInputRef.current.value = ''
        } else {
            setSrStatus('Failed to upload document.')
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
                setSrStatus('Document unlocked.')
            } else {
                await documentService.lockDocument(doc.id, user?.id || '', user?.user_metadata?.full_name || user?.email || 'User')
                toast.success("Document locked")
                setSrStatus('Document locked.')
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
                setSrStatus('Document restored from archive.')
            } else {
                await documentService.archiveDocument(doc.id, user?.id, user?.user_metadata?.full_name || user?.email || 'User')
                toast.success("Document archived")
                setSrStatus('Document archived.')
            }
            return true
        }, 'document.general')

        if (done) {
            loadDocs()
        }
    }

    async function handleDelete() {
        if (!pendingDeleteDoc) return
        setSrStatus('Deleting document...')
        const done = await handleAsync(async () => {
            await documentService.deleteDocument(pendingDeleteDoc.id, user?.id, user?.user_metadata?.full_name || user?.email || 'User')
            return true
        }, 'document.general')

        if (done) {
            setPendingDeleteDoc(null)
            setSrStatus('Document deleted successfully.')
            loadDocs()
        } else {
            setSrStatus('Failed to delete document.')
        }
    }

    const filteredDocs = useMemo(() => {
        const q = search.trim().toLowerCase()
        const matches = documents.filter((doc) => {
            const matchesSearch = !q || doc.title.toLowerCase().includes(q)
            const matchesCategory = selectedCategory === "All" || doc.category === selectedCategory
            const uploader = (doc.uploaded_by || doc.created_by || '').toLowerCase()
            const matchesUploader = selectedUploader === 'All' || uploader === selectedUploader.toLowerCase()

            const createdDate = new Date(doc.created_at)
            const fromBoundary = dateFrom ? new Date(`${dateFrom}T00:00:00`) : null
            const toBoundary = dateTo ? new Date(`${dateTo}T23:59:59`) : null
            const matchesFrom = !fromBoundary || createdDate >= fromBoundary
            const matchesTo = !toBoundary || createdDate <= toBoundary

            return matchesSearch && matchesCategory && matchesUploader && matchesFrom && matchesTo
        })

        return [...matches].sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            if (sortBy === 'oldest') return new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
            if (sortBy === 'title-desc') return b.title.localeCompare(a.title)
            return a.title.localeCompare(b.title)
        })
    }, [documents, search, selectedCategory, selectedUploader, dateFrom, dateTo, sortBy])

    const uploaderOptions = useMemo(() => {
        const values = Array.from(new Set(
            documents
                .map((doc) => (doc.uploaded_by || doc.created_by || '').trim())
                .filter((name) => name.length > 0)
        ))
        return values.sort((a, b) => a.localeCompare(b))
    }, [documents])

    const clearAdvancedFilters = () => {
        setSelectedUploader('All')
        setDateFrom('')
        setDateTo('')
        setSrStatus('Advanced filters cleared.')
    }

    // P0.3.4: Grid virtualizer — group docs into rows of GRID_COLS
    const GRID_COLS = 4
    const docRows = useMemo(() => {
        const rows: ProjectDocument[][] = []
        for (let i = 0; i < filteredDocs.length; i += GRID_COLS) {
            rows.push(filteredDocs.slice(i, i + GRID_COLS))
        }
        return rows
    }, [filteredDocs])
    const docsScrollRef = useRef<HTMLDivElement>(null)
    const docsVirtualizer = useVirtualizer({
        count: docRows.length,
        getScrollElement: () => docsScrollRef.current,
        estimateSize: () => 196,
        overscan: 3,
    })

    if (!activeProjectId) {
        return (
            <ModulePageState
                icon={<Folder size={18} />}
                title="Documents"
                description="Centralized project repository."
                variant="empty"
                message="Select an active project to view and manage documents."
            />
        )
    }

    if (loading && documents.length === 0) {
        return (
            <ModulePageState
                icon={<Folder size={18} />}
                title="Documents"
                description="Centralized project repository."
                variant="loading"
                message="Loading documents..."
            />
        )
    }

    if (pageError && documents.length === 0) {
        return (
            <ModulePageState
                icon={<Folder size={18} />}
                title="Documents"
                description="Centralized project repository."
                variant="error"
                message={pageError}
                onRetry={loadDocs}
            />
        )
    }

    // ── SummaryStrip items ───────────────────────────────────────────────────
    const activeCount = documents.filter(d => d.status === 'ACTIVE').length
    const archivedCount = documents.filter(d => d.status === 'ARCHIVED').length
    const lockedCount = documents.filter(d => d.is_locked).length
    const docSummary = [
        { label: 'Total', value: documents.length, status: 'neutral' as const },
        { label: 'Active', value: activeCount, status: 'success' as const },
        { label: 'Archived', value: archivedCount, status: archivedCount > 0 ? 'warning' as const : 'neutral' as const },
        { label: 'Locked', value: lockedCount, status: lockedCount > 0 ? 'info' as const : 'neutral' as const },
    ]

    return (
        <PageShell
            contextBar={
                <GlobalContextBar
                    projectName={activeProjectName}
                    syncStatus="synced"
                />
            }
            header={
                <WorkspaceHeader
                    title="Documents"
                    subtitle="Centralized project document repository"
                    primaryAction={{
                        label: 'Upload',
                        icon: <Upload className="h-3.5 w-3.5" />,
                        onClick: () => setUploadOpen(true),
                    }}
                />
            }
            summary={
                <SummaryStrip items={docSummary} variant="chips" />
            }
        >

            <ModuleListToolbar
                query={search}
                onQueryChange={setSearch}
                queryPlaceholder="Search documents..."
                filterValue={selectedCategory}
                onFilterChange={setSelectedCategory}
                filterOptions={[
                    { value: 'All', label: 'All Categories' },
                    ...CATEGORIES.map((category) => ({ value: category, label: category })),
                ]}
                sortValue={sortBy}
                onSortChange={setSortBy}
                sortOptions={DOC_SORTS}
                resultCount={filteredDocs.length}
                resultLabel="documents"
            />

            <div className="flex flex-col gap-2 rounded-md border border-border/60 bg-background/80 p-3 md:flex-row md:items-end md:gap-3">
                <div className="grid gap-1 md:w-[220px]">
                    <Label className="text-xs text-muted-foreground">Uploader</Label>
                    <Select value={selectedUploader} onValueChange={setSelectedUploader}>
                        <SelectTrigger className="h-9" aria-label="Filter by uploader">
                            <SelectValue placeholder="All Uploaders" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="All">All Uploaders</SelectItem>
                            {uploaderOptions.map((name) => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="grid gap-1 md:w-[170px]">
                    <Label className="text-xs text-muted-foreground">Date from</Label>
                    <Input
                        type="date"
                        value={dateFrom}
                        onChange={(event) => setDateFrom(event.target.value)}
                        aria-label="Filter date from"
                        className="h-9"
                    />
                </div>
                <div className="grid gap-1 md:w-[170px]">
                    <Label className="text-xs text-muted-foreground">Date to</Label>
                    <Input
                        type="date"
                        value={dateTo}
                        onChange={(event) => setDateTo(event.target.value)}
                        aria-label="Filter date to"
                        className="h-9"
                    />
                </div>
                <Button type="button" variant="outline" className="h-9 md:ml-auto" onClick={clearAdvancedFilters}>
                    Reset Filters
                </Button>
            </div>

            {loading && documents.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4" aria-live="polite" aria-busy="true">
                    {Array.from({ length: 8 }).map((_, idx) => (
                        <CardSkeleton key={`doc-reload-skeleton-${idx}`} />
                    ))}
                </div>
            ) : filteredDocs.length === 0 ? (
                <EmptyState title="No Documents Found" description="Upload contracts, drawings, or reports." />
            ) : (
                <div
                    ref={docsScrollRef}
                    className="overflow-auto rounded-lg"
                    style={{ maxHeight: '600px' }}
                >
                    <div style={{ height: `${docsVirtualizer.getTotalSize()}px`, position: 'relative' }}>
                    {docsVirtualizer.getVirtualItems().map((vRow) => (
                        <div
                            key={vRow.index}
                            data-index={vRow.index}
                            ref={docsVirtualizer.measureElement}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', transform: `translateY(${vRow.start}px)` }}
                        >
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pb-4">
                            {docRows[vRow.index].map(doc => {
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
                                                aria-label="Download"
                                                className="text-neutral-400 hover:text-green-500 opacity-80 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                                                onClick={() => handleDownload(doc)}
                                                title="Download"
                                            >
                                                <Download size={14} />
                                            </Button>
                                            {doc.file_url && (
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    aria-label="Preview dokumen"
                                                    className="text-neutral-400 hover:text-blue-500 opacity-80 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                                                    onClick={() => setPreviewDoc(doc)}
                                                    title="Preview"
                                                >
                                                    <Eye size={14} />
                                                </Button>
                                            )}
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={isLocked ? `Buka kunci dokumen` : 'Kunci dokumen'}
                                                className={`text-neutral-400 hover:text-orange-500 opacity-80 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${isLocked ? 'text-orange-500 !opacity-100' : ''}`}
                                                onClick={() => handleToggleLock(doc)}
                                                disabled={!governance.canLock && !governance.canUnlock}
                                                title={isLocked ? `Locked by ${doc.locked_by}` : 'Lock document'}
                                            >
                                                {isLocked ? <Lock size={14} /> : <LockOpen size={14} />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={isArchived ? 'Pulihkan dari arsip' : 'Arsipkan dokumen'}
                                                className={`text-neutral-400 hover:text-slate-500 opacity-80 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 ${isArchived ? 'text-slate-500 !opacity-100' : ''}`}
                                                onClick={() => handleToggleArchive(doc)}
                                                disabled={!governance.canArchive && !governance.canUnarchive}
                                                title={isArchived ? 'Restore from archive' : 'Archive document'}
                                            >
                                                {isArchived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Riwayat versi"
                                                className="text-neutral-400 hover:text-blue-500 opacity-80 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                                                onClick={() => setVersionDoc(doc)}
                                                disabled={!governance.canCreateVersion && doc.status === 'ACTIVE'}
                                                title="Version History"
                                            >
                                                <History size={14} />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Hapus dokumen"
                                                className="text-neutral-400 hover:text-red-500 opacity-80 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
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
                                        {(doc.uploaded_by || doc.created_by) && (
                                            <div className="text-xs text-neutral-500 mt-1">
                                                By {doc.uploaded_by || doc.created_by}
                                            </div>
                                        )}
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
                    })}                            </div>
                        </div>
                    ))}
                    </div>                </div>
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
                        <Button onClick={handleUpload} disabled={loading} aria-busy={loading} className="gap-2">
                            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {loading ? 'Uploading...' : 'Upload'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Version History Dialog */}
            {versionDoc && (
                <DocumentVersionHistory
                    open={!!versionDoc}
                    onOpenChange={(open) => { if (!open) setVersionDoc(null) }}
                    documentGroupId={versionDoc.document_group_id || versionDoc.id}
                    _projectId={activeProjectId!}
                    documentTitle={versionDoc.title}
                    onReverted={loadDocs}
                />
            )}

            {/* PDF Preview Dialog */}
            <Dialog open={!!previewDoc} onOpenChange={(open) => { if (!open) setPreviewDoc(null) }}>
                <DialogContent className="max-w-4xl w-full h-[85vh] flex flex-col p-0">
                    <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
                        <DialogTitle className="flex items-center gap-2 text-sm">
                            <FileText size={16} />
                            {previewDoc?.title}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="flex-1 overflow-hidden">
                        {previewDoc?.file_url && previewDoc.file_url.toLowerCase().includes('.pdf') ? (
                            <iframe
                                src={previewDoc.file_url}
                                title={`Preview: ${previewDoc.title}`}
                                className="w-full h-full border-0"
                                aria-label={`Preview PDF: ${previewDoc.title}`}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
                                <FileText size={48} className="opacity-30" />
                                <p className="text-sm">Preview tidak tersedia untuk format ini</p>
                                <Button size="sm" variant="outline" onClick={() => previewDoc && handleDownload(previewDoc)}>
                                    <Download size={14} className="mr-2" />
                                    Download untuk membuka
                                </Button>
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>

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
        </PageShell>
    )
}
