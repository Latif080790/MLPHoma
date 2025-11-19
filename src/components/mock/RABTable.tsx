/**
 * src/components/mock/RABTable.tsx
 *
 * Enhanced RAB table with inline-edit (volume & unit_price), remove, export hooks,
 * and integrated HistoryPanel (undo/redo).
 */

import React, { useMemo, useRef } from 'react'
import useRabStore from '../../store/rabStore'
import { mockProject } from '../../lib/mockData'
import { computeItemTotals } from '../../lib/rabUtils'
import notify from '../../lib/toast'
import RABExport from '../rab/RABExport'
import HistoryPanel from '../rab/HistoryPanel'

/**
 * Format number to Rupiah-like string
 * @param n number
 */
function fmt(n: number) {
  return n.toLocaleString('id-ID', { maximumFractionDigits: 0 })
}

/**
 * RABTable component
 */
export default function RABTable() {
  const projectId = mockProject.project_id
  const getItems = useRabStore((s) => s.getItems)
  const updateItem = useRabStore((s) => s.updateItem)
  const removeItem = useRabStore((s) => s.removeItem)

  // ambil items dari store
  const items = getItems(projectId)

  const tableRef = useRef<HTMLDivElement | null>(null)

  const totals = useMemo(
    () =>
      (items || []).map((it) => {
        const { subtotal, finalTotal } = computeItemTotals({
          item_name: it.item_name || it.name || 'Item',
          unit: it.unit || '',
          volume: it.volume || 0,
          unit_price: it.unit_price || 0,
        })
        return { it, subtotal, finalTotal }
      }),
    [items]
  )

  const projectTotal = totals.reduce((s, t) => s + t.finalTotal, 0)

  /**
   * onInlineChange
   * Commit inline edits to store.
   *
   * @param id string
   * @param field 'volume' | 'unit_price'
   * @param value string
   */
  function onInlineChange(id: string, field: 'volume' | 'unit_price', value: string) {
    const num = Number(value || 0)
    if (Number.isNaN(num)) {
      notify.error('Nilai tidak valid')
      return
    }
    updateItem(projectId, id, { [field]: num })
    notify.success('Updated')
  }

  return (
    <div className="bg-white rounded-lg shadow p-4" ref={tableRef}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold">RAB Summary — {mockProject.project_name}</h3>
          <div className="text-xs text-neutral-500">Edit volume & unit price inline. Perubahan akan tersimpan otomatis.</div>
        </div>
        <div className="flex items-center gap-2">
          <RABExport tableId="rab-table" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 mb-4">
        <div className="lg:col-span-3">
          <div className="overflow-x-auto">
            <table id="rab-table" className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-2">Item</th>
                  <th>Unit</th>
                  <th className="text-right">Volume</th>
                  <th className="text-right">Unit Price</th>
                  <th className="text-right">Subtotal</th>
                  <th className="text-right">Final Total</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {totals.map(({ it, subtotal, finalTotal }) => (
                  <tr key={it.id} className="border-t">
                    <td className="py-2">{it.item_name}</td>
                    <td>{it.unit}</td>
                    <td className="text-right">
                      <input
                        aria-label={`volume-${it.id}`}
                        className="w-20 text-right border rounded px-2 py-1 text-sm"
                        value={String(it.volume ?? 0)}
                        onChange={(e) => updateItem(projectId, it.id || '', { volume: Number(e.target.value || 0) })}
                        onBlur={(e) => onInlineChange(it.id || '', 'volume', e.target.value)}
                      />
                    </td>
                    <td className="text-right">
                      <input
                        aria-label={`unit_price-${it.id}`}
                        className="w-28 text-right border rounded px-2 py-1 text-sm"
                        value={String(it.unit_price ?? 0)}
                        onChange={(e) => updateItem(projectId, it.id || '', { unit_price: Number(e.target.value || 0) })}
                        onBlur={(e) => onInlineChange(it.id || '', 'unit_price', e.target.value)}
                      />
                    </td>
                    <td className="text-right">Rp {fmt(subtotal)}</td>
                    <td className="text-right font-semibold">Rp {fmt(finalTotal)}</td>
                    <td className="text-right">
                      <button
                        className="text-sm text-red-600 hover:underline"
                        onClick={() => {
                          removeItem(projectId, it.id || '')
                          notify.success('Item removed')
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}

                {totals.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-6 text-center text-neutral-500">
                      No RAB items yet — use AHSP generator or import to add items.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t">
                  <td className="py-3" colSpan={6}>
                    <div className="text-right font-semibold">Project Total</div>
                  </td>
                  <td className="text-right font-bold">Rp {fmt(projectTotal)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div>
          <HistoryPanel projectId={projectId} />
        </div>
      </div>
    </div>
  )
}