
import * as XLSX from 'xlsx'
import type { AHSPItem, Resource, AHSPComponent } from '../types/ahsp'

export function exportAHSPToXLSX(
  items: AHSPItem[],
  resources: Resource[],
  componentsByAHSP: Record<string, AHSPComponent[]>
): void {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Katalog AHSP
  const ws1 = XLSX.utils.json_to_sheet(
    items.map(item => ({
      'Kode': item.code,
      'Nama Pekerjaan': item.name,
      'Satuan': item.unit,
      'Kategori': item.category,
      'Sub-Kategori': item.subcategory || '',
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
      'Kode': r.code,
      'Nama': r.name,
      'Tipe': r.type,
      'Satuan': r.unit,
      'Harga Satuan (Rp)': r.unitPrice,
      'Supplier': r.supplier || '',
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
        'Kode AHSP': item.code,
        'Nama AHSP': item.name,
        'Tipe Komponen': comp.type,
        'Nama Resource': comp.resource?.name ?? '(resource not loaded)',
        'Koefisien': comp.coefficient,
        'Satuan': comp.unit,
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
