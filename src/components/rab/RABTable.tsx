import React, { useState, useMemo, useEffect } from 'react'
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from '../ui/table'
import { Input } from '../ui/input'
import { Button } from '../ui/button'
import { Trash2, Plus, Search } from 'lucide-react'
import { useRabStore, RABItem } from '../../store/rabStore'
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

interface RABTableProps {
  projectId: string
}

export function RABTable({ projectId }: RABTableProps) {
  const {
    ahspItems,
    searchAHSPItems,
    importAHSPItems,
    importResources,
    resources
  } = useAHSPStore()

  const { getItems, addItem, updateItem, removeItem } = useRabStore()
  const items = getItems(projectId)
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // Seed AHSP store with sample data if empty
  useEffect(() => {
    if (ahspItems.length === 0 && resources.length === 0) {
      importResources(SAMPLE_RESOURCES as any)
      importAHSPItems(SAMPLE_AHSP_ITEMS as any)
      // toast.info('Loaded sample AHSP data')
    }
  }, [ahspItems.length, resources.length, importResources, importAHSPItems])

  const filteredAHSP = searchQuery
    ? searchAHSPItems(searchQuery)
    : ahspItems

  const handleVolumeChange = (id: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateItem(projectId, id, { volume: num })
  }

  const handlePriceChange = (id: string, val: string) => {
    const num = parseFloat(val)
    if (isNaN(num)) return
    updateItem(projectId, id, { unit_price: num })
  }

  const handleAddFromAhsp = (ahspItem: any) => {
    addItem(projectId, {
      item_code: ahspItem.code,
      name: ahspItem.name,
      unit: ahspItem.unit,
      unit_price: ahspItem.finalPrice || ahspItem.basePrice || 0,
      volume: 1,
      finalTotal: (ahspItem.finalPrice || ahspItem.basePrice || 0) * 1
    })
    setIsAddDialogOpen(false)
    toast.success('Item added from AHSP')
  }

  const total = items.reduce((sum, item) => sum + ((item.volume || 0) * (item.unit_price || 0)), 0)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Items</h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Add Item from AHSP</DialogTitle>
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

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="w-[80px]">Unit</TableHead>
              <TableHead className="w-[120px] text-right">Volume</TableHead>
              <TableHead className="w-[150px] text-right">Unit Price</TableHead>
              <TableHead className="w-[150px] text-right">Total</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                  No items in RAB. Add items to start calculating.
                </TableCell>
              </TableRow>
            ) : (
              items.map((item) => {
                const lineTotal = (item.volume || 0) * (item.unit_price || 0)
                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {item.item_code || '-'}
                    </TableCell>
                    <TableCell>
                      <Input 
                        value={item.name || ''} 
                        onChange={e => updateItem(projectId, item.id, { name: e.target.value })}
                        className="h-8 border-transparent hover:border-input focus:border-input"
                      />
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
                        value={item.unit_price || ''} 
                        onChange={e => handlePriceChange(item.id, e.target.value)}
                        className="h-8 text-right border-transparent hover:border-input focus:border-input"
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
        <div className="text-right">
          <div className="text-sm text-muted-foreground">Subtotal</div>
          <div className="text-2xl font-bold">{formatIDR(total)}</div>
        </div>
      </div>
    </div>
  )
}
