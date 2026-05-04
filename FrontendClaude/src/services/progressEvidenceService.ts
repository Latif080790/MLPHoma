/**
 * progressEvidenceService.ts
 * Service for managing progress evidence validation and requirements.
 * Enforces quality gates on progress updates.
 */

import { assertSupabase } from '../lib/supabaseClient'
import { generateId } from '../lib/idGenerator'
import type {
    ProgressEvidence,
    EvidenceRequirement,
    EvidenceValidationResult,
    UploadEvidenceInput,
} from '../types/progressEvidence'

// ---------- Types ----------

export interface GpsCoords {
    latitude: number
    longitude: number
}

// ---------- Constants ----------

const MAX_FUTURE_MINUTES = 30 // Don't accept photos > 30 min in the future

// ---------- Helpers ----------

/**
 * Haversine formula: distance between two GPS coordinates in meters
 */
function haversineDistance(
    lat1: number, lon1: number,
    lat2: number, lon2: number,
): number {
    const R = 6371000 // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180
    const dLon = (lon2 - lon1) * Math.PI / 180
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
    return R * c
}

// ---------- Service ----------

export const progressEvidenceService = {

    /**
     * Get evidence requirements for a task
     */
    async getTaskEvidenceRequirements(taskId: string): Promise<EvidenceRequirement | null> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('task_evidence_requirements')
            .select('*')
            .eq('task_id', taskId)
            .single()

        if (error || !data) return null

        return {
            taskId: data.task_id,
            taskName: data.task_name,
            photoRequired: data.photo_required || false,
            photoMinCount: data.photo_min_count || 0,
            videoRequired: data.video_required || false,
            signatureRequired: data.signature_required || false,
            signatureRoles: data.signature_roles || [],
            locationRequired: data.location_required || false,
            locationMaxDistance: data.location_max_distance,
            timestampRequired: data.timestamp_required || false,
            timestampWindow: data.timestamp_window,
            checklistItems: data.checklist_items || [],
            complianceNotes: data.compliance_notes,
        }
    },

    /**
     * Get project site coordinates
     */
    async getProjectSiteCoords(projectId: string): Promise<GpsCoords | null> {
        const client = assertSupabase()
        const { data } = await client
            .from('projects')
            .select('latitude, longitude')
            .eq('id', projectId)
            .single()

        if (data?.latitude && data?.longitude) {
            return { latitude: Number(data.latitude), longitude: Number(data.longitude) }
        }
        return null
    },

    /**
     * Validate evidence against requirements
     */
    validateEvidence(
        evidence: ProgressEvidence[],
        requirement: EvidenceRequirement,
        siteCoords?: GpsCoords | null,
    ): EvidenceValidationResult {
        const result: EvidenceValidationResult = {
            isValid: true,
            missingEvidence: [],
            warnings: [],
            errors: [],
            photoCount: 0,
            photoRequired: requirement.photoMinCount,
            hasVideo: false,
            videoRequired: requirement.videoRequired,
            hasLocation: false,
            locationRequired: requirement.locationRequired,
            hasTimestamp: false,
            timestampValid: true,
            hasSignature: false,
            signatureRequired: requirement.signatureRequired,
            signaturesMissing: [],
        }

        // Count photo evidence
        const photos = evidence.filter(e => e.evidenceType === 'PHOTO')
        result.photoCount = photos.length

        // Check photo requirement
        if (requirement.photoRequired && photos.length < requirement.photoMinCount) {
            result.isValid = false
            result.missingEvidence.push(
                `${requirement.photoMinCount - photos.length} more photo(s) required`
            )
            result.errors.push(
                `Minimum ${requirement.photoMinCount} photos required, only ${photos.length} provided`
            )
        }

        // Check video requirement
        const videos = evidence.filter(e => e.evidenceType === 'VIDEO')
        result.hasVideo = videos.length > 0
        if (requirement.videoRequired && !result.hasVideo) {
            result.isValid = false
            result.missingEvidence.push('Video evidence required')
            result.errors.push('Video documentation is mandatory for this task')
        }

        // Check location requirement
        const withLocation = evidence.filter(e => e.latitude && e.longitude)
        result.hasLocation = withLocation.length > 0
        if (requirement.locationRequired && !result.hasLocation) {
            result.isValid = false
            result.missingEvidence.push('GPS location required')
            result.errors.push('Location capture is mandatory for this task')
        }

        // Validate location distance if site coordinates provided
        if (siteCoords && requirement.locationMaxDistance) {
            withLocation.forEach(ev => {
                if (ev.latitude && ev.longitude) {
                    const dist = haversineDistance(
                        ev.latitude, ev.longitude,
                        siteCoords.latitude, siteCoords.longitude
                    )
                    if (dist > requirement.locationMaxDistance!) {
                        result.warnings.push(
                            `Evidence ${ev.id} taken ${Math.round(dist)}m from project site (max: ${requirement.locationMaxDistance}m)`
                        )
                    }
                }
            })
        }

        // Check timestamp requirement
        result.hasTimestamp = evidence.every(e => e.capturedAt)
        if (requirement.timestampRequired && !result.hasTimestamp) {
            result.isValid = false
            result.errors.push('All evidence must have valid timestamps')
        }

        // Check timestamp window if specified
        if (requirement.timestampWindow) {
            const { start, end } = requirement.timestampWindow
            const outOfWindow = evidence.filter(e => {
                const capturedAt = new Date(e.capturedAt)
                return capturedAt < new Date(start) || capturedAt > new Date(end)
            })

            if (outOfWindow.length > 0) {
                result.timestampValid = false
                result.warnings.push(
                    `${outOfWindow.length} evidence item(s) captured outside allowed time window`
                )
            }
        }

        // Check for future timestamps
        evidence.forEach(ev => {
            const capturedAt = new Date(ev.capturedAt).getTime()
            const now = Date.now()
            if (capturedAt > now + MAX_FUTURE_MINUTES * 60 * 1000) {
                result.warnings.push(
                    `Evidence ${ev.id} timestamp is in the future — possible clock manipulation`
                )
            }
        })

        // Check signature requirement
        const signatures = evidence.filter(e => e.evidenceType === 'SIGNATURE')
        result.hasSignature = signatures.length > 0
        if (requirement.signatureRequired) {
            if (!result.hasSignature) {
                result.isValid = false
                result.missingEvidence.push('Signature required')
                result.errors.push('Authorized signature is mandatory for this task')
            }

            // Check if all required roles have signed
            if (requirement.signatureRoles && requirement.signatureRoles.length > 0) {
                const signedRoles = signatures
                    .map(s => s.tags)
                    .flat()
                    .filter(Boolean) as string[]

                const missingSigs = requirement.signatureRoles.filter(
                    role => !signedRoles.includes(role)
                )

                if (missingSigs.length > 0) {
                    result.isValid = false
                    result.signaturesMissing = missingSigs
                    result.errors.push(
                        `Missing signatures from: ${missingSigs.join(', ')}`
                    )
                }
            }
        }

        // Additional warnings for quality
        if (photos.length > 0) {
            const lowQualityPhotos = photos.filter(p => p.fileSize < 50000) // < 50KB
            if (lowQualityPhotos.length > 0) {
                result.warnings.push(
                    `${lowQualityPhotos.length} photo(s) may be low quality (< 50KB)`
                )
            }
        }

        return result
    },

    /**
     * Upload evidence for a progress update
     */
    async uploadEvidence(input: UploadEvidenceInput): Promise<ProgressEvidence> {
        const client = assertSupabase()
        const id = generateId('evidence')

        // Upload file to storage
        const filePath = `progress-evidence/${input.taskId}/${id}_${input.file.name}`
        const { error: uploadError } = await client.storage
            .from('progress-evidence')
            .upload(filePath, input.file, { contentType: input.file.type, upsert: false })

        let fileUrl = ''
        if (uploadError) {
            console.warn('Storage upload failed, using mock URL:', uploadError.message)
            fileUrl = `https://storage.example.com/${filePath}`
        } else {
            const { data: urlData } = client.storage
                .from('progress-evidence')
                .getPublicUrl(filePath)
            fileUrl = urlData?.publicUrl || `https://storage.example.com/${filePath}`
        }

        // Save evidence metadata
        const evidence: ProgressEvidence = {
            id,
            progressUpdateId: input.progressUpdateId,
            taskId: input.taskId,
            evidenceType: input.evidenceType,
            fileUrl,
            fileName: input.file.name,
            fileSize: input.file.size,
            mimeType: input.file.type,
            capturedAt: input.capturedAt,
            capturedBy: input.capturedBy,
            capturedByName: input.capturedByName,
            latitude: input.latitude,
            longitude: input.longitude,
            locationAccuracy: input.locationAccuracy,
            isVerified: false,
            description: input.description,
            tags: input.tags,
            createdAt: new Date().toISOString(),
        }

        const { error: insertError } = await client
            .from('progress_evidence')
            .insert({
                id: evidence.id,
                progress_update_id: evidence.progressUpdateId,
                task_id: evidence.taskId,
                evidence_type: evidence.evidenceType,
                file_url: evidence.fileUrl,
                file_name: evidence.fileName,
                file_size: evidence.fileSize,
                mime_type: evidence.mimeType,
                captured_at: evidence.capturedAt,
                captured_by: evidence.capturedBy,
                captured_by_name: evidence.capturedByName,
                latitude: evidence.latitude,
                longitude: evidence.longitude,
                location_accuracy: evidence.locationAccuracy,
                is_verified: evidence.isVerified,
                description: evidence.description,
                tags: evidence.tags,
            })

        if (insertError) {
            console.warn('Evidence metadata save failed:', insertError.message)
        }

        return evidence
    },

    /**
     * Get evidence for a progress update
     */
    async getEvidenceForUpdate(progressUpdateId: string): Promise<ProgressEvidence[]> {
        const client = assertSupabase()
        const { data, error } = await client
            .from('progress_evidence')
            .select('*')
            .eq('progress_update_id', progressUpdateId)
            .order('captured_at', { ascending: false })

        if (error || !data) return []

        type EvidenceDbRow = { id: string; progress_update_id?: string; task_id?: string; evidence_type?: string; file_url?: string; file_name?: string; file_size?: number; mime_type?: string; captured_at?: string; captured_by?: string; captured_by_name?: string; latitude?: number; longitude?: number; location_accuracy?: number; location_name?: string; device_info?: string; app_version?: string; is_verified?: boolean; verified_by?: string; verified_at?: string; description?: string; tags?: string[]; created_at?: string }
        return data.map((row: EvidenceDbRow) => ({
            id: row.id,
            progressUpdateId: row.progress_update_id || '',
            taskId: row.task_id || '',
            evidenceType: (row.evidence_type || 'PHOTO') as import('../types/progressEvidence').ProgressEvidence['evidenceType'],
            fileUrl: row.file_url || '',
            fileName: row.file_name || '',
            fileSize: row.file_size ?? 0,
            mimeType: row.mime_type || '',
            capturedAt: row.captured_at || '',
            capturedBy: row.captured_by || '',
            capturedByName: row.captured_by_name || '',
            latitude: row.latitude,
            longitude: row.longitude,
            locationAccuracy: row.location_accuracy,
            locationName: row.location_name,
            deviceInfo: row.device_info,
            appVersion: row.app_version,
            isVerified: row.is_verified ?? false,
            verifiedBy: row.verified_by,
            verifiedAt: row.verified_at,
            description: row.description,
            tags: row.tags,
            createdAt: row.created_at || '',
        }))
    },

    /**
     * Check if progress update can be submitted (has sufficient evidence)
     */
    async canSubmitProgress(
        taskId: string,
        progressUpdateId: string,
        projectId?: string,
    ): Promise<{ allowed: boolean; validation: EvidenceValidationResult }> {
        // Get evidence requirements
        const requirement = await this.getTaskEvidenceRequirements(taskId)

        // No requirements = always allowed
        if (!requirement) {
            return {
                allowed: true,
                validation: {
                    isValid: true,
                    missingEvidence: [],
                    warnings: [],
                    errors: [],
                    photoCount: 0,
                    photoRequired: 0,
                    hasVideo: false,
                    videoRequired: false,
                    hasLocation: false,
                    locationRequired: false,
                    hasTimestamp: false,
                    timestampValid: true,
                    hasSignature: false,
                    signatureRequired: false,
                    signaturesMissing: [],
                },
            }
        }

        // Get uploaded evidence
        const evidence = await this.getEvidenceForUpdate(progressUpdateId)

        // Get site coordinates if needed
        let siteCoords: GpsCoords | null = null
        if (projectId && requirement.locationRequired && requirement.locationMaxDistance) {
            siteCoords = await this.getProjectSiteCoords(projectId)
        }

        // Validate
        const validation = this.validateEvidence(evidence, requirement, siteCoords)

        return {
            allowed: validation.isValid,
            validation,
        }
    },

    /**
     * Get current GPS position from browser Geolocation API.
     * Returns a promise that resolves with coordinates or null.
     */
    getCurrentPosition(): Promise<GpsCoords | null> {
        return new Promise((resolve) => {
            if (!navigator.geolocation) {
                resolve(null)
                return
            }

            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    resolve({
                        latitude: pos.coords.latitude,
                        longitude: pos.coords.longitude,
                    })
                },
                () => {
                    resolve(null)
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 60000,
                },
            )
        })
    },

    /**
     * Approve a progress log QC status
     */
    async approveProgressLog(progressId: string, verifiedBy: string): Promise<boolean> {
        const client = assertSupabase()
        const { error } = await client
            .from('progress_logs')
            .update({ qc_status: 'approved', updated_at: new Date().toISOString() })
            .eq('id', progressId)

        if (error) {
            console.error('[Progress QC] Approve failed:', error)
            return false
        }

        // Also verify the evidence rows
        await client
            .from('progress_evidence')
            .update({
                is_verified: true,
                verified_by: verifiedBy,
                verified_at: new Date().toISOString()
            })
            .eq('progress_update_id', progressId)

        return true
    },

    /**
     * Reject a progress log QC status
     */
    async rejectProgressLog(progressId: string, reason: string): Promise<boolean> {
        const client = assertSupabase()
        const { error } = await client
            .from('progress_logs')
            .update({
                qc_status: 'rejected',
                notes: reason, // Append or overwrite notes with rejection reason
                updated_at: new Date().toISOString()
            })
            .eq('id', progressId)

        if (error) {
            console.error('[Progress QC] Reject failed:', error)
            return false
        }
        return true
    },
}