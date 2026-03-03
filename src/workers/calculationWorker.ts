/**
 * calculationWorker.ts
 *
 * Web Worker that handles CPU-intensive calculation tasks off the main thread.
 * Supports: AHSP price calculation, Pareto classification, RAB totals, and bulk recalculation.
 *
 * Message Protocol:
 *   Request:  { id: string, type: string, payload: any }
 *   Response: { id: string, type: string, result: any, error?: string }
 */

// ─── Pure Math Functions (duplicated here to avoid import issues in worker scope) ───

function calculatePriceWithMarkup(input: {
    basePrice: number
    overheadPercent?: number
    profitPercent?: number
    taxPercent?: number
}) {
    const basePrice = Math.max(0, input.basePrice || 0)
    const overheadPercent = input.overheadPercent || 0
    const profitPercent = input.profitPercent || 0
    const taxPercent = input.taxPercent || 0

    const overheadAmount = basePrice * (overheadPercent / 100)
    const priceWithOverhead = basePrice + overheadAmount

    const profitAmount = priceWithOverhead * (profitPercent / 100)
    const priceWithProfit = priceWithOverhead + profitAmount

    const taxAmount = priceWithProfit * (taxPercent / 100)
    const finalPrice = priceWithProfit + taxAmount

    return {
        basePrice,
        overheadAmount,
        overheadPercent,
        priceWithOverhead,
        profitAmount,
        profitPercent,
        priceWithProfit,
        taxAmount,
        taxPercent,
        finalPrice: Number(finalPrice.toFixed(2)),
    }
}

function calculateComponentsTotal(components: Array<{
    coefficient: number
    unitPrice: number
    type?: string
}>) {
    let subtotal = 0
    const breakdown = { material: 0, labor: 0, equipment: 0, subcontractor: 0 }

    const detailedComponents = components.map(comp => {
        const coeff = Math.max(0, comp.coefficient || 0)
        const price = Math.max(0, comp.unitPrice || 0)
        const amount = coeff * price
        subtotal += amount

        switch (comp.type?.toLowerCase()) {
            case 'labor':
                breakdown.labor += amount
                break
            case 'equipment':
                breakdown.equipment += amount
                break
            case 'subcontractor':
            case 'subcon':
                breakdown.subcontractor += amount
                break
            default:
                breakdown.material += amount
        }

        return {
            coefficient: coeff,
            unitPrice: price,
            amount: Number(amount.toFixed(2)),
        }
    })

    return {
        subtotal: Number(subtotal.toFixed(2)),
        components: detailedComponents,
        breakdown: {
            material: Number(breakdown.material.toFixed(2)),
            labor: Number(breakdown.labor.toFixed(2)),
            equipment: Number(breakdown.equipment.toFixed(2)),
            subcontractor: Number(breakdown.subcontractor.toFixed(2)),
        }
    }
}

function calculateAHSPPrice(input: {
    components: Array<{ coefficient: number; unitPrice: number; type?: string }>
    overheadPercent?: number
    profitPercent?: number
}) {
    const componentResult = calculateComponentsTotal(input.components)
    const priceBreakdown = calculatePriceWithMarkup({
        basePrice: componentResult.subtotal,
        overheadPercent: input.overheadPercent,
        profitPercent: input.profitPercent,
        taxPercent: 0,
    })

    return {
        componentBreakdown: componentResult,
        priceBreakdown,
    }
}

function calculatePareto(items: Array<{
    id: string
    finalTotal?: number
    total_price?: number
}>) {
    if (!items.length) return []

    const sorted = [...items].sort(
        (a, b) => (b.finalTotal || b.total_price || 0) - (a.finalTotal || a.total_price || 0)
    )

    const totalCost = sorted.reduce(
        (sum, item) => sum + (item.finalTotal || item.total_price || 0),
        0
    )

    let runningTotal = 0
    return sorted.map(item => {
        const cost = item.finalTotal || item.total_price || 0
        runningTotal += cost
        const cumPercent = totalCost > 0 ? (runningTotal / totalCost) * 100 : 0

        let paretoClass: 'A' | 'B' | 'C' = 'C'
        if (cumPercent <= 80) paretoClass = 'A'
        else if (cumPercent <= 95) paretoClass = 'B'

        return { id: item.id, paretoClass }
    })
}

function calculateRABTotals(input: {
    items: Array<{ volume: number; unitPrice: number }>
    overheadPercent?: number
    profitPercent?: number
    taxPercent?: number
}) {
    const subtotal = input.items.reduce(
        (sum, item) => sum + (item.volume * item.unitPrice),
        0
    )

    const breakdown = calculatePriceWithMarkup({
        basePrice: subtotal,
        overheadPercent: input.overheadPercent,
        profitPercent: input.profitPercent,
        taxPercent: input.taxPercent,
    })

    return {
        itemCount: input.items.length,
        subtotal: Number(subtotal.toFixed(2)),
        ...breakdown,
    }
}

// ─── Bulk recalculate: processes multiple AHSP items at once ───

function recalculateAll(payload: {
    items: Array<{
        ahspId: string
        components: Array<{ coefficient: number; unitPrice: number; type?: string }>
        overheadPercent?: number
        profitPercent?: number
    }>
}) {
    return payload.items.map(item => ({
        ahspId: item.ahspId,
        result: calculateAHSPPrice({
            components: item.components,
            overheadPercent: item.overheadPercent,
            profitPercent: item.profitPercent,
        }),
    }))
}

// ─── Worker Message Handler ───

type WorkerRequest = {
    id: string
    type: 'calculateAHSPPrice' | 'calculatePareto' | 'recalculateAll' | 'calculateRABTotals'
    payload: unknown
}

self.onmessage = (ev: MessageEvent<WorkerRequest>) => {
    const { id, type, payload } = ev.data

    try {
        let result: unknown

        switch (type) {
            case 'calculateAHSPPrice':
                result = calculateAHSPPrice(payload as Parameters<typeof calculateAHSPPrice>[0])
                break
            case 'calculatePareto':
                result = calculatePareto((payload as { items: Parameters<typeof calculatePareto>[0] }).items)
                break
            case 'recalculateAll':
                result = recalculateAll(payload as Parameters<typeof recalculateAll>[0])
                break
            case 'calculateRABTotals':
                result = calculateRABTotals(payload as Parameters<typeof calculateRABTotals>[0])
                break
            default:
                throw new Error(`Unknown calculation type: ${type}`)
        }

        self.postMessage({ id, type, result })
    } catch (error: unknown) {
        self.postMessage({ id, type, result: null, error: (error as Error).message || 'Worker error' })
    }
}
