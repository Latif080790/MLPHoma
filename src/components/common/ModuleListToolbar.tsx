import React, { useEffect, useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

export interface ToolbarOption {
  value: string
  label: string
}

interface ModuleListToolbarProps {
  query: string
  onQueryChange: (value: string) => void
  debounceMs?: number
  queryPlaceholder?: string
  resultCount?: number
  resultLabel?: string
  filterValue?: string
  onFilterChange?: (value: string) => void
  filterOptions?: ToolbarOption[]
  filterPlaceholder?: string
  sortValue?: string
  onSortChange?: (value: string) => void
  sortOptions?: ToolbarOption[]
  sortPlaceholder?: string
  className?: string
}

export function ModuleListToolbar({
  query,
  onQueryChange,
  debounceMs = 300,
  queryPlaceholder = 'Search...',
  resultCount,
  resultLabel = 'results',
  filterValue,
  onFilterChange,
  filterOptions,
  filterPlaceholder = 'Filter',
  sortValue,
  onSortChange,
  sortOptions,
  sortPlaceholder = 'Sort',
  className,
}: ModuleListToolbarProps) {
  const [localQuery, setLocalQuery] = useState(query)

  useEffect(() => {
    setLocalQuery(query)
  }, [query])

  useEffect(() => {
    if (debounceMs <= 0) {
      if (localQuery !== query) onQueryChange(localQuery)
      return
    }

    const timer = window.setTimeout(() => {
      if (localQuery !== query) {
        onQueryChange(localQuery)
      }
    }, debounceMs)

    return () => window.clearTimeout(timer)
  }, [localQuery, query, onQueryChange, debounceMs])

  const searchAriaLabel = useMemo(() => {
    const trimmed = queryPlaceholder.trim()
    return trimmed.length > 0 ? trimmed : 'Search list'
  }, [queryPlaceholder])

  return (
    <div className={cn('flex flex-col gap-3 md:flex-row md:items-center md:justify-between', className)}>
      <div className="relative w-full md:max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          value={localQuery}
          onChange={(e) => setLocalQuery(e.target.value)}
          placeholder={queryPlaceholder}
          aria-label={searchAriaLabel}
          className="h-9 pl-9"
        />
      </div>

      <div className="flex w-full items-center gap-2 md:w-auto">
        {filterOptions && onFilterChange && filterValue !== undefined && (
          <Select value={filterValue} onValueChange={onFilterChange}>
            <SelectTrigger className="h-9 w-[160px]" aria-label={filterPlaceholder}>
              <SelectValue placeholder={filterPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {filterOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {sortOptions && onSortChange && sortValue !== undefined && (
          <Select value={sortValue} onValueChange={onSortChange}>
            <SelectTrigger className="h-9 w-[170px]" aria-label={sortPlaceholder}>
              <SelectValue placeholder={sortPlaceholder} />
            </SelectTrigger>
            <SelectContent>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {typeof resultCount === 'number' && (
          <span className="ml-auto text-xs text-muted-foreground md:ml-1" role="status" aria-live="polite">
            {resultCount} {resultLabel}
          </span>
        )}
      </div>
    </div>
  )
}

export default ModuleListToolbar
