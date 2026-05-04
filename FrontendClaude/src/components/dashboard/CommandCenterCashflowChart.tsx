import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

type CashflowPoint = {
  week: string
  inflow: number
  outflow: number
}

interface CommandCenterCashflowChartProps {
  isPortfolioMode: boolean
  cashflow: CashflowPoint[]
}

export default function CommandCenterCashflowChart({ isPortfolioMode, cashflow }: CommandCenterCashflowChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={isPortfolioMode ? [] : cashflow} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          {isPortfolioMode ? (
            <text x="50%" y="50%" textAnchor="middle" fill="#94a3b8" fontSize="12" fontStyle="italic">
              Consolidation of multi-project cashflow in progress...
            </text>
          ) : (
            <>
              <defs>
                <linearGradient id="colorInflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#009E73" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#009E73" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorOutflow" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#CC6600" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#CC6600" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--muted-foreground)/0.1)" />
              <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
              <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--popover))', borderColor: 'hsl(var(--border))', borderRadius: '8px', fontSize: '12px' }} />
              <Area type="monotone" dataKey="inflow" stroke="#009E73" strokeWidth={2} fillOpacity={1} fill="url(#colorInflow)" name="Projected Inflow" />
              <Area type="monotone" dataKey="outflow" stroke="#CC6600" strokeWidth={2} fillOpacity={1} fill="url(#colorOutflow)" name="Est. Outflow" />
            </>
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
