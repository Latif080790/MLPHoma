/**
 * EvidenceUploadDialog.tsx
 * Dialog for uploading progress evidence (photos, videos, documents, signatures).
 * Captures location metadata and validates requirements.
 */

import { useState, useEffect } from 'react'
import { useAuthStore } from '../../store/authStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Badge } from '../ui/badge'
import { Camera, Video, FileText, PenTool, MapPin, Upload, X, AlertCircle, CheckCircle } from 'lucide-react'
import { progressEvidenceService } from '../../services/progressEvidenceService'
import type { EvidenceType, EvidenceRequirement } from '../../types/progressEvidence'
import { cn } from '../../lib/utils'

interface EvidenceUploadDialogProps {
    isOpen: boolean
    onClose: () => void
    taskId: string
    taskName: string
    progressUpdateId: string
    requirement?: EvidenceRequirement | null
    onUploadComplete?: () => void
}

interface UploadingFile {
    file: File
    preview?: string
    uploading: boolean
    uploaded: boolean
    error?: string
}

const EVIDENCE_TYPE_CONFIG = {
    PHOTO: { icon: Camera, label: 'Photo', accept: 'image/*', color: 'blue' },
    VIDEO: { icon: Video, label: 'Video', accept: 'video/*', color: 'purple' },
    DOCUMENT: { icon: FileText, label: 'Document', accept: '.pdf,.doc,.docx', color: 'green' },
    SIGNATURE: { icon: PenTool, label: 'Signature', accept: 'image/*', color: 'orange' },
}

export function EvidenceUploadDialog({
    isOpen,
    onClose,
    taskId,
    taskName,
    progressUpdateId,
    requirement,
    onUploadComplete,
}: EvidenceUploadDialogProps) {
    const [evidenceType, setEvidenceType] = useState<EvidenceType>('PHOTO')
    const [files, setFiles] = useState<UploadingFile[]>([])
    const [description, setDescription] = useState('')
    const [tags, setTags] = useState<string>('')
    
    const [location, setLocation] = useState<{ lat: number; lng: number; accuracy: number } | null>(null)
    const [locationLoading, setLocationLoading] = useState(false)
    const [locationError, setLocationError] = useState<string | null>(null)
    
    const [uploading, setUploading] = useState(false)
    const [uploadedCount, setUploadedCount] = useState(0)

    const user = useAuthStore((s) => s.user)
    const profile = useAuthStore((s) => s.profile)
    
    useEffect(() => {
        if (isOpen) {
            // Reset state when dialog opens
            setFiles([])
            setDescription('')
            setTags('')
            setLocation(null)
            setLocationError(null)
            setUploadedCount(0)
            
            // Auto-capture location if required
            if (requirement?.locationRequired) {
                captureLocation()
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, requirement])
    
    const captureLocation = async () => {
        setLocationLoading(true)
        setLocationError(null)
        
        try {
            const coords = await progressEvidenceService.getCurrentPosition()
            if (coords) {
                setLocation({ lat: coords.latitude, lng: coords.longitude, accuracy: 10 })
            } else {
                setLocationError('Location access denied or unavailable')
            }
        } catch {
            setLocationError('Failed to capture location')
        } finally {
            setLocationLoading(false)
        }
    }
    
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFiles = Array.from(e.target.files || [])
        
        const newFiles: UploadingFile[] = selectedFiles.map(file => ({
            file,
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : undefined,
            uploading: false,
            uploaded: false,
        }))
        
        setFiles(prev => [...prev, ...newFiles])
    }
    
    const removeFile = (index: number) => {
        setFiles(prev => {
            const updated = [...prev]
            // Revoke preview URL to prevent memory leaks
            if (updated[index].preview) {
                URL.revokeObjectURL(updated[index].preview!)
            }
            updated.splice(index, 1)
            return updated
        })
    }
    
    const handleUpload = async () => {
        if (files.length === 0) return
        
        setUploading(true)
        setUploadedCount(0)
        
        const userId = user?.id ?? 'anonymous'
        const userName = profile?.full_name ?? user?.email ?? 'Unknown User'
        
        try {
            for (let i = 0; i < files.length; i++) {
                const fileItem = files[i]
                
                // Update file status to uploading
                setFiles(prev => {
                    const updated = [...prev]
                    updated[i] = { ...updated[i], uploading: true }
                    return updated
                })
                
                try {
                    await progressEvidenceService.uploadEvidence({
                        progressUpdateId,
                        taskId,
                        evidenceType,
                        file: fileItem.file,
                        capturedAt: new Date().toISOString(),
                        capturedBy: userId,
                        capturedByName: userName,
                        latitude: location?.lat,
                        longitude: location?.lng,
                        locationAccuracy: location?.accuracy,
                        description: description || undefined,
                        tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : undefined,
                    })
                    
                    // Update file status to uploaded
                    setFiles(prev => {
                        const updated = [...prev]
                        updated[i] = { ...updated[i], uploading: false, uploaded: true }
                        return updated
                    })
                    
                    setUploadedCount(prev => prev + 1)
                } catch (error) {
                    // Update file status to error
                    setFiles(prev => {
                        const updated = [...prev]
                        updated[i] = {
                            ...updated[i],
                            uploading: false,
                            error: error instanceof Error ? error.message : 'Upload failed',
                        }
                        return updated
                    })
                }
            }
            
            // All uploads complete
            if (onUploadComplete) {
                onUploadComplete()
            }
            
            // Close dialog after 1 second
            setTimeout(() => {
                onClose()
            }, 1000)
        } finally {
            setUploading(false)
        }
    }
    
    const config = EVIDENCE_TYPE_CONFIG[evidenceType]
    const Icon = config.icon
    
    const allUploaded = files.length > 0 && files.every(f => f.uploaded)
    const _hasErrors = files.some(f => f.error)
    
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Upload Progress Evidence - {taskName}</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4 py-4">
                    {/* Evidence Type Selection */}
                    <div className="space-y-2">
                        <Label>Evidence Type</Label>
                        <div className="flex gap-2">
                            {(Object.entries(EVIDENCE_TYPE_CONFIG) as [EvidenceType, typeof EVIDENCE_TYPE_CONFIG[EvidenceType]][]).map(([type, cfg]) => {
                                const TypeIcon = cfg.icon
                                return (
                                    <Button
                                        key={type}
                                        variant={evidenceType === type ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => setEvidenceType(type)}
                                        className="flex items-center gap-2"
                                    >
                                        <TypeIcon className="h-4 w-4" />
                                        {cfg.label}
                                    </Button>
                                )
                            })}
                        </div>
                    </div>
                    
                    {/* Requirements Display */}
                    {requirement && (
                        <div className="bg-muted p-3 rounded-lg space-y-2">
                            <div className="text-sm font-medium">Evidence Requirements:</div>
                            <div className="flex flex-wrap gap-2">
                                {requirement.photoRequired && (
                                    <Badge variant="outline">
                                        <Camera className="h-3 w-3 mr-1" />
                                        {requirement.photoMinCount}+ photos
                                    </Badge>
                                )}
                                {requirement.videoRequired && (
                                    <Badge variant="outline">
                                        <Video className="h-3 w-3 mr-1" />
                                        Video required
                                    </Badge>
                                )}
                                {requirement.locationRequired && (
                                    <Badge variant="outline">
                                        <MapPin className="h-3 w-3 mr-1" />
                                        GPS location required
                                    </Badge>
                                )}
                                {requirement.signatureRequired && (
                                    <Badge variant="outline">
                                        <PenTool className="h-3 w-3 mr-1" />
                                        Signature required
                                    </Badge>
                                )}
                            </div>
                        </div>
                    )}
                    
                    {/* File Selection */}
                    <div className="space-y-2">
                        <Label htmlFor="file-input">Select {config.label}(s)</Label>
                        <Input
                            id="file-input"
                            type="file"
                            accept={config.accept}
                            multiple
                            onChange={handleFileSelect}
                            disabled={uploading}
                            className="field-input-mobile"
                        />
                    </div>
                    
                    {/* File Previews */}
                    {files.length > 0 && (
                        <div className="space-y-2">
                            <Label>Selected Files ({files.length})</Label>
                            <div className="grid grid-cols-2 gap-2">
                                {files.map((fileItem, idx) => (
                                    <div
                                        key={idx}
                                        className={cn(
                                            'relative border rounded-lg p-2 flex items-center gap-2',
                                            fileItem.uploaded && 'border-green-500 bg-green-50',
                                            fileItem.error && 'border-red-500 bg-red-50',
                                            fileItem.uploading && 'opacity-60'
                                        )}
                                    >
                                        {fileItem.preview && (
                                            <img
                                                src={fileItem.preview}
                                                alt="Preview"
                                                className="w-16 h-16 object-cover rounded"
                                            />
                                        )}
                                        {!fileItem.preview && (
                                            <div className="w-16 h-16 bg-muted rounded flex items-center justify-center">
                                                <Icon className="h-8 w-8 text-muted-foreground" />
                                            </div>
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium truncate">{fileItem.file.name}</div>
                                            <div className="text-xs text-muted-foreground">
                                                {(fileItem.file.size / 1024).toFixed(1)} KB
                                            </div>
                                            {fileItem.uploading && (
                                                <div className="text-xs text-blue-600">Uploading...</div>
                                            )}
                                            {fileItem.uploaded && (
                                                <div className="text-xs text-green-600 flex items-center gap-1">
                                                    <CheckCircle className="h-3 w-3" />
                                                    Uploaded
                                                </div>
                                            )}
                                            {fileItem.error && (
                                                <div className="text-xs text-red-600 flex items-center gap-1">
                                                    <AlertCircle className="h-3 w-3" />
                                                    {fileItem.error}
                                                </div>
                                            )}
                                        </div>
                                        {!fileItem.uploading && !fileItem.uploaded && (
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label="Hapus file"
                                                className="h-8 w-8"
                                                onClick={() => removeFile(idx)}
                                            >
                                                <X className="h-4 w-4" />
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    
                    {/* Location Capture */}
                    <div className="space-y-2">
                        <Label>GPS Location</Label>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={captureLocation}
                                disabled={locationLoading || uploading}
                                className="flex items-center gap-2"
                            >
                                <MapPin className="h-4 w-4" />
                                {locationLoading ? 'Capturing...' : location ? 'Update Location' : 'Capture Location'}
                            </Button>
                            
                            {location && (
                                <Badge variant="outline" className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {location.lat.toFixed(6)}, {location.lng.toFixed(6)}
                                    <span className="text-xs text-muted-foreground ml-1">
                                        (±{location.accuracy}m)
                                    </span>
                                </Badge>
                            )}
                            
                            {locationError && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                    <AlertCircle className="h-3 w-3" />
                                    {locationError}
                                </Badge>
                            )}
                        </div>
                        {requirement?.locationRequired && !location && (
                            <p className="text-sm text-amber-600">Location is required for this task</p>
                        )}
                    </div>
                    
                    {/* Description */}
                    <div className="space-y-2">
                        <Label htmlFor="description">Description (Optional)</Label>
                        <Textarea
                            id="description"
                            placeholder="Add notes about this evidence..."
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            disabled={uploading}
                            rows={3}
                            className="field-input-mobile !h-auto min-h-[100px]"
                        />
                    </div>
                    
                    {/* Tags */}
                    <div className="space-y-2">
                        <Label htmlFor="tags">Tags (Optional)</Label>
                        <Input
                            id="tags"
                            placeholder="e.g., QC, PM, inspection"
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            disabled={uploading}
                        />
                        <p className="text-xs text-muted-foreground">Separate tags with commas</p>
                    </div>
                    
                    {/* Upload Progress */}
                    {uploading && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-blue-700">
                                <Upload className="h-4 w-4 animate-pulse" />
                                Uploading {uploadedCount} of {files.length} files...
                            </div>
                        </div>
                    )}
                    
                    {allUploaded && (
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                            <div className="flex items-center gap-2 text-sm text-green-700">
                                <CheckCircle className="h-4 w-4" />
                                All files uploaded successfully!
                            </div>
                        </div>
                    )}
                </div>
                
                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={uploading} className="field-button">
                        Cancel
                    </Button>
                    <Button
                        onClick={handleUpload}
                        disabled={files.length === 0 || uploading || allUploaded || (requirement?.locationRequired && !location)}
                        className="field-button"
                    >
                        {uploading ? `Uploading... (${uploadedCount}/${files.length})` : `Upload ${files.length} file(s)`}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
