
import * as XLSX from 'xlsx'
import type { AHSPItem, Resource, AHSPComponent } from '../types/ahsp'

// Prevent formula injection (CWE-1236): prefix strings starting with formula triggers
function safe(v: unknown): string {
  if (v == null) return ''
  const s = String(v)
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
}

export function exportAHSPToXLSX(
  items: AHSPItem[],
  resources: Resource[],
  componentsByAHSP: Record<string, AHSPComponent[]>
): void {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Katalog AHSP
  const ws1 = XLSX.utils.json_to_sheet(
    items.map(item => ({
      'Kode': safe(item.code),
      'Nama Pekerjaan': safe(item.name),
      'Satuan': safe(item.unit),
      'Kategori': safe(item.category),
      'Sub-Kategori': safe(item.subcategory),
      'Harga Material (Rp)': item.price_material ?? 0,
      'Harga Tenaga (Rp)': item.price_labor ?? 0,
      'Harga Alat (Rp)': item.price_equipment ?? 0,
      'Harga Subkon (Rp)': item.price_subcon ?? 0,
      'Harga Dasar (Rp)': item.basePrice,
      'Overhead (%)': item.overheadPercentage ?? 0,
      'Profit (%)': item.profitPercentage ?? 0,
      'Harga Total (Rp)': item.finalPrice,
      'Status': item.isActive ? 'Aktif' : 'Nonaktif',
    }))
  )
  XLSX.utils.book_append_sheet(wb, ws1, 'Katalog AHSP')

  // Sheet 2: Resources
  const ws2 = XLSX.utils.json_to_sheet(
    resources.map(r => ({
      'Kode': safe(r.code),
      'Nama': safe(r.name),
      'Tipe': safe(r.type),
      'Satuan': safe(r.unit),
      'Harga Satuan (Rp)': r.unitPrice,
      'Supplier': safe(r.supplier),
      'Status': r.isActive ? 'Aktif' : 'Nonaktif',
    }))
  )
  XLSX.utils.book_append_sheet(wb, ws2, 'Resources')

  // Sheet 3: Komponen
  type ComponentRow = {
    'Kode AHSP': string
    'Nama AHSP': string
    'Tipe Komponen': string
    'Nama Resource': string
    'Koefisien': number
    'Satuan': string
    'Harga Satuan (Rp)': number
    'Sub-Total (Rp)': number
  }

  const componentRows: ComponentRow[] = []
  items.forEach(item => {
    const comps = componentsByAHSP[item.id] ?? []
    comps.forEach(comp => {
      componentRows.push({
        'Kode AHSP': safe(item.code),
        'Nama AHSP': safe(item.name),
        'Tipe Komponen': safe(comp.type),
        'Nama Resource': safe(comp.resource?.name ?? '(resource not loaded)'),
        'Koefisien': comp.coefficient,
        'Satuan': safe(comp.unit),
        'Harga Satuan (Rp)': comp.unitPrice,
        'Sub-Total (Rp)': comp.subtotal,
      })
    })
  })
  const ws3 = XLSX.utils.json_to_sheet(componentRows.length ? componentRows : [{}])
  XLSX.utils.book_append_sheet(wb, ws3, 'Komponen')

  try {
    XLSX.writeFile(wb, `AHSP_${new Date().toISOString().split('T')[0]}.xlsx`)
  } catch (err) {
    throw new Error(`Gagal mengekspor Excel: ${(err as Error).message ?? String(err)}`)
  }
}

export function exportResourcesToXLSX(resources: Resource[]): void {
  const wb = XLSX.utils.book_new()
  const ws = XLSX.utils.json_to_sheet(
    resources.map(r => ({
      'Kode': safe(r.code),
      'Nama Resource': safe(r.name),
      'Tipe': safe(r.type),
      'Satuan': safe(r.unit),
      'Harga Satuan (Rp)': r.unitPrice,
      'Supplier': safe(r.supplier),
      'Spesifikasi': safe(r.specifications),
      'Status': r.isActive ? 'Aktif' : 'Nonaktif',
    }))
  )
  XLSX.utils.book_append_sheet(wb, ws, 'DKH Resources')
  try {
    XLSX.writeFile(wb, `DKH_Resources_${new Date().toISOString().split('T')[0]}.xlsx`)
  } catch (err) {
    throw new Error(`Gagal mengekspor Excel: ${(err as Error).message ?? String(err)}`)
  }
}
