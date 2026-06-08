/**
 * SNIPresetPicker.tsx
 * SNI AHSP template selector. Lets the user pick an existing SNI AHSP item from the
 * database to copy its master data + components into a new AHSP.
 */

import { Search, Check, Database } from 'lucide-react'
import { ChevronsUpDown } from 'lucide-react'
import { Badge } from '../ui/badge'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '../ui/command'
import { formatIDR } from '../../lib/utils'
import type { AHSPItem } from '../../types/ahsp'

/** Props for SNIPresetPicker component */
export interface SNIPresetPickerProps {
  /** Whether the picker popover is open */
  open: boolean
  /** Open-state change handler */
  onOpenChange: (open: boolean) => void
  /** AHSP items usable as SNI templates */
  presets: AHSPItem[]
  /** Currently selected preset id (null when none) */
  selectedPresetId: string | null
  /** Called when a preset is selected — receives the chosen SNI item */
  onSelect: (preset: AHSPItem) => void
  /** Number of components currently copied (for the success badge) */
  componentsCount: number
}

/**
 * SNIPresetPicker Component — searchable combobox of SNI AHSP templates.
 */
export function SNIPresetPicker({
  open,
  onOpenChange,
  presets,
  selectedPresetId,
  onSelect,
  componentsCount,
}: SNIPresetPickerProps) {
  return (
    <div className="bg-card p-5 rounded-xl border border-blue-500/30 space-y-4 mb-6">
      <div className="flex items-center gap-3">
        <div className="bg-blue-500/10 p-2 rounded-xl ring-1 ring-blue-500/20">
          <Database className="h-5 w-5 text-blue-500" />
        </div>
        <div>
          <h3 className="text-foreground font-bold text-sm">Pilih dari AHSP SNI yang Ada</h3>
          <p className="text-muted-foreground text-xs">Template dari database proyek Anda</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        Pilih AHSP SNI yang sudah ada untuk menyalin semua component & coefficient-nya
      </p>
      {(() => {
        const picked = presets.find(i => i.id === selectedPresetId)
        return (
          <Popover open={open} onOpenChange={onOpenChange}>
            <PopoverTrigger asChild>
              <button
                type="button"
                role="combobox"
                aria-expanded={open}
                className="flex w-full items-center gap-2 h-10 rounded-lg border border-border bg-background px-3 text-left hover:border-blue-400/50 transition-all focus:outline-none focus:ring-2 focus:ring-primary/10"
              >
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className={`flex-1 truncate text-sm ${picked ? 'font-semibold text-foreground' : 'text-muted-foreground'}`}>
                  {picked ? `${picked.code} — ${picked.name}` : 'Cari & pilih AHSP SNI dari database...'}
                </span>
                <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[320px]" align="start">
              <Command
                filter={(value, search) => {
                  // value carries "code name category" lowercased for matching
                  return value.includes(search.toLowerCase()) ? 1 : 0
                }}
              >
                <CommandInput placeholder="Ketik kode / nama / kategori..." className="text-sm" />
                <CommandList className="max-h-72">
                  <CommandEmpty>
                    {presets.length === 0
                      ? 'Belum ada AHSP SNI di database.'
                      : 'Tidak ada AHSP yang cocok.'}
                  </CommandEmpty>
                  <CommandGroup>
                    {presets.map(it => (
                      <CommandItem
                        key={it.id}
                        value={`${it.code} ${it.name} ${it.category}`.toLowerCase()}
                        onSelect={() => {
                          onSelect(it)
                        }}
                        className="flex flex-col items-start gap-1 py-2.5"
                      >
                        <span className="font-semibold text-foreground text-sm leading-tight">{it.code} — {it.name}</span>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20 dark:text-blue-400">
                            {it.category}
                          </Badge>
                          <span className="text-xs text-muted-foreground font-mono">{it.unit} • {formatIDR(it.finalPrice)}</span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        )
      })()}
      {selectedPresetId && (
        <div className="flex items-center gap-2 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
          <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            {componentsCount} komponen tersalin — buka tab <strong>Komponen</strong> untuk meninjau.
          </p>
        </div>
      )}
    </div>
  )
}

export default SNIPresetPicker
