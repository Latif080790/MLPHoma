/**
 * ModuleHeader.tsx
 * Consistent header for each module page with icon, title, description, and right-aligned actions.
 */

import React from "react"
import { cn } from "@/lib/utils"

/** Accent colour variants — controls the gradient bar + icon glow */
export type ModuleHeaderAccent =
  | 'blue' | 'emerald' | 'rose' | 'indigo' | 'amber'
  | 'teal' | 'violet' | 'cyan' | 'fuchsia' | 'orange' | 'default'

const ACCENT: Record<ModuleHeaderAccent, { bar: string; icon: string; glow: string }> = {
  default:  { bar: 'from-slate-400 to-slate-500',   icon: 'bg-slate-100   dark:bg-slate-800   text-slate-600   dark:text-slate-300',   glow: 'shadow-slate-400/20' },
  blue:     { bar: 'from-blue-500 to-indigo-500',    icon: 'bg-blue-50     dark:bg-blue-950/60  text-blue-600    dark:text-blue-400',    glow: 'shadow-blue-500/25'  },
  emerald:  { bar: 'from-emerald-400 to-teal-500',   icon: 'bg-emerald-50  dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400', glow: 'shadow-emerald-500/25' },
  rose:     { bar: 'from-rose-500 to-pink-500',      icon: 'bg-rose-50     dark:bg-rose-950/60  text-rose-600    dark:text-rose-400',    glow: 'shadow-rose-500/25'  },
  indigo:   { bar: 'from-indigo-500 to-violet-500',  icon: 'bg-indigo-50   dark:bg-indigo-950/60 text-indigo-600  dark:text-indigo-400', glow: 'shadow-indigo-500/25' },
  amber:    { bar: 'from-amber-400 to-orange-500',   icon: 'bg-amber-50    dark:bg-amber-950/60 text-amber-600   dark:text-amber-400',   glow: 'shadow-amber-500/25' },
  teal:     { bar: 'from-teal-400 to-cyan-500',      icon: 'bg-teal-50     dark:bg-teal-950/60  text-teal-600    dark:text-teal-400',    glow: 'shadow-teal-500/25'  },
  violet:   { bar: 'from-violet-500 to-purple-600',  icon: 'bg-violet-50   dark:bg-violet-950/60 text-violet-600  dark:text-violet-400', glow: 'shadow-violet-500/25' },
  cyan:     { bar: 'from-cyan-400 to-blue-500',      icon: 'bg-cyan-50     dark:bg-cyan-950/60  text-cyan-600    dark:text-cyan-400',    glow: 'shadow-cyan-500/25'  },
  fuchsia:  { bar: 'from-fuchsia-500 to-pink-600',   icon: 'bg-fuchsia-50  dark:bg-fuchsia-950/60 text-fuchsia-600 dark:text-fuchsia-400', glow: 'shadow-fuchsia-500/25' },
  orange:   { bar: 'from-orange-400 to-red-500',     icon: 'bg-orange-50   dark:bg-orange-950/60 text-orange-600  dark:text-orange-400', glow: 'shadow-orange-500/25' },
}

export interface ModuleHeaderProps {
  icon?: React.ReactNode
  title: string
  description?: string
  actions?: React.ReactNode
  /** Colour accent — matches the sidebar icon colour for this module */
  accent?: ModuleHeaderAccent
  /** @deprecated use accent instead */
  backUrl?: string
  /** @deprecated no longer rendered */
  showBackButton?: boolean
}

export function ModuleHeader({
  icon,
  title,
  description,
  actions,
  accent = 'default',
}: ModuleHeaderProps) {
  const a = ACCENT[accent]

  return (
    <div className="relative mb-5 overflow-hidden rounded-xl border border-slate-200/70 dark:border-slate-700/50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm shadow-sm">
      {/* Top gradient accent bar */}
      <div className={cn('absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r', a.bar)} />

      <div className="flex flex-col gap-3 px-5 py-4 pt-5 md:flex-row md:items-center md:justify-between">
        {/* Left: icon + text */}
        <div className="flex items-center gap-3.5">
          {icon && (
            <div className={cn(
              'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-lg ring-1 ring-inset ring-white/20',
              a.icon, a.glow
            )}>
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight text-slate-900 dark:text-slate-50 leading-tight">
              {title}
            </h1>
            {description && (
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed truncate max-w-xl">
                {description}
              </p>
            )}
          </div>
        </div>

        {/* Right: actions */}
        {actions && (
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}

export default ModuleHeader
