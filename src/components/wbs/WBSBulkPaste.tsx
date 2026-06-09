import { useState, useCallback } from 'react'
import { X } from 'lucide-react'
import { parseBulkPasteText } from '../../lib/wbsCalculations'
import { Button } from '../ui/button'

export interface WBSBulkPasteProps {
  open: boolean
  parentCode: string | null
  onClose: () => void
  onImport: (nodes: Array<{ name: string; relativeDepth: number }>) => void
}

export function WBSBulkPaste({ open, parentCode, onClose, onImport }: WBSBulkPasteProps) {
  const [text, setText] = useState('')

  const parsed = parseBulkPasteText(text, parentCode)

  const handleImport = useCallback(() => {
    if (parsed.length === 0) return
    onImport(parsed)
    setText('')
    onClose()
  }, [parsed, onImport, onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') { onClose(); return }
    if (e.key === 'Tab') {
      e.preventDefault()
      const target = e.currentTarget
      const start = target.selectionStart
      const end = target.selectionEnd
      const newText = text.substring(0, start) + '\t' + text.substring(end)
      setText(newText)
      setTimeout(() => target.setSelectionRange(start + 1, start + 1), 0)
    }
  }, [text, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div
        className="relative z-10 w-full max-w-lg rounded-xl shadow-2xl p-5 flex flex-col gap-4"
        style={{ border: '1px solid var(--border-default)', background: 'var(--bg-surface)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Buat Massal</h3>
            <p className="text-[9px] text-[var(--text-muted)] mt-0.5">
              {parentCode ? `Di bawah ${parentCode}` : 'Root level'} · Tab = indent, Enter = item baru
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] p-1 rounded"
          >
            <X size={14} />
          </button>
        </div>

        {/* Textarea */}
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={'Ketik nama item, tekan Enter untuk baris baru.\nTab = satu level lebih dalam.\nShift+Tab = naik satu level.'}
          className="w-full h-40 rounded-lg text-[var(--text-secondary)] text-xs px-3 py-2.5 font-mono resize-none focus:outline-none focus:ring-1 focus:ring-[hsl(var(--amber-500))]"
          style={{
            border: '1px solid var(--border-default)',
            background: 'var(--bg-page)',
          }}
        />

        {/* Live preview */}
        {parsed.length > 0 && (
          <div
            className="rounded-lg p-3 max-h-36 overflow-y-auto"
            style={{ border: '1px solid var(--border-default)', background: 'var(--bg-page)' }}
          >
            <div className="text-[7px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-2">
              Preview — {parsed.length} item
            </div>
            {parsed.slice(0, 30).map((node, i) => (
              <div
                key={i}
                className="text-[8.5px] text-[var(--text-secondary)] leading-relaxed"
                style={{ paddingLeft: node.relativeDepth * 14 }}
              >
                <span className="text-[var(--text-muted)] mr-1">—</span>
                {node.name}
              </div>
            ))}
            {parsed.length > 30 && (
              <div className="text-[7px] text-[var(--text-muted)] mt-1">
                …dan {parsed.length - 30} item lainnya
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} className="text-xs h-8">
            Batal
          </Button>
          <Button
            size="sm"
            onClick={handleImport}
            disabled={parsed.length === 0}
            className="text-xs h-8 border-0 text-white"
            style={{ background: parsed.length === 0 ? undefined : 'hsl(var(--amber-500))' }}
          >
            Import {parsed.length > 0 ? `(${parsed.length})` : ''}
          </Button>
        </div>
      </div>
    </div>
  )
}
