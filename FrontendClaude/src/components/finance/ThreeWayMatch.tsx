/**
 * ThreeWayMatch.tsx
 * 3-Way Matching view: PO ↔ GRN ↔ Invoice comparison.
 * Helps verify that what was ordered, received, and invoiced are consistent.
 */

import React, { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle, XCircle, AlertTriangle } from "lucide-react"
import { Invoice } from "@/types/finance"
import { financeService } from "@/services/financeService"
import { toast } from "sonner"

interface MatchRecord {
  po_id: string
  po_number: string
  vendor: string
  po_amount: number
  po_status: string
  grn_count: number
  grn_total_amount: number
  invoice_count: number
  invoice_total_amount: number
  match_status: 'MATCHED' | 'PARTIAL' | 'MISMATCH' | 'PENDING'
  variance: number
}

interface ThreeWayMatchProps {
  projectId: string
  invoices: Invoice[]
}

export function ThreeWayMatch({ projectId, invoices }: ThreeWayMatchProps) {
  const [records, setRecords] = useState<MatchRecord[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (projectId) loadMatchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  async function loadMatchData() {
    setLoading(true)
    try {
      const { pos, grns } = await financeService.getThreeWayMatchData(projectId)

      if (!pos || pos.length === 0) {
        setRecords([])
        setLoading(false)
        return
      }

      const poIds = pos.map(po => po.id)
      
      // Get Invoices linked to these POs
      const poInvoices = invoices.filter(inv => inv.po_id && poIds.includes(inv.po_id))

      // Build match records
      const matchRecords: MatchRecord[] = pos.map(po => {
        const poGrns = (grns || []).filter(g => g.po_id === po.id)
        const poInvs = poInvoices.filter(i => i.po_id === po.id)

        const grnTotal = poGrns.reduce((s, g) => s + (g.total_amount || 0), 0)
        const invTotal = poInvs.reduce((s, i) => s + (i.total_amount || 0), 0)
        const poAmount = po.total_amount || 0

        const variance = Math.abs(poAmount - invTotal)
        const grnVariance = Math.abs(poAmount - grnTotal)

        let match_status: MatchRecord['match_status'] = 'PENDING'
        if (poGrns.length > 0 && poInvs.length > 0) {
          if (variance < 1 && grnVariance < 1) {
            match_status = 'MATCHED'
          } else if (invTotal > 0 || grnTotal > 0) {
            match_status = variance / poAmount > 0.05 ? 'MISMATCH' : 'PARTIAL'
          }
        } else if (poGrns.length > 0 || poInvs.length > 0) {
          match_status = 'PARTIAL'
        }

        return {
          po_id: po.id,
          po_number: po.po_number || po.id.substring(0, 8),
          vendor: po.vendor_name || '-',
          po_amount: poAmount,
          po_status: po.status,
          grn_count: poGrns.length,
          grn_total_amount: grnTotal,
          invoice_count: poInvs.length,
          invoice_total_amount: invTotal,
          match_status,
          variance
        }
      })

      setRecords(matchRecords)
    } catch {
      toast.error('Failed to load 3-way match data')
    } finally {
      setLoading(false)
    }
  }

  const statusIcon = (status: MatchRecord['match_status']) => {
    switch (status) {
      case 'MATCHED': return <CheckCircle className="text-green-500" size={16} />
      case 'PARTIAL': return <AlertTriangle className="text-yellow-500" size={16} />
      case 'MISMATCH': return <XCircle className="text-red-500" size={16} />
      default: return <AlertTriangle className="text-gray-400" size={16} />
    }
  }

  const statusBadge = (status: MatchRecord['match_status']) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      MATCHED: 'default',
      PARTIAL: 'secondary',
      MISMATCH: 'destructive',
      PENDING: 'outline'
    }
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>
  }

  const matched = records.filter(r => r.match_status === 'MATCHED').length
  const mismatched = records.filter(r => r.match_status === 'MISMATCH').length
  const partial = records.filter(r => r.match_status === 'PARTIAL').length

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>3-Way Matching (PO ↔ GRN ↔ Invoice)</span>
          <div className="flex gap-2 text-xs">
            <Badge variant="default" className="font-normal">{matched} Matched</Badge>
            <Badge variant="secondary" className="font-normal">{partial} Partial</Badge>
            {mismatched > 0 && <Badge variant="destructive" className="font-normal">{mismatched} Mismatch</Badge>}
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-muted-foreground text-sm">Loading...</p>
        ) : records.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No purchase orders found for this project.</p>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>PO Number</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">PO Amount</TableHead>
                  <TableHead className="text-right">GRN Total</TableHead>
                  <TableHead className="text-right">Invoice Total</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => (
                  <TableRow key={r.po_id} className={r.match_status === 'MISMATCH' ? 'bg-red-50 dark:bg-red-950/20' : ''}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {statusIcon(r.match_status)}
                        {statusBadge(r.match_status)}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">{r.po_number}</TableCell>
                    <TableCell>{r.vendor}</TableCell>
                    <TableCell className="text-right font-mono">Rp {r.po_amount.toLocaleString()}</TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={r.grn_count === 0 ? 'text-muted-foreground' : ''}>
                        Rp {r.grn_total_amount.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">({r.grn_count} GRN)</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      <span className={r.invoice_count === 0 ? 'text-muted-foreground' : ''}>
                        Rp {r.invoice_total_amount.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground ml-1">({r.invoice_count} inv)</span>
                    </TableCell>
                    <TableCell className={`text-right font-mono ${r.variance > 0 ? 'text-red-600 font-bold' : 'text-green-600'}`}>
                      {r.variance > 0 ? `Rp ${r.variance.toLocaleString()}` : '✓'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
