import React from 'react'
import { TKDNResourceManager } from '../components/tkdn/TKDNResourceManager'

/**
 * TKDNPage — stub page.
 * Placeholder to satisfy existing branch references.
 */
export default function TKDNPage() {
    return (
        <div className="container mx-auto p-6 space-y-6">
            <h1 className="text-2xl font-bold">TKDN Management</h1>
            <TKDNResourceManager />
        </div>
    )
}
