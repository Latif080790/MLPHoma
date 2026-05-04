/**
 * ahspSample.ts
 * Sample data for AHSP (Analisis Harga Satuan Pekerjaan)
 */

import { AHSPItem, Resource } from '../../types/ahsp'

export const SAMPLE_RESOURCES: Partial<Resource>[] = [
  { code: 'M001', name: 'Semen Portland', unit: 'kg', unitPrice: 1450, type: 'material' },
  { code: 'M002', name: 'Pasir Beton', unit: 'm3', unitPrice: 215000, type: 'material' },
  { code: 'M003', name: 'Kerikil Beton', unit: 'm3', unitPrice: 245000, type: 'material' },
  { code: 'M004', name: 'Air', unit: 'ltr', unitPrice: 50, type: 'material' },
  { code: 'M005', name: 'Batu Bata Merah', unit: 'bh', unitPrice: 850, type: 'material' },
  { code: 'M006', name: 'Pasir Pasang', unit: 'm3', unitPrice: 195000, type: 'material' },
  { code: 'L001', name: 'Pekerja', unit: 'oh', unitPrice: 120000, type: 'labor' },
  { code: 'L002', name: 'Tukang Batu', unit: 'oh', unitPrice: 150000, type: 'labor' },
  { code: 'L003', name: 'Kepala Tukang', unit: 'oh', unitPrice: 175000, type: 'labor' },
  { code: 'L004', name: 'Mandor', unit: 'oh', unitPrice: 200000, type: 'labor' },
]

export const SAMPLE_AHSP_ITEMS: Partial<AHSPItem>[] = [
  {
    code: 'A.2.3.1.1',
    name: 'Galian Tanah Biasa Sedalam 1 m',
    category: 'Pekerjaan Tanah',
    unit: 'm3',
    basePrice: 78750,
    finalPrice: 78750,
    description: 'Penggalian tanah biasa sedalam 1 meter'
  },
  {
    code: 'A.3.2.1.2',
    name: 'Pemasangan 1 m2 Dinding Bata Merah (1:4)',
    category: 'Pekerjaan Dinding',
    unit: 'm2',
    basePrice: 125500,
    finalPrice: 125500,
    description: 'Pasangan dinding bata merah tebal 1/2 bata campuran 1SP : 4PP'
  },
  {
    code: 'A.4.1.1.7',
    name: 'Membuat 1 m3 Beton Mutu f\'c = 19.3 MPa (K-225)',
    category: 'Pekerjaan Beton',
    unit: 'm3',
    basePrice: 985000,
    finalPrice: 985000,
    description: 'Beton mutu K-225 slump (12±2) cm, w/c = 0.58'
  },
  {
    code: 'A.4.2.1.1',
    name: 'Pembesian 10 kg dengan Besi Polos atau Ulir',
    category: 'Pekerjaan Beton',
    unit: 'kg',
    basePrice: 16500,
    finalPrice: 16500,
    description: 'Pembesian untuk beton bertulang'
  },
  {
    code: 'A.4.4.1.1',
    name: 'Pasang Bekisting Pondasi',
    category: 'Pekerjaan Beton',
    unit: 'm2',
    basePrice: 145000,
    finalPrice: 145000,
    description: 'Pemasangan bekisting untuk pondasi'
  }
]
