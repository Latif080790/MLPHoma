import React, { useState, useMemo } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Checkbox } from '../ui/checkbox'
import { ScrollArea } from '../ui/scroll-area'
import { Search } from 'lucide-react'
import { Input } from '../ui/input'
import { useWBSStore } from '../../store/wbsStore'
import { useTimelineStore } from '../../store/timelineStore'
import type { WBSItem } from '../../types/wbs'

interface WBSImportDialogProps {
  projectId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function WBSImportDialog({ projectId, open, onOpenChange }: WBSImportDialogProps) {
  const { itemsByProject } = useWBSStore()
  const { addTask, getTasks } = useTimelineStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const wbsItems = itemsByProject[projectId] || []
  const existingTasks = getTasks(projectId) || []
  
  // Filter out WBS items that already have linked tasks
  // This is a heuristic: check if any task has this wbsId
  const linkedWbsIds = new Set(existingTasks.map(t => t.wbsId).filter(Boolean))

  const availableItems = useMemo(() => {
    return wbsItems.filter(item => !linkedWbsIds.has(item.id))
  }, [wbsItems, linkedWbsIds])

  const filteredItems = useMemo(() => {
    if (!searchQuery) return availableItems
    const q = searchQuery.toLowerCase()
    return availableItems.filter(
      item => 
        item.name.toLowerCase().includes(q) || 
        item.code.toLowerCase().includes(q)
    )
  }, [availableItems, searchQuery])

  const handleToggle = (id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedIds(next)
  }

  const handleSelectAll = () => {
    if (selectedIds.size === filteredItems.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(filteredItems.map(i => i.id)))
    }
  }

  const handleImport = () => {
    const itemsToImport = wbsItems.filter(item => selectedIds.has(item.id))
    
    itemsToImport.forEach(item => {
      addTask(projectId, {
        name: item.name,
        description: `Imported from WBS: ${item.code}`,
        startDate: new Date().toISOString().split('T')[0],
        duration: 1,
        progress: 0,
        status: 'not_started',
        priority: 'medium',
        wbsId: item.id,
      })
    })

    onOpenChange(false)
    setSelectedIds(new Set())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Tasks from WBS</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-neutral-500" />
            <Input
              placeholder="Search WBS items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="flex items-center justify-between text-sm text-neutral-500">
            <span>{filteredItems.length} items available</span>
            <Button variant="ghost" size="sm" onClick={handleSelectAll}>
              {selectedIds.size === filteredItems.length ? 'Deselect All' : 'Select All'}
            </Button>
          </div>

          <ScrollArea className="h-[400px] rounded-md border p-4">
            <div className="space-y-2">
              {filteredItems.length === 0 ? (
                <div className="text-center text-neutral-500 py-8">
                  No unlinked WBS items found.
                </div>
              ) : (
                filteredItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center space-x-2 rounded-lg border p-3 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Checkbox
                      id={item.id}
                      checked={selectedIds.has(item.id)}
                      onCheckedChange={() => handleToggle(item.id)}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <label
                        htmlFor={item.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        <span className="font-mono text-xs text-neutral-500 mr-2">
                          {item.code}
                        </span>
                        {item.name}
                      </label>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleImport} disabled={selectedIds.size === 0}>
            Import {selectedIds.size} Tasks
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
