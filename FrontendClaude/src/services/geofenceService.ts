/**
 * geofenceService.ts
 * Provides location validation using Haversine formula.
 */
import { assertSupabase } from '../lib/supabaseClient'

export interface Coordinates {
    lat: number
    lon: number
}

export const geofenceService = {
    /**
     * Calculate distance between two coordinates in meters.
     */
    calculateDistance(p1: Coordinates, p2: Coordinates): number {
        const R = 6371e3 // Earth radius in meters
        const φ1 = (p1.lat * Math.PI) / 180
        const φ2 = (p2.lat * Math.PI) / 180
        const Δφ = ((p2.lat - p1.lat) * Math.PI) / 180
        const Δλ = ((p2.lon - p1.lon) * Math.PI) / 180

        const a =
            Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2)
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

        return R * c
    },

    /**
     * Verify if user is within project bounds (default 500m).
     */
    async isWithinProjectBounds(projectId: string, userCoords: Coordinates, radius = 500): Promise<{
        inside: boolean
        distance: number
        error?: string
    }> {
        const supabase = assertSupabase()
        const { data: project, error } = await supabase
            .from('projects')
            .select('latitude, longitude')
            .eq('id', projectId)
            .single()

        if (error) return { inside: false, distance: 0, error: 'Project location not found' }
        if (!project.latitude || !project.longitude) {
            return { inside: true, distance: 0, error: 'Project geofence not configured' }
        }

        const projectCoords = {
            lat: Number(project.latitude),
            lon: Number(project.longitude)
        }

        const dist = this.calculateDistance(userCoords, projectCoords)
        
        return {
            inside: dist <= radius,
            distance: dist
        }
    }
}
