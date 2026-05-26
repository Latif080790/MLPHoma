/**
 * ApprovalDelegateDialog.tsx
 * Dialog to create / remove an approval delegation (out-of-office routing).
 * When active, any approval request that would go to the delegator is instead
 * routed to the chosen delegate user.
 */

import React, { useState, useEffect } from 'react'
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { UserCheck, UserX, CalendarClock, ShieldOff, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { format, addDays, parseISO } from 'date-fns'
import { approvalService } from '@/services/approvalService'
import { useAuthStore } from '@/store/authStore'
import { assertSupabase } from '@/lib/supabaseClient'
import { APPROVAL_ENTITY_LABELS } from '@/types/approval'
import type { ApprovalEntityType } from '@/types/approval'

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

interface TeamMember {
    id: string
    full_name: string
    email: string
    role: string
}

interface ActiveDelegation {
    id: string
    delegateId: string
    delegateName: string
    entityTypes: string[]
    validFrom: string
    validUntil: string
}

interface Props {
    open: boolean
    onClose: () => void
    projectId: string
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

const ALL_ENTITY_TYPES = Object.keys(APPROVAL_ENTITY_LABELS) as ApprovalEntityType[]

function isoDateInputValue(iso: string): string {
    return iso.slice(0, 10)
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export function ApprovalDelegateDialog({ open, onClose, projectId }: Props) {
    const { user, profile } = useAuthStore()

    // -- team members list (used as delegate candidates)
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
    const [loadingTeam, setLoadingTeam] = useState(false)

    // -- active delegation for this user
    const [activeDelegation, setActiveDelegation] = useState<ActiveDelegation | null>(null)
    const [loadingActive, setLoadingActive] = useState(false)

    // -- form state
    const [selectedDelegateId, setSelectedDelegateId] = useState('')
    const [allEntityTypes, setAllEntityTypes] = useState(true)
    const [selectedEntityTypes, setSelectedEntityTypes] = useState<ApprovalEntityType[]>([])
    const [validFrom, setValidFrom] = useState(isoDateInputValue(new Date().toISOString()))
    const [validUntil, setValidUntil] = useState(isoDateInputValue(addDays(new Date(), 7).toISOString()))
    const [submitting, setSubmitting] = useState(false)
    const [removing, setRemoving] = useState(false)

    // ------------------------------------------------------------------
    // Load data when dialog opens
    // ------------------------------------------------------------------

    useEffect(() => {
        if (!open) return
        loadTeamMembers()
        loadActiveDelegation()
    }, [open, projectId])

    async function loadTeamMembers() {
        setLoadingTeam(true)
        try {
            const client = assertSupabase()
            // Load project members from profiles table
            const { data, error } = await client
                .from('profiles')
                .select('id, full_name, email, role')
                .neq('id', user?.id ?? '')
                .order('full_name')

            if (error) throw error
            setTeamMembers((data ?? []) as TeamMember[])
        } catch (e) {
            console.warn('[ApprovalDelegateDialog] loadTeamMembers:', e)
        } finally {
            setLoadingTeam(false)
        }
    }

    async function loadActiveDelegation() {
        if (!user?.id) return
        setLoadingActive(true)
        try {
            const client = assertSupabase()
            const now = new Date().toISOString()
            const { data, error } = await client
                .from('approval_delegates')
                .select('id, delegate_id, entity_types, valid_from, valid_until')
                .eq('delegator_id', user.id)
                .eq('project_id', projectId)
                .eq('is_active', true)
                .gte('valid_until', now)
                .order('valid_until', { ascending: false })
                .limit(1)
                .maybeSingle()

            if (error) throw error

            if (data) {
                // Resolve delegate display name
                const { data: profileData } = await assertSupabase()
                    .from('profiles')
                    .select('full_name')
                    .eq('id', data.delegate_id)
                    .maybeSingle()

                setActiveDelegation({
                    id: data.id,
                    delegateId: data.delegate_id,
                    delegateName: profileData?.full_name ?? data.delegate_id,
                    entityTypes: data.entity_types ?? [],
                    validFrom: data.valid_from,
                    validUntil: data.valid_until,
                })
            } else {
                setActiveDelegation(null)
            }
        } catch (e) {
            console.warn('[ApprovalDelegateDialog] loadActiveDelegation:', e)
        } finally {
            setLoadingActive(false)
        }
    }

    // ------------------------------------------------------------------
    // Actions
    // ------------------------------------------------------------------

    async function handleCreate() {
        if (!user?.id) return
        if (!selectedDelegateId) {
            toast.error('Pilih delegate terlebih dahulu')
            return
        }
        if (!allEntityTypes && selectedEntityTypes.length === 0) {
            toast.error('Pilih minimal satu tipe entitas')
            return
        }
        const fromDate = new Date(validFrom + 'T00:00:00')
        const untilDate = new Date(validUntil + 'T23:59:59')
        if (untilDate <= fromDate) {
            toast.error('Tanggal akhir harus setelah tanggal mulai')
            return
        }

        setSubmitting(true)
        try {
            await approvalService.setDelegate({
                projectId,
                delegatorId: user.id,
                delegateId: selectedDelegateId,
                entityTypes: allEntityTypes ? [] : selectedEntityTypes,
                validFrom: fromDate.toISOString(),
                validUntil: untilDate.toISOString(),
            })
            toast.success('Delegasi berhasil dibuat')
            await loadActiveDelegation()
            resetForm()
        } catch (e) {
            toast.error(`Gagal membuat delegasi: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setSubmitting(false)
        }
    }

    async function handleRemove() {
        if (!user?.id) return
        setRemoving(true)
        try {
            await approvalService.removeDelegate(user.id, projectId)
            toast.success('Delegasi berhasil dihapus')
            setActiveDelegation(null)
        } catch (e) {
            toast.error(`Gagal menghapus delegasi: ${e instanceof Error ? e.message : String(e)}`)
        } finally {
            setRemoving(false)
        }
    }

    function resetForm() {
        setSelectedDelegateId('')
        setAllEntityTypes(true)
        setSelectedEntityTypes([])
        setValidFrom(isoDateInputValue(new Date().toISOString()))
        setValidUntil(isoDateInputValue(addDays(new Date(), 7).toISOString()))
    }

    function toggleEntityType(type: ApprovalEntityType) {
        setSelectedEntityTypes(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        )
    }

    // ------------------------------------------------------------------
    // Render
    // ------------------------------------------------------------------

    const selectedDelegate = teamMembers.find(m => m.id === selectedDelegateId)

    return (
        <Dialog open={open} onOpenChange={v => { if (!v) onClose() }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <UserCheck className="w-5 h-5 text-blue-500" />
                        Delegasi Approval
                    </DialogTitle>
                    <DialogDescription>
                        Saat delegasi aktif, semua request approval yang ditujukan ke Anda akan diteruskan ke delegate yang dipilih.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-5 py-2">

                    {/* ---- Active Delegation Banner ---- */}
                    {loadingActive ? (
                        <div className="h-16 bg-muted animate-pulse rounded-lg" />
                    ) : activeDelegation ? (
                        <div className="flex items-start gap-3 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30">
                            <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                                    Delegasi Aktif
                                </p>
                                <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                                    Ke <span className="font-semibold">{activeDelegation.delegateName}</span>
                                    {activeDelegation.entityTypes.length > 0
                                        ? ` (${activeDelegation.entityTypes.length} tipe entitas)`
                                        : ' (semua tipe)'}
                                </p>
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                                    <CalendarClock className="w-3 h-3" />
                                    {format(parseISO(activeDelegation.validFrom), 'dd MMM yyyy')}
                                    {' — '}
                                    {format(parseISO(activeDelegation.validUntil), 'dd MMM yyyy')}
                                </p>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-600 hover:text-red-700 hover:bg-red-50 shrink-0"
                                onClick={handleRemove}
                                disabled={removing}
                            >
                                <ShieldOff className="w-4 h-4 mr-1" />
                                {removing ? 'Menghapus...' : 'Hapus'}
                            </Button>
                        </div>
                    ) : (
                        <div className="text-sm text-muted-foreground flex items-center gap-2">
                            <UserX className="w-4 h-4" />
                            Tidak ada delegasi aktif.
                        </div>
                    )}

                    <Separator />

                    {/* ---- Create New Delegation ---- */}
                    <p className="text-sm font-medium">Buat Delegasi Baru</p>

                    {/* Delegate selector */}
                    <div className="space-y-2">
                        <Label>Delegate (penerima approval)</Label>
                        {loadingTeam ? (
                            <div className="h-9 bg-muted animate-pulse rounded" />
                        ) : (
                            <ScrollArea className="h-36 border rounded-md p-2">
                                <div className="space-y-1">
                                    {teamMembers.length === 0 && (
                                        <p className="text-sm text-muted-foreground p-2">
                                            Tidak ada anggota tim ditemukan.
                                        </p>
                                    )}
                                    {teamMembers.map(member => (
                                        <button
                                            key={member.id}
                                            type="button"
                                            onClick={() => setSelectedDelegateId(
                                                selectedDelegateId === member.id ? '' : member.id
                                            )}
                                            className={[
                                                'w-full flex items-center gap-3 px-2 py-1.5 rounded text-sm text-left transition-colors',
                                                selectedDelegateId === member.id
                                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200'
                                                    : 'hover:bg-muted',
                                            ].join(' ')}
                                        >
                                            <div className="w-7 h-7 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium shrink-0">
                                                {member.full_name?.[0]?.toUpperCase() ?? '?'}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-medium truncate">{member.full_name}</p>
                                                <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                                            </div>
                                            {selectedDelegateId === member.id && (
                                                <Badge variant="secondary" className="ml-auto shrink-0">Dipilih</Badge>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    {/* Entity type scope */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <Switch
                                id="all-entity-types"
                                checked={allEntityTypes}
                                onCheckedChange={setAllEntityTypes}
                            />
                            <Label htmlFor="all-entity-types" className="cursor-pointer">
                                Semua tipe entitas
                            </Label>
                        </div>

                        {!allEntityTypes && (
                            <ScrollArea className="h-40 border rounded-md p-3">
                                <div className="grid grid-cols-1 gap-2">
                                    {ALL_ENTITY_TYPES.map(type => (
                                        <div key={type} className="flex items-center gap-2">
                                            <Checkbox
                                                id={`et-${type}`}
                                                checked={selectedEntityTypes.includes(type)}
                                                onCheckedChange={() => toggleEntityType(type)}
                                            />
                                            <Label htmlFor={`et-${type}`} className="cursor-pointer text-sm font-normal">
                                                {APPROVAL_ENTITY_LABELS[type]}
                                            </Label>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    {/* Date range */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label>Mulai</Label>
                            <Input
                                type="date"
                                value={validFrom}
                                onChange={e => setValidFrom(e.target.value)}
                                min={isoDateInputValue(new Date().toISOString())}
                            />
                        </div>
                        <div className="space-y-1">
                            <Label>Berakhir</Label>
                            <Input
                                type="date"
                                value={validUntil}
                                onChange={e => setValidUntil(e.target.value)}
                                min={validFrom}
                            />
                        </div>
                    </div>

                    {/* Preview */}
                    {selectedDelegate && (
                        <div className="text-xs text-muted-foreground bg-muted/50 rounded p-3 space-y-1">
                            <p>
                                Semua approval yang ditujukan ke <strong>{profile?.full_name ?? 'Anda'}</strong> akan diteruskan ke{' '}
                                <strong>{selectedDelegate.full_name}</strong>
                                {allEntityTypes ? ' untuk semua tipe' : ` untuk ${selectedEntityTypes.length} tipe`}.
                            </p>
                            <p>
                                Berlaku dari {format(new Date(validFrom + 'T00:00:00'), 'dd MMM yyyy')}
                                {' s/d '}
                                {format(new Date(validUntil + 'T23:59:59'), 'dd MMM yyyy')}.
                            </p>
                        </div>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={submitting}>
                        Tutup
                    </Button>
                    <Button
                        onClick={handleCreate}
                        disabled={submitting || !selectedDelegateId}
                    >
                        <UserCheck className="w-4 h-4 mr-2" />
                        {submitting ? 'Menyimpan...' : 'Aktifkan Delegasi'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
