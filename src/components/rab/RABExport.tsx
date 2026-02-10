/**
 * src/components/rab/RABExport.tsx
 *
 * RAB export component — currently a placeholder.
 * Provides export functionality for RAB data.
 */

import React from 'react'
import { Button } from '../ui/button'
import { Download } from 'lucide-react'

interface RABExportProps {
  projectId?: string
  tableRef?: React.RefObject<HTMLDivElement | null>
}

export default function RABExport({ projectId, tableRef }: RABExportProps) {
  const handleExport = () => {
    // Placeholder export logic
    alert('RAB export not yet implemented')
  }

  return (
    <Button size="sm" variant="outline" onClick={handleExport}>
      <Download className="h-4 w-4 mr-1" />
      Export RAB
    </Button>
  )
}
