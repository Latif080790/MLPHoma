/**
 * mrpAlertService.ts
 *
 * Material Requirement Planning (MRP) Auto-Alert Engine.
 * Cross-references RAB items, Timeline tasks, Inventory stock, and POs
 * to proactively detect upcoming material shortages.
 *
 * Used by: MRPAlertPanel, CommandCenter, SupplyChain
 */

import { useRabStore } from '../store/rabStore'
import { useTimelineStore } from '../store/timelineStore'
import { useSupplyChainStore } from '../store/supplyChainStore'

// ─── Types ───

export type AlertSeverity = 'critical' | 'warning' | 'info'

export interface MaterialAlert {
    id: string
    resourceName: string
    unit: string
    /** Total volume needed from RAB */
    totalNeeded: number
    /** Current stock from inventory */
    currentStock: number
    /** Quantity already ordered (pending POs) */
    pendingPO: number
    /** Effective available = currentStock + pendingPO */
    effectiveAvailable: number
    /** Shortfall = totalNeeded - effectiveAvailable (positive = shortage) */
    shortfall: number
    /** Name of the nearest timeline task requiring this material */
    taskName: string | null
    /** Due date of nearest task */
    dueDate: string | null
    /** Days until the material is needed */
    daysUntilNeeded: number | null
    /** Severity classification */
    severity: AlertSeverity
}

export interface MRPSummary {
    alerts: MaterialAlert[]
    criticalCount: number
    warningCount: number
    infoCount: number
    totalShortfall: number
}

// ─── Constants ───
const CRITICAL_DAYS = 3
const WARNING_DAYS = 7
const INFO_DAYS = 14

// ─── Core Engine ───

/**
 * Analyze material shortages for a given project.
 * Pulls data from RAB store (planned volumes), Timeline store (scheduled tasks),
 * Supply Chain store (inventory + POs), and computes alerts.
 */
export function analyzeMaterialShortages(projectId: string): MRPSummary {
    // 1. Get RAB items (planned material needs)
    const rabItems = useRabStore.getState().getItems(projectId)

    // 2. Get timeline tasks (upcoming schedule)
    const timelineTasks = useTimelineStore.getState().getTasks(projectId)

    // 3. Get supply chain data (inventory + POs)
    const { inventoryStock, purchaseOrders } = useSupplyChainStore.getState()

    // 4. Aggregate material requirements from RAB
    const materialNeeds = new Map<string, {
        totalNeeded: number
        unit: string
        taskName: string | null
        dueDate: string | null
    }>()

    for (const item of rabItems) {
        const name = (item.name || item.item_name || '').trim().toLowerCase()
        if (!name) continue

        const existing = materialNeeds.get(name) || {
            totalNeeded: 0,
            unit: item.unit || '-',
            taskName: null,
            dueDate: null,
        }
        existing.totalNeeded += (item.volume || 0)

        // Try to find the linked task for this RAB item
        if (item.taskId) {
            const linkedTask = timelineTasks.find(t => t.id === item.taskId)
            if (linkedTask) {
                const taskStart = linkedTask.startDate || linkedTask.start_date
                if (!existing.dueDate || (taskStart && taskStart < existing.dueDate)) {
                    existing.dueDate = taskStart || null
                    existing.taskName = linkedTask.name
                }
            }
        }

        materialNeeds.set(name, existing)
    }

    // 5. Calculate stock and pending PO for each material
    const alerts: MaterialAlert[] = []
    let idCounter = 0

    for (const [materialName, need] of materialNeeds.entries()) {
        // Find matching inventory stock (case-insensitive)
        const stock = inventoryStock.find(
            s => s.materialName.trim().toLowerCase() === materialName
        )
        const currentStock = stock?.current ?? stock?.currentStock ?? 0

        // Find pending PO quantities for this material
        let pendingPO = 0
        for (const po of purchaseOrders) {
            if (po.projectId !== projectId) continue
            if (!['DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED'].includes(po.status)) continue
            if (po.items) {
                for (const item of po.items) {
                    const poItemName = (item.itemName || item.rapItemName || '').trim().toLowerCase()
                    if (poItemName === materialName) {
                        pendingPO += item.quantity
                    }
                }
            }
        }

        const effectiveAvailable = currentStock + pendingPO
        const shortfall = need.totalNeeded - effectiveAvailable

        // Only alert if there's a shortfall
        if (shortfall <= 0) continue

        // Calculate days until needed
        let daysUntilNeeded: number | null = null
        if (need.dueDate) {
            const due = new Date(need.dueDate)
            const now = new Date()
            daysUntilNeeded = Math.max(0, Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        }

        // Classify severity
        let severity: AlertSeverity = 'info'
        if (daysUntilNeeded !== null) {
            if (daysUntilNeeded <= CRITICAL_DAYS) severity = 'critical'
            else if (daysUntilNeeded <= WARNING_DAYS) severity = 'warning'
        } else {
            // No schedule linked — classify by shortfall ratio
            const ratio = shortfall / Math.max(need.totalNeeded, 1)
            if (ratio > 0.5) severity = 'warning'
            if (ratio > 0.8) severity = 'critical'
        }

        alerts.push({
            id: `mrp-${++idCounter}`,
            resourceName: materialName,
            unit: need.unit,
            totalNeeded: need.totalNeeded,
            currentStock,
            pendingPO,
            effectiveAvailable,
            shortfall,
            taskName: need.taskName,
            dueDate: need.dueDate,
            daysUntilNeeded,
            severity,
        })
    }

    // Sort: critical first, then warning, then info
    const severityOrder: Record<AlertSeverity, number> = { critical: 0, warning: 1, info: 2 }
    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

    return {
        alerts,
        criticalCount: alerts.filter(a => a.severity === 'critical').length,
        warningCount: alerts.filter(a => a.severity === 'warning').length,
        infoCount: alerts.filter(a => a.severity === 'info').length,
        totalShortfall: alerts.reduce((sum, a) => sum + a.shortfall, 0),
    }
}
