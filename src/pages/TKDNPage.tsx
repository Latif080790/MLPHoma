import React from 'react'
import { TKDNResourceManager } from '../components/tkdn/TKDNResourceManager'

/**
 * TKDNPage — TKDN (Tingkat Komponen Dalam Negeri) management page.
 */
export default function TKDNPage() {
    return (
        <div className="container mx-auto p-6">
            <TKDNResourceManager />
        </div>
    )
}
