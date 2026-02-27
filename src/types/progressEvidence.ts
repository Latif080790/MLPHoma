/**
 * progressEvidence.ts
 * Type definitions for progress evidence requirements.
 * Enforces photo/timestamp/location capture for quality control.
 */

/**
 * Evidence requirement level
 */
export type EvidenceLevel = 'NONE' | 'OPTIONAL' | 'REQUIRED'

/**
 * Evidence type
 */
export type EvidenceType = 'PHOTO' | 'VIDEO' | 'DOCUMENT' | 'SIGNATURE'

/**
 * Progress evidence metadata
 */
export interface ProgressEvidence {
    id: string
    progressUpdateId: string
    taskId: string
    
    // Evidence data
    evidenceType: EvidenceType
    fileUrl: string
    fileName: string
    fileSize: number
    mimeType: string
    
    // Capture metadata
    capturedAt: string
    capturedBy: string
    capturedByName: string
    
    // Location data
    latitude?: number
    longitude?: number
    locationAccuracy?: number // meters
    locationName?: string // Reverse geocoded address
    
    // Device metadata
    deviceInfo?: string // e.g., "iPhone 14 Pro"
    appVersion?: string
    
    // Verification
    isVerified: boolean
    verifiedBy?: string
    verifiedAt?: string
    
    // Notes
    description?: string
    tags?: string[]
    
    createdAt: string
}

/**
 * Evidence requirement configuration
 */
export interface EvidenceRequirement {
    taskId: string
    taskName: string
    
    // Evidence rules
    photoRequired: boolean
    photoMinCount: number // Minimum number of photos required
    
    videoRequired: boolean
    
    signatureRequired: boolean
    signatureRoles?: string[] // Roles that must sign (e.g., ['PM', 'QC'])
    
    locationRequired: boolean
    locationMaxDistance?: number // Maximum distance from site coordinates (meters)
    
    timestampRequired: boolean
    timestampWindow?: { start: string; end: string } // Allowed time window
    
    // Custom checklist
    checklistItems?: string[]
    
    // Compliance notes
    complianceNotes?: string
}

/**
 * Evidence validation result
 */
export interface EvidenceValidationResult {
    isValid: boolean
    missingEvidence: string[]
    warnings: string[]
    errors: string[]
    
    photoCount: number
    photoRequired: number
    
    hasVideo: boolean
    videoRequired: boolean
    
    hasLocation: boolean
    locationRequired: boolean
    
    hasTimestamp: boolean
    timestampValid: boolean
    
    hasSignature: boolean
    signatureRequired: boolean
    signaturesMissing: string[]
}

/**
 * Progress update with evidence
 */
export interface ProgressUpdateWithEvidence {
    updateId: string
    taskId: string
    taskName: string
    
    currentProgress: number
    newProgress: number
    
    evidence: ProgressEvidence[]
    
    submittedBy: string
    submittedByName: string
    submittedAt: string
    
    validationResult: EvidenceValidationResult
    
    status: 'PENDING_EVIDENCE' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED'
    
    reviewedBy?: string
    reviewedAt?: string
    reviewNotes?: string
}

/**
 * Minimal evidence snapshot attached to timeline task progress updates.
 * Used for client-side gating in Timeline module.
 */
export interface TimelineProgressEvidence {
    photoUrl: string
    capturedAt: string
    latitude: number
    longitude: number
    hasPhoto: boolean
    hasTimestamp: boolean
    hasLocation: boolean
}

/**
 * Returns true when timeline evidence snapshot satisfies minimum requirements.
 */
export function isTimelineProgressEvidenceComplete(
    evidence?: Partial<TimelineProgressEvidence> | null,
): evidence is TimelineProgressEvidence {
    if (!evidence) return false

    const hasPhoto = typeof evidence.photoUrl === 'string' && evidence.photoUrl.trim().length > 0
    const hasTimestamp = typeof evidence.capturedAt === 'string' && evidence.capturedAt.trim().length > 0
    const hasLocation = typeof evidence.latitude === 'number' && typeof evidence.longitude === 'number'

    return (
        hasPhoto &&
        hasTimestamp &&
        hasLocation &&
        evidence.hasPhoto === true &&
        evidence.hasTimestamp === true &&
        evidence.hasLocation === true
    )
}

/**
 * Evidence upload input
 */
export interface UploadEvidenceInput {
    progressUpdateId: string
    taskId: string
    evidenceType: EvidenceType
    
    file: File
    
    // Capture metadata
    capturedAt: string
    capturedBy: string
    capturedByName: string
    
    // Location (if available)
    latitude?: number
    longitude?: number
    locationAccuracy?: number
    
    // Optional fields
    description?: string
    tags?: string[]
}

/**
 * Evidence requirement preset
 */
export interface EvidencePreset {
    name: string
    description: string
    config: Omit<EvidenceRequirement, 'taskId' | 'taskName'>
}

/**
 * Common evidence presets
 */
export const EVIDENCE_PRESETS: EvidencePreset[] = [
    {
        name: 'Standard Construction',
        description: 'Photo + location for typical construction tasks',
        config: {
            photoRequired: true,
            photoMinCount: 2,
            videoRequired: false,
            signatureRequired: false,
            locationRequired: true,
            timestampRequired: true,
        }
    },
    {
        name: 'Quality Critical',
        description: 'Full evidence with QC signature',
        config: {
            photoRequired: true,
            photoMinCount: 3,
            videoRequired: true,
            signatureRequired: true,
            signatureRoles: ['PM', 'QC'],
            locationRequired: true,
            timestampRequired: true,
        }
    },
    {
        name: 'Minimal',
        description: 'Photo only, no strict requirements',
        config: {
            photoRequired: true,
            photoMinCount: 1,
            videoRequired: false,
            signatureRequired: false,
            locationRequired: false,
            timestampRequired: false,
        }
    },
    {
        name: 'Administrative',
        description: 'No physical evidence required',
        config: {
            photoRequired: false,
            photoMinCount: 0,
            videoRequired: false,
            signatureRequired: false,
            locationRequired: false,
            timestampRequired: false,
        }
    },
]
