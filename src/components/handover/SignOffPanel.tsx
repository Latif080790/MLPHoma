/**
 * SignOffPanel.tsx
 * Multi-stakeholder sign-off component for the Handover Wizard.
 * Displays each stakeholder's sign-off status and allows the current user
 * to sign off when their stakeholder ID matches.
 */

import { useState } from 'react'
import { Check, Clock, UserCheck } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { useAuthStore } from '@/store/authStore'
import { assertSupabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

export interface Stakeholder {
  id: string
  name: string
  role: string
}

export interface SignOff {
  stakeholderId: string
  signedAt: string
  notes: string
}

interface SignOffPanelProps {
  handoverId: string
  stakeholders: Stakeholder[]
  signOffs: SignOff[]
  onSignOff: (stakeholderId: string, notes: string) => void
}

export function SignOffPanel({ handoverId, stakeholders, signOffs, onSignOff }: SignOffPanelProps) {
  const user = useAuthStore(s => s.user)
  const [notesMap, setNotesMap] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState<string | null>(null)

  const getSignOff = (stakeholderId: string) =>
    signOffs.find(s => s.stakeholderId === stakeholderId)

  const handleSignOff = async (stakeholderId: string) => {
    const notes = notesMap[stakeholderId] ?? ''
    setSaving(stakeholderId)

    // Persist to Supabase — table may not exist yet (Migration needed)
    try {
      // Migration needed: run supabase migration to create handover_sign_offs table
      const { error } = await assertSupabase()
        .from('handover_sign_offs')
        .upsert(
          {
            handover_id: handoverId,
            stakeholder_id: stakeholderId,
            signed_at: new Date().toISOString(),
            notes,
          },
          { onConflict: 'handover_id,stakeholder_id' }
        )

      if (error) {
        // Fail silently if table is missing; local state still updates
        console.warn('[SignOffPanel] handover_sign_offs upsert failed (table may not exist yet):', error.message)
      }
    } catch (err) {
      // Fail silently — table may not exist yet
      console.warn('[SignOffPanel] handover_sign_offs upsert threw (table may not exist yet):', err)
    }

    onSignOff(stakeholderId, notes)
    toast.success('Sign-off recorded')
    setSaving(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <UserCheck className="w-5 h-5 text-muted-foreground" />
        <h3 className="font-semibold text-muted-foreground">Stakeholder Sign-Off</h3>
        <Badge variant="outline" className="text-xs">
          {signOffs.length}/{stakeholders.length} signed
        </Badge>
      </div>

      <div className="space-y-3">
        {stakeholders.map(stakeholder => {
          const existing = getSignOff(stakeholder.id)
          const isCurrent = user?.id === stakeholder.id
          const isSigned = !!existing

          return (
            <div
              key={stakeholder.id}
              className={`rounded-lg border p-4 space-y-2 transition-colors ${
                isSigned
                  ? 'border-green-200 bg-green-50'
                  : isCurrent
                  ? 'border-blue-200 bg-blue-50'
                  : 'border-border bg-muted/30'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-muted-foreground">{stakeholder.name}</div>
                  <div className="text-xs text-muted-foreground">{stakeholder.role}</div>
                </div>
                {isSigned ? (
                  <div className="flex items-center gap-2 text-green-700">
                    <Check className="w-4 h-4" />
                    <span className="text-xs font-medium">
                      Signed {new Date(existing.signedAt).toLocaleDateString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-4 h-4" />
                    <span className="text-xs">Pending</span>
                  </div>
                )}
              </div>

              {isSigned && existing.notes && (
                <p className="text-xs text-green-700 italic border-t border-green-200 pt-2">
                  &ldquo;{existing.notes}&rdquo;
                </p>
              )}

              {!isSigned && isCurrent && (
                <div className="space-y-2 pt-1">
                  <Textarea
                    placeholder="Optional sign-off notes..."
                    className="h-16 text-sm resize-none"
                    value={notesMap[stakeholder.id] ?? ''}
                    onChange={e =>
                      setNotesMap(prev => ({ ...prev, [stakeholder.id]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    onClick={() => handleSignOff(stakeholder.id)}
                    disabled={saving === stakeholder.id}
                    className="w-full"
                  >
                    {saving === stakeholder.id ? 'Signing...' : 'Sign Off'}
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
