/**
 * demoDataSeeder.ts
 * Utility to seed a comprehensive "Rumah Tinggal Type 60" project
 * for testing ALL application modules (WBS, RAB, Timeline, AHSP, Supply Chain, Finance, Risk, TKDN).
 */

import { useTimelineStore } from '../store/timelineStore'
import { useWBSStore } from '../store/wbsStore'
import { useRabStore } from '../store/rabStore'
import { useAHSPStore } from '../store/ahspStore'
import { useSupplyChainStore } from '../store/supplyChainStore'
import { useFinanceStore } from '../store/financeStore'
import { useRiskStore } from '../store/riskStore'
import { useTKDNStore } from '../store/tkdnStore'
import { generateId } from './idGenerator'

/**
 * seedEnterpriseProject
 * @param projectId Target project ID
 */
export async function seedEnterpriseProject(projectId: string) {
  const timelineStore = useTimelineStore.getState()
  const wbsStore = useWBSStore.getState()
  const rabStore = useRabStore.getState()
  const ahspStore = useAHSPStore.getState()
  const scStore = useSupplyChainStore.getState()
  const financeStore = useFinanceStore.getState()
  const riskStore = useRiskStore.getState()
  const tkdnStore = useTKDNStore.getState()

  // 1. Clear existing data for this project to ensure clean state
  timelineStore.setTasks(projectId, [])
  wbsStore.clearProject(projectId)
  rabStore.clearProject(projectId)
  // Note: AHSP items are usually global, but we can clear and re-import for demo
  
  const nowString = new Date().toISOString()
  const today = new Date()
  const toISO = (d: Date) => d.toISOString().split('T')[0]
  const addDays = (d: Date, days: number) => {
    const res = new Date(d)
    res.setDate(res.getDate() + days)
    return res
  }

  // --- 2. Seed WBS ---
  const wbsItemsToImport = [
    { name: 'Pekerjaan Persiapan', code: '1', level: 1, parentCode: undefined },
    { name: 'Mobilisasi', code: '1.1', level: 2, parentCode: '1' },
    { name: 'Pembersihan Lahan', code: '1.2', level: 2, parentCode: '1' },
    { name: 'Pekerjaan Tanah & Pondasi', code: '2', level: 1, parentCode: undefined },
    { name: 'Galian Tanah', code: '2.1', level: 2, parentCode: '2' },
    { name: 'Pasangan Pondasi Batu Kali', code: '2.2', level: 2, parentCode: '2' },
    { name: 'Pekerjaan Struktur', code: '3', level: 1, parentCode: undefined },
    { name: 'Sloof Beton', code: '3.1', level: 2, parentCode: '3' },
    { name: 'Kolom & Ring Balok', code: '3.2', level: 2, parentCode: '3' },
    { name: 'Pekerjaan Arsitektur', code: '4', level: 1, parentCode: undefined },
    { name: 'Pasang Dinding Hebel', code: '4.1', level: 2, parentCode: '4' },
    { name: 'Plester & aci', code: '4.2', level: 3, parentCode: '4.1' },
  ]
  await wbsStore.importWBS(projectId, wbsItemsToImport)
  const allWbs = wbsStore.itemsByProject[projectId]

  // --- 3. Seed AHSP Master Resources & Items ---
  const mockResources: any[] = [
    { code: 'M-001', name: 'Semen Portland (PC)', type: 'material', unit: 'kg', unitPrice: 1500, isActive: true },
    { code: 'M-002', name: 'Pasir Cor', type: 'material', unit: 'm3', unitPrice: 280000, isActive: true },
    { code: 'L-001', name: 'Tukang Batu', type: 'labor', unit: 'oh', unitPrice: 150000, isActive: true },
    { code: 'L-002', name: 'Kenek', type: 'labor', unit: 'oh', unitPrice: 110000, isActive: true }
  ]
  ahspStore.importResources(mockResources)

  // --- 4. Seed RAB ---
  const rabItems = allWbs.filter(w => w.level === 2).map((w, idx) => ({
    id: generateId(),
    projectId,
    wbs_id: w.id,
    wbs_code: w.code,
    item_name: `Material & Upah - ${w.name}`,
    description: `Cost allocation for ${w.name}`,
    qty: 10 + idx * 5,
    unit: idx % 2 === 0 ? 'm2' : 'm3',
    price: 150000 + idx * 50000,
    total_price: (10 + idx * 5) * (150000 + idx * 50000),
    category: 'Material/Labor',
    createdAt: nowString,
    updatedAt: nowString
  }))
  rabStore.importItems(projectId, rabItems)

  // --- 5. Seed Timeline Tasks ---
  const t1Id = generateId()
  const t2Id = generateId()
  const t3Id = generateId()
  const t4Id = generateId()
  const t5Id = generateId()

  const tasks = [
    {
      id: t1Id,
      name: 'Mob & Pembersihan Lahan',
      startDate: toISO(today),
      duration: 5,
      progress: 100,
      status: 'completed',
      priority: 'high',
      wbsId: allWbs.find(w => w.code === '1.1')?.id,
      rabId: rabItems.find(r => r.wbs_code === '1.1')?.id,
      progressEvidence: {
        photoUrl: 'https://images.unsplash.com/photo-1541888946425-d81bb19480c5?auto=format&fit=crop&q=80&w=1000',
        capturedAt: addDays(today, -2).toISOString(),
        latitude: -6.2088,
        longitude: 106.8456,
        hasPhoto: true,
        hasTimestamp: true,
        hasLocation: true
      }
    },
    {
      id: t2Id,
      name: 'Galian Tanah Pondasi',
      startDate: toISO(addDays(today, 5)),
      duration: 3,
      progress: 60,
      status: 'in_progress',
      priority: 'high',
      wbsId: allWbs.find(w => w.code === '2.1')?.id,
      dependencies: [{ id: generateId(), predecessorId: t1Id, successorId: t2Id, type: 'FS', lag: 0 }]
    },
    {
      id: t3Id,
      name: 'Pekerjaan Pondasi Batu Kali',
      startDate: toISO(addDays(today, 8)),
      duration: 7,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
      wbsId: allWbs.find(w => w.code === '2.2')?.id,
      dependencies: [{ id: generateId(), predecessorId: t2Id, successorId: t3Id, type: 'FS', lag: 0 }]
    },
    {
      id: t4Id,
      name: 'Pekerjaan Struktur Beton',
      startDate: toISO(addDays(today, 15)),
      duration: 12,
      progress: 0,
      status: 'not_started',
      priority: 'medium',
      wbsId: allWbs.find(w => w.code === '3.1')?.id,
      dependencies: [{ id: generateId(), predecessorId: t3Id, successorId: t4Id, type: 'FS', lag: 0 }]
    },
    {
      id: t5Id,
      name: 'Pekerjaan Dinding Hebel',
      startDate: toISO(addDays(today, 10)),
      duration: 10,
      progress: 0,
      status: 'delayed',
      priority: 'low',
      wbsId: allWbs.find(w => w.code === '4.1')?.id,
      dependencies: [{ id: generateId(), predecessorId: t2Id, successorId: t5Id, type: 'SS', lag: 2 }]
    }
  ]
  timelineStore.importTasks(projectId, tasks)

  // --- 6. Seed Supply Chain ---
  const mrId = generateId()
  const poId = generateId()
  
  // Create Material Request (Approved)
  await scStore.createMaterialRequest({
    id: mrId,
    projectId,
    wbsId: allWbs.find(w => w.code === '2.1')?.id,
    wbsCode: '2.1',
    itemName: 'Semen Portland (PC)',
    quantityRequested: 50,
    unit: 'sak',
    status: 'APPROVED',
    createdAt: addDays(today, -5).toISOString()
  })

  // Create Purchase Order (Draft/Pending)
  await scStore.createPurchaseOrder({
    id: poId,
    projectId,
    poNumber: `PO-${projectId.slice(0,4).toUpperCase()}-001`,
    vendorName: 'UD Jaya Material',
    status: 'PENDING',
    totalAmount: 4500000,
    createdAt: addDays(today, -2).toISOString()
  }, [
    { id: generateId(), poId, itemName: 'Semen Portland (PC)', quantity: 50, unitPrice: 90000, totalPrice: 4500000, createdAt: nowString }
  ])

  // --- 7. Seed Finance ---
  // Mock Invoice (Unpaid)
  await financeStore.createInvoice({
    project_id: projectId,
    vendor_name: 'UD Jaya Material',
    invoice_number: `INV-2024-001`,
    amount: 4500000,
    tax_amount: 450000,
    total_amount: 4950000,
    due_date: toISO(addDays(today, 14)),
    status: 'UNPAID',
    created_at: nowString
  })

  // Mock Transaction (Initial Mobilization Expense)
  await financeStore.recordTransaction({
    project_id: projectId,
    transaction_date: toISO(addDays(today, -7)),
    description: 'Biaya Mobilisasi Awal',
    category: 'Operational',
    amount: -2500000
  })

  // --- 8. Seed Risks ---
  // The riskStore might not have a clearProject, let's assume it has an addRisk action
  if (typeof riskStore.addRisk === 'function') {
    await riskStore.addRisk(projectId, {
      title: 'Keterlambatan Pengiriman Material',
      description: 'Akses jalan menuju site terhambat karena cuaca buruk.',
      severity: 'high',
      status: 'active'
    })
    await riskStore.addRisk(projectId, {
      title: 'Kenaikan Harga Beton',
      description: 'Fluktuasi harga pasar semen nasional.',
      severity: 'medium',
      status: 'monitored'
    })
  }

  // --- 9. Seed TKDN ---
  if (typeof tkdnStore.addItem === 'function') {
    await tkdnStore.addItem({
      projectId,
      name: 'Semen Portland (PC)',
      unit: 'sak',
      price: 90000,
      quantity: 50,
      localContentPercentage: 95,
      materialOrigin: 'local'
    })
    await tkdnStore.addItem({
      projectId,
      name: 'Pasang Dinding Hebel',
      unit: 'm2',
      price: 120000,
      quantity: 80,
      localContentPercentage: 80,
      materialOrigin: 'local'
    })
  }

  return true
}
