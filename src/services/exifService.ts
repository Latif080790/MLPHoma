import EXIF from 'exif-js'

export interface PhotoMetadata {
    lat?: number
    lon?: number
    timestamp?: Date
}

export const exifService = {
    /**
     * Extracts GPS and Timestamp from a photo file.
     */
    async extractMetadata(file: File): Promise<PhotoMetadata> {
        return new Promise((resolve) => {
            // Using a hack for type since exif-js has legacy types
            EXIF.getData(file as any, function (this: any) {
                const lat = EXIF.getTag(this, "GPSLatitude")
                const lon = EXIF.getTag(this, "GPSLongitude")
                const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N"
                const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E"
                const dateStr = EXIF.getTag(this, "DateTimeOriginal")

                let decimalLat: number | undefined
                let decimalLon: number | undefined

                if (lat && lon && Array.isArray(lat) && Array.isArray(lon) && lat.length >= 3 && lon.length >= 3) {
                    // Convert DM S to Decimal with safety checks
                    const latD = Number(lat[0]) || 0
                    const latM = Number(lat[1]) || 0
                    const latS = Number(lat[2]) || 0
                    decimalLat = latD + latM / 60 + latS / 3600
                    if (latRef === "S") decimalLat = -decimalLat

                    const lonD = Number(lon[0]) || 0
                    const lonM = Number(lon[1]) || 0
                    const lonS = Number(lon[2]) || 0
                    decimalLon = lonD + lonM / 60 + lonS / 3600
                    if (lonRef === "W") decimalLon = -decimalLon
                }

                let timestamp: Date | undefined
                if (dateStr && typeof dateStr === 'string') {
                    // EXIF date format is YYYY:MM:DD HH:MM:SS
                    const normalized = dateStr.replace(/^(\d{4}):(\d{2}):(\d{2})/, "$1-$2-$3")
                    timestamp = new Date(normalized)
                }

                resolve({
                    lat: decimalLat,
                    lon: decimalLon,
                    timestamp
                })
            })
        })
    }
}
