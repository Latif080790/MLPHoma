/**
 * KeyboardShortcutsPanel.tsx
 *
 * NATA LABA · MLPHoma Platform
 * Keyboard shortcut cheatsheet overlay.
 * Triggered by: Shift + ?
 *
 * Mount once in App.tsx alongside GlobalCommandPalette.
 */

import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ShortcutGroup {
  label: string
  shortcuts: { keys: string[]; description: string }[]
}

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    label: 'Navigation',
    shortcuts: [
      { keys: ['Ctrl', 'K'], description: 'Open command palette' },
      { keys: ['Shift', '?'], description: 'Show keyboard shortcuts' },
      { keys: ['G', 'H'], description: 'Go to Command Center' },
      { keys: ['G', 'P'], description: 'Go to Projects' },
      { keys: ['G', 'S'], description: 'Go to Schedule' },
      { keys: ['G', 'F'], description: 'Go to Finance' },
    ],
  },
  {
    label: 'Actions',
    shortcuts: [
      { keys: ['Ctrl', 'N'], description: 'New item (context-aware)' },
      { keys: ['Ctrl', 'S'], description: 'Save current form' },
      { keys: ['Ctrl', 'Z'], description: 'Undo last change' },
      { keys: ['Ctrl', 'Shift', 'S'], description: 'Save & submit for approval' },
      { keys: ['Esc'], description: 'Close dialog / cancel' },
    ],
  },
  {
    label: 'Data & Tables',
    shortcuts: [
      { keys: ['Ctrl', 'F'], description: 'Search / filter table' },
      { keys: ['Ctrl', 'E'], description: 'Export current view' },
      { keys: ['Ctrl', 'P'], description: 'Print / print preview' },
      { keys: ['Alt', '1-9'], description: 'Switch to tab 1–9' },
    ],
  },
  {
    label: 'Cost Control',
    shortcuts: [
      { keys: ['Ctrl', 'Shift', 'R'], description: 'Refresh RAB prices' },
      { keys: ['Ctrl', 'Shift', 'A'], description: 'AHSP calculator' },
      { keys: ['Ctrl', 'Shift', 'E'], description: 'EVM dashboard' },
    ],
  },
]

export function KeyboardShortcutsPanel() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Shift + ? (key '?')
      if (e.shiftKey && e.key === '?') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[900] flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => setOpen(false)}
      />

      {/* Panel */}
      <div className="relative z-10 w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">Keyboard Shortcuts</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              MLPHoma Platform — press{' '}
              <kbd className="bg-slate-100 dark:bg-slate-800 rounded px-1 font-mono text-xs">Esc</kbd>{' '}
              to close
            </p>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="rounded-lg p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-slate-400"
            aria-label="Close shortcuts panel"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Shortcut groups */}
        <div className="grid grid-cols-2 gap-0 p-2">
          {SHORTCUT_GROUPS.map(group => (
            <div key={group.label} className="p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">
                {group.label}
              </h3>
              <div className="space-y-2">
                {group.shortcuts.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-600 dark:text-slate-300">{s.description}</span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {s.keys.map((key, ki) => (
                        <React.Fragment key={ki}>
                          {ki > 0 && <span className="text-slate-300 dark:text-slate-600 text-xs">+</span>}
                          <kbd className={cn(
                            'inline-flex items-center justify-center rounded border text-xs font-mono font-semibold px-1.5 py-0.5',
                            'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-600',
                            'text-slate-700 dark:text-slate-300 shadow-sm min-w-[24px]'
                          )}>
                            {key}
                          </kbd>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 rounded-b-2xl">
          <p className="text-xs text-slate-400 text-center">
            Press{' '}
            <kbd className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 font-mono text-xs">Shift</kbd>
            {' + '}
            <kbd className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded px-1 font-mono text-xs">?</kbd>
            {' to toggle this panel'}
          </p>
        </div>
      </div>
    </div>
  )
}

export default KeyboardShortcutsPanel
