/**
 * geofenceService.ts
 *
 * Provides utility functions to check if a user's current GPS location
 * falls within the designated geofence radius of a project.
 * Important for Field Accuracy (Pilar 3) when submitting daily progress.
 */

import { toast } from 'sonner'
import { auditService } from './auditService'

export interface Coordinates {
    lat: number
    lng: number
}

// Default to NATA LABA HQ or a typical project center for mock validation
const MOCK_PROJECT_CENTER: Coordinates = {
    // Monas, Jakarta for testing purposes
    lat: -6.1753924,
    lng: 106.8271528
}

const DEFAULT_RADIUS_METERS = 500

export const geofenceService = {
    /**
     * Calculates the great-circle distance between two points on the Earth's surface
     * using the Haversine formula.
     * @returns Distance in meters
     */
    calculateDistance(point1: Coordinates, point2: Coordinates): number {
        const R = 6371e3; // Earth's radius in meters
        const φ1 = point1.lat * Math.PI / 180; // lat in radians
        const φ2 = point2.lat * Math.PI / 180;
        const Δφ = (point2.lat - point1.lat) * Math.PI / 180;
        const Δλ = (point2.lng - point1.lng) * Math.PI / 180;

        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

        return R * c;
    },

    /**
     * Checks if given coordinates are within the project's allowed radius
     */
    isWithinGeofence(
        userLocation: Coordinates,
        projectCenter: Coordinates = MOCK_PROJECT_CENTER,
        allowedRadius: number = DEFAULT_RADIUS_METERS
    ): { valid: boolean, distance: number } {
        const distance = this.calculateDistance(userLocation, projectCenter)
        return {
            valid: distance <= allowedRadius,
            distance: Math.round(distance)
        }
    },

    /**
     * Prompts the browser for current GPS location.
     * Returns a promise that resolves with the coordinates.
     */
    getCurrentLocation(): Promise<Coordinates> {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error("Geolocation is not supported by your browser"))
                return
            }

            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    })
                },
                (error) => {
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            reject(new Error("Location permission denied. Please allow access to submit progress."))
                            break
                        case error.POSITION_UNAVAILABLE:
                            reject(new Error("Location information is unavailable."))
                            break
                        case error.TIMEOUT:
                            reject(new Error("Location request timed out."))
                            break
                        default:
                            reject(new Error("An unknown error occurred while requesting location."))
                            break
                    }
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            )
        })
    },

    /**
     * All-in-one execution: gets location, validates, and logs audit
     */
    async validateSubmission(projectId: string, userName: string): Promise<Coordinates> {
        toast.info("Acquiring GPS Signal...", { id: 'gps-toast' })

        try {
            const userLoc = await this.getCurrentLocation()
            const { valid, distance } = this.isWithinGeofence(userLoc)

            if (!valid) {
                toast.error(`Geofence Error: You are ${distance}m away. Must be within ${DEFAULT_RADIUS_METERS}m of site.`, { id: 'gps-toast', duration: 5000 })

                // Log failed attempt for security audit
                auditService.log({
                    action: 'UPDATE', // Using UPDATE or CREATE depending on context, keeping simple
                    entity: 'progress_geofence',
                    entityType: 'PROGRESS',
                    entityId: projectId,
                    details: { event: 'GEOFENCE_FAILED', distance, lat: userLoc.lat, lng: userLoc.lng },
                    userName
                })

                throw new Error("GEOFENCE_VIOLATION")
            }

            toast.success(`Location Validated (${distance}m from center)`, { id: 'gps-toast' })
            return userLoc

        } catch (err: unknown) {
            const e = err as Error
            if (e.message !== "GEOFENCE_VIOLATION") {
                toast.error(e.message, { id: 'gps-toast' })
            }
            throw err;
        }
    }
}
