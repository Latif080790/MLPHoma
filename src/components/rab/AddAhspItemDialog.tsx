import React, { useMemo } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Calculator, MapPin, Plus, Search, Layers, X, FileSpreadsheet, Download } from 'lucide-react'
import { formatIDR } from '@/lib/utils'
import { useAHSPStore } from '@/store/ahspStore'

interface AddAhspItemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentZone: { id: string; name: string } | null | undefined
  onAddItem: (ahsp: any) => void
  searchQuery: string
  onSearchChange: (q: string) => void
  selectedCategory: string
  onCategoryChange: (c: string) => void
  selectedUnit: string
  onUnitChange: (u: string) => void
}

export function AddAhspItemDialog({
  open, onOpenChange, currentZone, onAddItem,
  searchQuery, onSearchChange, selectedCategory, onCategoryChange, selectedUnit, onUnitChange
}: AddAhspItemDialogProps) {
  const { ahspItems, searchAHSPItems } = useAHSPStore()

  const filteredAHSP = useMemo(() => {
    let list = ahspItems
    if (searchQuery) list = searchAHSPItems(searchQuery)
    if (selectedCategory !== 'all') list = list.filter(i => i.category === selectedCategory)
    if (selectedUnit !== 'all') list = list.filter(i => i.unit === selectedUnit)
    return list
  }, [ahspItems, searchQuery, searchAHSPItems, selectedCategory, selectedUnit])

  const categories = useMemo(() => Array.from(new Set(ahspItems.map(i => i.category).filter(Boolean))), [ahspItems])
  const units = useMemo(() => Array.from(new Set(ahspItems.map(i => i.unit).filter(Boolean))), [ahspItems])

  const parentRef = React.useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: filteredAHSP.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 5,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] lg:max-w-screen-2xl max-h-[95vh] flex flex-col p-0 overflow-hidden bg-slate-50/50 border-none shadow-2xl">
        <DialogHeader className="p-6 pb-4 bg-white border-b shrink-0 flex flex-row items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-200">
              <Calculator className="h-6 w-6" />
            </div>
            <DialogTitle className="text-xl font-black tracking-tight text-slate-900 m-0">Add Item from AHSP Catalog</DialogTitle>
          </div>
          {currentZone && (
            <Badge variant="secondary" className="flex items-center gap-1.5 bg-blue-50 text-blue-700 border-blue-100 dark:bg-blue-900/30 dark:text-blue-300 px-3 py-1 text-sm">
              <MapPin className="h-3.5 w-3.5" />
              {currentZone.name}
            </Badge>
          )}
        </DialogHeader>
        
        <div className="p-6 pt-4 flex-1 flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row gap-4 items-center shrink-0 mb-4">
            <div className="relative flex-1 group w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors h-4 w-4" />
              <Input
                placeholder="Cari nama pekerjaan atau kode..."
                value={searchQuery}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-10 pr-10 h-10 bg-white border-slate-200 focus:border-blue-500 shadow-sm text-sm"
              />
              {searchQuery && (
                <button
                  onClick={() => onSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-full p-0.5 transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            
            <Select value={selectedCategory} onValueChange={onCategoryChange}>
              <SelectTrigger className="w-full sm:w-[220px] h-10 bg-white border-slate-200 shadow-sm text-sm font-medium text-slate-700">
                <SelectValue placeholder="Semua Kategori" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px]">
                <SelectItem value="all" className="font-bold text-slate-900 font-sans">⊞ Semua Kategori</SelectItem>
                {categories.map((c: string) => (
                  <SelectItem key={c} value={c} className="text-sm font-medium font-sans">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedUnit} onValueChange={onUnitChange}>
              <SelectTrigger className="w-full sm:w-[160px] h-10 bg-white border-slate-200 shadow-sm text-sm font-medium text-slate-700">
                <SelectValue placeholder="Semua Satuan" />
              </SelectTrigger>
              <SelectContent className="max-h-[300px] min-w-[120px]">
                <SelectItem value="all" className="font-bold text-slate-900">Semua Satuan</SelectItem>
                {units.map((u: string) => (
                  <SelectItem key={u} value={u} className="text-sm font-medium font-mono uppercase">
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm ring-1 ring-slate-900/5">
            <div ref={parentRef} className="h-full overflow-auto relative custom-scrollbar">
              <Table className="w-full relative">
                <TableHeader className="sticky top-0 z-20 shadow-sm">
                  <TableRow className="border-b bg-slate-50/95 backdrop-blur hover:bg-slate-50/95">
                    <TableHead className="w-[120px] text-left text-xs font-bold uppercase tracking-wider text-slate-500 py-3 px-6">Kode</TableHead>
                    <TableHead className="text-left text-xs font-bold uppercase tracking-wider text-slate-500 py-3">Uraian Pekerjaan</TableHead>
                    <TableHead className="w-[100px] text-center text-xs font-bold uppercase tracking-wider text-slate-500 py-3">Satuan</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-bold uppercase tracking-wider text-slate-500 py-3">Material</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-bold uppercase tracking-wider text-slate-500 py-3">Upah</TableHead>
                    <TableHead className="w-[130px] text-right text-xs font-bold uppercase tracking-wider text-slate-500 py-3">Alat & Sub</TableHead>
                    <TableHead className="w-[150px] text-right text-xs font-bold uppercase tracking-wider text-slate-900 py-3 px-6">Harga Total</TableHead>
                    <TableHead className="w-[80px] text-right py-3 px-6"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody
                  className="relative"
                  style={{ height: `${virtualizer.getTotalSize()}px` }}
                >
                  {filteredAHSP.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-48 text-center text-slate-500 font-medium">
                        Tidak ada analisis AHSP yang sesuai.
                      </TableCell>
                    </TableRow>
                  ) : (
                    virtualizer.getVirtualItems().map(virtualRow => {
                      const ahsp = filteredAHSP[virtualRow.index]
                      return (
                        <TableRow
                          key={ahsp.id}
                          className="group hover:bg-blue-50/30 transition-colors border-b border-slate-100 last:border-0 cursor-pointer"
                          onClick={() => onAddItem(ahsp)}
                          style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: `${virtualRow.size}px`,
                            transform: `translateY(${virtualRow.start}px)`,
                          }}
                        >
                          <TableCell className="py-4 px-6 font-mono text-xs text-slate-500 group-hover:text-blue-600 font-semibold">{ahsp.code}</TableCell>
                          <TableCell className="py-4">
                            <div className="flex flex-col gap-1">
                              <span className="font-bold text-slate-800 leading-snug group-hover:text-blue-700 transition-colors">{ahsp.name}</span>
                              {ahsp.category && (
                                <span className="text-xs text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1">
                                  <div className="h-1 w-1 rounded-full bg-slate-300" />
                                  {ahsp.category}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="py-4 text-center">
                            <Badge variant="outline" className="text-xs h-6 bg-slate-50 font-black uppercase text-slate-600 border-slate-200">
                              {ahsp.unit}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-4 text-right font-mono text-xs text-slate-500">
                            {formatIDR(ahsp.price_material || 0)}
                          </TableCell>
                          <TableCell className="py-4 text-right font-mono text-xs text-slate-500">
                            {formatIDR(ahsp.price_labor || 0)}
                          </TableCell>
                          <TableCell className="py-4 text-right font-mono text-xs text-slate-500">
                            {formatIDR((ahsp.price_equipment || 0) + (ahsp.price_subcon || 0))}
                          </TableCell>
                          <TableCell className="py-4 text-right px-6">
                            <span className="font-mono text-sm font-black text-slate-900 group-hover:text-blue-700 transition-colors">
                              {formatIDR(ahsp.finalPrice || 0)}
                            </span>
                          </TableCell>
                          <TableCell className="py-4 px-6 text-right">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-9 w-9 p-0 rounded-full group-hover:bg-blue-600 group-hover:text-white transition-all pointer-events-none"
                            >
                              <Plus className="h-5 w-5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 bg-white border-t shrink-0 flex justify-end gap-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-slate-500 hover:text-slate-900 font-semibold px-6">
            Cancel
          </Button>
          <div className="h-10 w-[1px] bg-slate-200 mx-1 shrink-0" />
          <p className="text-xs text-slate-400 italic max-w-[200px] text-right mr-4 leading-tight">
            Click on any row to immediately add the item to your project RAB.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
