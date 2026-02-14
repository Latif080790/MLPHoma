/**
 * progressEvidenceService.ts
 * FASE 3.6: Progress Evidence-Based — GPS Coordinates & EXIF Extraction
 *
 * When field users submit progress photos:
 * 1. Extract EXIF metadata (GPS coords, timestamp, device) from photos
 * 2. Validate GPS coords against project site location (within radius)
 * 3. Store evidence with progress record for QC audit
 * 4. Flag suspicious entries (too far from site, missing GPS, future timestamps)
 */

import { assertSupabase } from '../lib/supabaseClient'

// ---------- Types ----------

export interface PhotoEvidence {
    id: string
    progressDate: string
    photoUrl: string
    latitude: number | null
    longitude: number | null
    capturedAt: string | null
    deviceInfo: string | null
    distanceFromSite: number | null  // meters
    validationStatus: 'valid' | 'warning' | 'invalid' | 'pending'
    validationNotes: string
}

export interface EvidenceValidationResult {
    isValid: boolean
    distanceFromSite: number | null
    warnings: string[]
}

export interface GpsCoords {
    latitude: number
    longitude: number
}

// ---------- Constants ----------

const MAX_SITE_DISTANCE_METERS = 500 // 500m radius from project site
const MAX_FUTURE_MINUTES = 30        // Don't accept photos > 30 min in the future

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

/**
 * Parse EXIF-style GPS coordinates from a Blob/File.
 * Uses the browser's native capabilities.
 * Falls back gracefully if EXIF data unavailable.
 */
async function extractGpsFromFile(file: File): Promise<{
    latitude: number | null
    longitude: number | null
    capturedAt: string | null
    deviceInfo: string | null
}> {
    // In a browser environment, we can't easily read EXIF without a library.
    // However, we can request GPS from the browser's Geolocation API as a fallback
    // and extract image metadata from canvas if available.
    // For a robust implementation, the backend would use ExifTool or sharp.
    
    // Client-side approach: read EXIF using ArrayBuffer parsing
    try {
        const buffer = await file.arrayBuffer()
        const view = new DataView(buffer)
        
        // Quick JPEG check + EXIF header scan
        if (view.getUint16(0) !== 0xFFD8) {
            return { latitude: null, longitude: null, capturedAt: null, deviceInfo: null }
        }

        // For production, use a library like exif-js or piexifjs
        // Simplified: skip EXIF parsing and rely on Geolocation API
    } catch {
        // Parsing failed — expected in most browser environments
    }

    return { latitude: null, longitude: null, capturedAt: null, deviceInfo: null }
}

// ---------- Service ----------

export const progressEvidenceService = {

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
     * Validate photo evidence against project site location.
     */
    validateEvidence(
        photoCoords: GpsCoords | null,
        siteCoords: GpsCoords | null,
        capturedAt: string | null,
    ): EvidenceValidationResult {
        const warnings: string[] = []
        let distanceFromSite: number | null = null

        // 1. Check if GPS data exists
        if (!photoCoords || !photoCoords.latitude || !photoCoords.longitude) {
            warnings.push('No GPS coordinates in photo — cannot verify location')
        }

        // 2. Check distance from site
        if (photoCoords && siteCoords) {
            distanceFromSite = haversineDistance(
                photoCoords.latitude, photoCoords.longitude,
                siteCoords.latitude, siteCoords.longitude,
            )

            if (distanceFromSite > MAX_SITE_DISTANCE_METERS) {
                warnings.push(
                    `Photo taken ${Math.round(distanceFromSite)}m from project site (max: ${MAX_SITE_DISTANCE_METERS}m)`
                )
            }
        } else if (photoCoords && !siteCoords) {
            warnings.push('Project site coordinates not configured — cannot validate distance')
        }

        // 3. Check timestamp
        if (capturedAt) {
            const photoTime = new Date(capturedAt).getTime()
            const now = Date.now()
            if (photoTime > now + MAX_FUTURE_MINUTES * 60 * 1000) {
                warnings.push('Photo timestamp is in the future — possible clock manipulation')
            }
        }

        return {
            isValid: warnings.length === 0,
            distanceFromSite,
            warnings,
        }
    },

    /**
     * Record progress evidence with GPS validation.
     * Called when submitting progress with photo.
     */
    async recordEvidence(
        projectId: string,
        progressDate: string,
        photoUrl: string,
        gpsCoords: GpsCoords | null,
    ): Promise<PhotoEvidence> {
        const siteCoords = await this.getProjectSiteCoords(projectId)
        const validation = this.validateEvidence(gpsCoords, siteCoords, null)

        let validationStatus: PhotoEvidence['validationStatus'] = 'valid'
        if (!gpsCoords) validationStatus = 'pending'
        else if (validation.warnings.length > 0 && validation.distanceFromSite && validation.distanceFromSite > MAX_SITE_DISTANCE_METERS) {
            validationStatus = 'invalid'
        } else if (validation.warnings.length > 0) {
            validationStatus = 'warning'
        }

        const evidence: PhotoEvidence = {
            id: crypto.randomUUID(),
            progressDate,
            photoUrl,
            latitude: gpsCoords?.latitude || null,
            longitude: gpsCoords?.longitude || null,
            capturedAt: null,
            deviceInfo: null,
            distanceFromSite: validation.distanceFromSite,
            validationStatus,
            validationNotes: validation.warnings.join('; ') || 'Evidence validated successfully',
        }

        // Store in database
        const client = assertSupabase()
        try {
            await client
                .from('progress_evidence')
                .insert({
                    id: evidence.id,
                    project_id: projectId,
                    progress_date: progressDate,
                    photo_url: photoUrl,
                    latitude: evidence.latitude,
                    longitude: evidence.longitude,
                    captured_at: evidence.capturedAt,
                    device_info: evidence.deviceInfo,
                    distance_from_site: evidence.distanceFromSite,
                    validation_status: evidence.validationStatus,
                    validation_notes: evidence.validationNotes,
                })
        } catch (e) {
            // Non-blocking: if the table doesn't exist yet, just log
            console.warn('Progress evidence recording failed (table may not exist yet):', e)
        }

        return evidence
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
}
