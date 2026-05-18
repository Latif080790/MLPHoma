import React from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { ReportTemplate } from '@/types/report'

interface ReportTemplateListProps {
  templates: ReportTemplate[]
  activeId?: string
  loading?: boolean
  onSelect: (id: string) => void
  onCreate: () => void
}

export function ReportTemplateList({
  templates,
  activeId,
  loading,
  onSelect,
  onCreate,
}: ReportTemplateListProps) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Templates</CardTitle>
          <Button size="sm" onClick={onCreate}>New</Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading ? <p className="text-xs text-muted-foreground">Loading templates...</p> : null}
        {!loading && templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">No templates available.</p>
        ) : null}

        {templates.map((template) => (
          <button
            key={template.id}
            type="button"
            onClick={() => onSelect(template.id)}
            className={`w-full rounded border px-3 py-2 text-left text-xs transition ${
              activeId === template.id
                ? 'border-primary bg-primary/5'
                : 'border-border hover:bg-muted/40'
            }`}
          >
            <p className="font-medium text-foreground">{template.name}</p>
            <p className="text-muted-foreground">{template.dataset}</p>
          </button>
        ))}
      </CardContent>
    </Card>
  )
}
