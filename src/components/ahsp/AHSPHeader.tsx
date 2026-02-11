import React from 'react'
import { ModuleHeader } from '@/components/modules/ModuleHeader'
import { Calculator } from 'lucide-react'

export function AHSPHeader() {
    return (
        <ModuleHeader
            icon={<Calculator size={18} />}
            title="AHSP - Analisis Harga Satuan Pekerjaan"
            description="Work analysis with component breakdown, resource management (DKH), and auto-calculation"
        />
    )
}
