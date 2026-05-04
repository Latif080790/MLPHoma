import React from 'react'
import { cn } from '@/lib/utils'

interface CurrencyCellProps {
  value: number | undefined | null
  prefix?: string
  className?: string
  variant?: 'default' | 'positive' | 'negative' | 'neutral'
  showSign?: boolean
}

/**
 * CurrencyCell
 * 
 * Standardized IDR formatting for financial data.
 * Ensures consistent alignment and typography for monetary values.
 */
export const CurrencyCell: React.FC<CurrencyCellProps> = ({
  value,
  prefix = 'Rp',
  className,
  variant = 'default',
  showSign = false
}) => {
  if (value === undefined || value === null) {
    return <span className={cn("text-slate-400 font-mono", className)}>-</span>
  }

  const formatted = new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.abs(value))

  const sign = showSign && value !== 0 ? (value > 0 ? '+' : '-') : ''
  
  const variantStyles = {
    default: "text-slate-900 dark:text-slate-100",
    positive: "text-emerald-600 dark:text-emerald-400 font-medium",
    negative: "text-rose-600 dark:text-rose-400 font-medium",
    neutral: "text-slate-500 dark:text-slate-400"
  }

  return (
    <div className={cn(
      "font-mono text-right tabular-nums whitespace-nowrap",
      variantStyles[variant],
      className
    )}>
      <span className="text-[10px] opacity-60 mr-1 font-sans">{prefix}</span>
      <span>{sign}{formatted}</span>
    </div>
  )
}
