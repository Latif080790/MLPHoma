/**
 * RAB.tsx
 * RAB (Budget Estimation) module shell page.
 * Provides a clean layout and ensures all JSX tags are properly closed.
 */

import React from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Calculator } from 'lucide-react'

/** RAB module component */
export default function RAB() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">RAB Builder</h1>
        <Button className="gap-2">
          <Calculator className="h-4 w-4" />
          New Calculation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Overview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-lg border p-4 dark:border-neutral-800">
              <div className="text-sm text-neutral-500">Total Items</div>
              <div className="text-xl font-semibold">0</div>
            </div>
            <div className="rounded-lg border p-4 dark:border-neutral-800">
              <div className="text-sm text-neutral-500">Subtotal</div>
              <div className="text-xl font-semibold">Rp 0</div>
            </div>
            <div className="rounded-lg border p-4 dark:border-neutral-800">
              <div className="text-sm text-neutral-500">Final Total</div>
              <div className="text-xl font-semibold">Rp 0</div>
            </div>
          </div>
          <p className="mt-4 text-sm text-neutral-600 dark:text-neutral-400">
            Start by importing AHSP and adding RAB items linked to WBS. Calculations will account for overhead, profit, and tax.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
