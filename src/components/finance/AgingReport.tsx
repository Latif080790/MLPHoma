/**
 * AgingReport.tsx
 * Aging report showing overdue buckets for AP invoices.
 */

import React from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { AgingBucket } from "@/store/financeStore"
import { Invoice } from "@/types/finance"
import { format } from "date-fns"

interface AgingReportProps {
  aging: AgingBucket
}

function BucketTable({ title, invoices, color }: { title: string; invoices: Invoice[]; color: string }) {
  if (invoices.length === 0) return null
  return (
    <div className="space-y-1">
      <h4 className={`text-xs uppercase tracking-wider font-semibold ${color}`}>{title} ({invoices.length})</h4>
      <div className="space-y-1">
        {invoices.map(inv => (
          <div key={inv.id} className="flex items-center justify-between py-1.5 px-2 rounded-md bg-muted/30 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">{inv.vendor_name}</span>
              <span className="text-muted-foreground text-xs">{inv.invoice_number}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground">Due: {format(new Date(inv.due_date), 'dd MMM yyyy')}</span>
              <span className="font-mono font-semibold">Rp {inv.total_amount.toLocaleString()}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function AgingReport({ aging }: AgingReportProps) {
  const total = aging.totalCurrent + aging.total30 + aging.total60 + aging.total90plus
  if (total === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground text-sm">
          No outstanding invoices.
        </CardContent>
      </Card>
    )
  }

  const buckets = [
    { label: 'Current', amount: aging.totalCurrent, color: 'text-green-600', bg: 'bg-green-100' },
    { label: '1-30 Days', amount: aging.total30, color: 'text-yellow-600', bg: 'bg-yellow-100' },
    { label: '31-60 Days', amount: aging.total60, color: 'text-orange-600', bg: 'bg-orange-100' },
    { label: '90+ Days', amount: aging.total90plus, color: 'text-red-600', bg: 'bg-red-100' }
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>AP Aging Report</span>
          <Badge variant="outline" className="font-normal">Outstanding: Rp {total.toLocaleString()}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Aging bar */}
        <div className="flex h-5 rounded-full overflow-hidden">
          {buckets.map((b, i) => {
            const pct = total > 0 ? (b.amount / total) * 100 : 0
            if (pct === 0) return null
            return (
              <div
                key={i}
                className={`${b.bg} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${b.label}: Rp ${b.amount.toLocaleString()} (${pct.toFixed(1)}%)`}
              />
            )
          })}
        </div>

        {/* Bucket cards */}
        <div className="grid grid-cols-4 gap-3">
          {buckets.map((b, i) => (
            <div key={i} className="text-center p-2 rounded-lg bg-muted/50">
              <div className={`text-xs uppercase tracking-wider font-semibold ${b.color}`}>{b.label}</div>
              <div className="text-lg font-bold mt-1">Rp {b.amount.toLocaleString()}</div>
            </div>
          ))}
        </div>

        {/* Detail lists */}
        <div className="space-y-4">
          <BucketTable title="Current (Not Yet Due)" invoices={aging.current} color="text-green-600" />
          <BucketTable title="1-30 Days Overdue" invoices={aging.days30} color="text-yellow-600" />
          <BucketTable title="31-60 Days Overdue" invoices={aging.days60} color="text-orange-600" />
          <BucketTable title="90+ Days Overdue" invoices={aging.days90plus} color="text-red-600" />
        </div>
      </CardContent>
    </Card>
  )
}
