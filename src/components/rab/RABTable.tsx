import React, { useState, useMemo, useEffect } from 'react'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from '../ui/table'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Trash2, Plus, Search, ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '../ui/badge'
import { useRabStore, RABItem, calculatePareto } from '../../store/rabStore'
import { formatIDR } from '../../lib/utils'
import { useAHSPStore } from '../../store/ahspStore'
import { SAMPLE_AHSP_ITEMS, SAMPLE_RESOURCES } from '../../lib/sampleData/ahspSample'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog'

import { useTimelineStore } from '../../store/timelineStore'
import { generateScheduleFromRAB } from '../../lib/autoScheduler'
import { CalendarClock } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select'

import { useWBSStore } from '../../store/wbsStore'

interface RABTableProps {
  projectId: string
}

export function RABTable({ projectId }: RABTableProps) {
  const {
    ahspItems,
    searchAHSPItems,
    importAHSPItems,
    importResources,
    resources,
    componentsByAHSP,
    zonePricesByZone,
    fetchZonePrices
  } = useAHSPStore()

  const { getItems, addItem, updateItem, removeItem } = useRabStore()
  const items = getItems(projectId)

  // Get tasks for linking
  const { getTasks, setTasks } = useTimelineStore()
  const tasks = getTasks(projectId)

  // Get Project for Zone Info
  const project = useProjectStore(s => s.projects[projectId])

  // WBS Store
  const { importWBS } = useWBSStore()

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showDetails, setShowDetails] = useState(false)

  // Seed AHSP store with sample data if empty
  useEffect(() => {
    if (ahspItems.length === 0 && resources.length === 0) {
      importResources(SAMPLE_RESOURCES as any)
      importAHSPItems(SAMPLE_AHSP_ITEMS as any)
      // toast.info('Loaded sample AHSP data')
    }
  }, [ahspItems.length, resources.length, importResources, importAHSPItems])

  // Fetch Zone Prices if needed
  useEffect(() => {
    if (project?.zoneId) {
      fetchZonePrices(project.zoneId)
    }
  }, [project?.zoneId])

  const filteredAHSP = useMemo(() => {
    const baseItems = searchQuery ? searchAHSPItems(searchQuery) : ahspItems

    if (!project?.zoneId) return baseItems

    const zonePrices = zonePricesByZone[project.zoneId] || []
    const priceMap = new Map(zonePrices.map(p => [p.ahspId, p]))

    return baseItems.map(item => {
      const override = priceMap.get(item.id)
      if (override) {
        return {
          ...item,
          price_material: override.price_material,
          price_labor: override.price_labor,
          price_equipment: override.price_equipment,
          price_subcon: override.price_subcon,
          finalPrice: override.finalPrice,
          basePrice: (override.price_material + override.price_labor + override.price_equipment + override.price_subcon)
        }
      }
      return item
    })
  }, [searchQuery, ahspItems, project?.zoneId, zonePricesByZone, searchAHSPItems])

  const handleVolumeChange = (id: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    const item = items.find(i => i.id === id)
    const price = item?.unit_price || 0
    updateItem(projectId, id, {
      volume: num,
      finalTotal: num * price,
      final_total: num * price,
      finalPrice: num * price
    })
  }

  const handlePriceChange = (id: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    const item = items.find(i => i.id === id)
    const vol = item?.volume || 0
    updateItem(projectId, id, {
      unit_price: num,
      finalTotal: vol * num,
      final_total: vol * num,
      finalPrice: vol * num
    })
  }

  const handleSplitCostChange = (id: string, field: keyof RABItem, val: string) => {
    const num = parseFloat(val) || 0
    const item = items.find(i => i.id === id)
    if (!item) return

    const updates: any = { [field]: num }

    // Recalculate unit_price
    const mat = field === 'cost_material' ? num : (item.cost_material || 0)
    const lab = field === 'cost_labor' ? num : (item.cost_labor || 0)
    const eqp = field === 'cost_equipment' ? num : (item.cost_equipment || 0)
    const sub = field === 'cost_subcon' ? num : (item.cost_subcon || 0)

    const newUnitPrice = mat + lab + eqp + sub
    const vol = item.volume || 0

    updates.unit_price = newUnitPrice
    updates.finalTotal = vol * newUnitPrice
    updates.final_total = vol * newUnitPrice
    updates.finalPrice = vol * newUnitPrice

    updateItem(projectId, id, updates)
  }

  const handleAddFromAhsp = (ahspItem: any) => {
    // Determine split costs from AHSP if available (requires mapping or store support)
    // For now, mapping from typical AHSP naming if present
    const price = ahspItem.finalPrice || ahspItem.basePrice || 0

    addItem(projectId, {
      item_code: ahspItem.code,
      name: ahspItem.name,
      unit: ahspItem.unit,
      unit_price: price,
      volume: 1,
      finalTotal: price * 1,
      cost_material: ahspItem.price_material || 0,
      cost_labor: ahspItem.price_labor || 0,
      cost_equipment: ahspItem.price_equipment || 0,
      cost_subcon: ahspItem.price_subcon || 0
    })

    setIsAddDialogOpen(false)
    toast.success(project?.zoneId ? 'Item added with Zone Price' : 'Item added from AHSP')
  }

  const handleAutoSchedule = () => {
    if (items.length === 0) {
      toast.error('No items in RAB to schedule')
      return
    }

    if (window.confirm('This will overwrite your current Timeline and WBS with an auto-generated structure based on RAB items. Continue?')) {
      // Index AHSP items
      const ahspMap = new Map(ahspItems.map(i => [i.code, i]))

      // 1. Generate WBS Structure
      const wbsItems: any[] = []
      const categories = Array.from(new Set(items.map(i => {
        const ahsp = ahspMap.get(i.item_code || i.code || '')
        return ahsp?.category || 'Uncategorized'
      })))

      const categoryIdMap = new Map<string, string>()
      const rabToWbsMap = new Map<string, string>()

      // Create Category Roots (Level 1)
      categories.forEach((cat, idx) => {
        const catId = `wbs-cat-${Date.now()}-${idx}`
        categoryIdMap.set(cat, catId)
        wbsItems.push({
          id: catId,
          code: (idx + 1).toString(),
          name: cat,
          level: 1,
          parentId: null,
          sortOrder: idx
        })
      })

      // Create Item Nodes (Level 2)
      items.forEach((item, idx) => {
        const ahsp = ahspMap.get(item.item_code || item.code || '')
        const cat = ahsp?.category || 'Uncategorized'
        const parentId = categoryIdMap.get(cat)
        const wbsId = `wbs-item-${Date.now()}-${idx}`

        rabToWbsMap.set(item.id, wbsId)

        wbsItems.push({
          id: wbsId,
          code: '', // Will be generated by store
          name: item.name || item.item_name || 'Untitled',
          level: 2,
          parentId: parentId,
          sortOrder: idx
        })
      })

      // Import WBS
      importWBS(projectId, wbsItems)

      // 2. Generate Timeline Tasks
      const newTasks = generateScheduleFromRAB(
        projectId,
        new Date().toISOString().split('T')[0], // Start today
        items,
        ahspMap,
        componentsByAHSP
      )

      // Link Tasks to WBS
      const linkedTasks = newTasks.map(task => ({
        ...task,
        wbsId: task.rabId ? rabToWbsMap.get(task.rabId) : undefined
      }))

      // Update Timeline Store
      setTasks(projectId, linkedTasks)

      // Update RAB items with new Task IDs
      linkedTasks.forEach(task => {
        if (task.rabId) {
          updateItem(projectId, task.rabId, { taskId: task.id })
        }
      })

      toast.success(`Generated WBS and ${linkedTasks.length} tasks in Timeline`)
    }
  }

  const total = items.reduce((sum, item) => sum + ((item.volume || 0) * (item.unit_price || 0)), 0)

  // PARETO LOGIC: Identify Class A/B/C
  const paretoItems = useMemo(() => calculatePareto(items), [items])
  const paretoMap = useMemo(() => new Map(paretoItems.map(i => [i.id, i.paretoClass])), [paretoItems])

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDetails(!showDetails)}>
            {showDetails ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            {showDetails ? 'Hide Details' : 'Show Split Costs'}
          </Button>
          <h3 className="text-lg font-medium">Items</h3>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-2" onClick={handleAutoSchedule}>
            <CalendarClock className="h-4 w-4" />
            Auto-Schedule
          </Button>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
              <DialogHeader>
                <DialogTitle>
                  Add Item from AHSP
                  {project?.zoneId && <span className="ml-2 text-sm font-normal text-muted-foreground">(Zone Pricing Active)</span>}
                </DialogTitle>
              </DialogHeader>
              <div className="p-4 border-b">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Search AHSP..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex-1 overflow-auto p-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Unit</TableHead>
                      <TableHead className="text-right">Price</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAHSP.map(ahsp => (
                      <TableRow key={ahsp.id}>
                        <TableCell className="font-mono text-xs">{ahsp.code}</TableCell>
                        <TableCell>{ahsp.name}</TableCell>
                        <TableCell>{ahsp.unit}</TableCell>
                        <TableCell className="text-right">{formatIDR(ahsp.finalPrice || 0)}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="ghost" onClick={() => handleAddFromAhsp(ahsp)}>
                            Select
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">No</TableHead>
              <TableHead className="w-[40px]">Cls</TableHead>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead className="min-w-[200px]">Description & Spec</TableHead>
              <TableHead className="w-[150px]">Linked Task</TableHead>
              <TableHead className="w-[80px]">Unit</TableHead>
              <TableHead className="w-[100px] text-right">Volume</TableHead>
              <TableHead className="w-[80px] text-right">TKDN %</TableHead>

              {showDetails && <TableHead className="w-[120px] text-right bg-blue-50 dark:bg-blue-900/10">Material</TableHead>}
              {showDetails && <TableHead className="w-[120px] text-right bg-green-50 dark:bg-green-900/10">Labor</TableHead>}
              {showDetails && <TableHead className="w-[120px] text-right bg-orange-50 dark:bg-orange-900/10">Equip</TableHead>}
              {showDetails && <TableHead className="w-[120px] text-right bg-purple-50 dark:bg-purple-900/10">Subcon</TableHead>}

              <TableHead className="w-[150px] text-right">Unit Price</TableHead>
              <TableHead className="w-[150px] text-right">Total</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={showDetails ? 13 : 9} className="text-center py-8 text-muted-foreground">
                  No items in RAB. Add items to start calculating.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item, idx) => {
                const lineTotal = (item.volume || 0) * (item.unit_price || 0)
                const pClass = paretoMap.get(item.id) || 'C'

                // Row Style based on Class
                const rowClass = pClass === 'A'
                  ? "bg-red-50/50 dark:bg-red-900/10 border-l-4 border-l-red-500"
                  : pClass === 'B'
                    ? "bg-yellow-50/50 dark:bg-yellow-900/10 border-l-4 border-l-yellow-400"
                    : ""

                return (
                  <TableRow key={item.id} className={rowClass}>
                    <TableCell className="text-center text-xs text-muted-foreground">{idx + 1}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant={pClass === 'A' ? 'destructive' : pClass === 'B' ? 'secondary' : 'outline'} className={`h-5 w-5 p-0 flex items-center justify-center text-[10px] ${pClass === 'B' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}>
                        {pClass}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.item_code || '-'}
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <Input
                          value={item.name || ''}
                          onChange={e => updateItem(projectId, item.id, { name: e.target.value })}
                          className="h-8 border-transparent hover:border-input focus:border-input font-medium"
                          placeholder="Item Name"
                        />
                        <Input
                          value={item.notes || ''} // Using notes as 'Brand/Spec' for now
                          onChange={e => updateItem(projectId, item.id, { notes: e.target.value })}
                          className="h-6 text-xs text-muted-foreground border-transparent hover:border-input focus:border-input"
                          placeholder="Merk / Spesifikasi..."
                        />
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={item.taskId || 'unassigned'}
                        onValueChange={(val) => updateItem(projectId, item.id, { taskId: val === 'unassigned' ? undefined : val })}
                      >
                        <SelectTrigger className="h-8 w-full border-transparent hover:border-input focus:border-input">
                          <SelectValue placeholder="Select Task" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {tasks.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Input
                        value={item.unit || ''}
                        onChange={e => updateItem(projectId, item.id, { unit: e.target.value })}
                        className="h-8 w-full border-transparent hover:border-input focus:border-input"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        value={item.volume || ''}
                        onChange={e => handleVolumeChange(item.id, e.target.value)}
                        className="h-8 text-right border-transparent hover:border-input focus:border-input"
                      />
                    </TableCell>
                    <TableCell>
                      <Input
                        type="number"
                        placeholder="0"
                        value={item.tkdn_percent || ''}
                        onChange={e => updateItem(projectId, item.id, { tkdn_percent: parseFloat(e.target.value) || 0 })}
                        className="h-8 text-right border-transparent hover:border-input focus:border-input text-xs"
                      />
                    </TableCell>

                    {showDetails && (
                      <>
                        <TableCell className="bg-blue-50 dark:bg-blue-900/10">
                          <Input type="number" className="h-8 text-right bg-transparent border-transparent hover:border-input"
                            value={item.cost_material || 0}
                            onChange={(e) => handleSplitCostChange(item.id, 'cost_material', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="bg-green-50 dark:bg-green-900/10">
                          <Input type="number" className="h-8 text-right bg-transparent border-transparent hover:border-input"
                            value={item.cost_labor || 0}
                            onChange={(e) => handleSplitCostChange(item.id, 'cost_labor', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="bg-orange-50 dark:bg-orange-900/10">
                          <Input type="number" className="h-8 text-right bg-transparent border-transparent hover:border-input"
                            value={item.cost_equipment || 0}
                            onChange={(e) => handleSplitCostChange(item.id, 'cost_equipment', e.target.value)}
                          />
                        </TableCell>
                        <TableCell className="bg-purple-50 dark:bg-purple-900/10">
                          <Input type="number" className="h-8 text-right bg-transparent border-transparent hover:border-input"
                            value={item.cost_subcon || 0}
                            onChange={(e) => handleSplitCostChange(item.id, 'cost_subcon', e.target.value)}
                          />
                        </TableCell>
                      </>
                    )}

                    <TableCell>
                      <Input
                        type="number"
                        value={item.unit_price || ''}
                        onChange={e => handlePriceChange(item.id, e.target.value)}
                        className="h-8 text-right border-transparent hover:border-input focus:border-input font-medium"
                      />
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatIDR(lineTotal)}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-red-500 hover:text-red-600"
                        onClick={() => removeItem(projectId, item.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                )
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex justify-end gap-8 p-4 bg-muted/20 rounded-lg">
        <div className="flex items-center gap-2 text-sm">
          <Badge variant="destructive" className="text-[10px]">A</Badge> Top 80% (High Value)
          <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white text-[10px]">B</Badge> Next 15%
          <Badge variant="outline" className="text-[10px]">C</Badge> Bottom 5%
        </div>
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Subtotal</div>
          <div className="text-2xl font-bold">{formatIDR(total)}</div>
        </div>
      </div>
    </div>
  )
}
