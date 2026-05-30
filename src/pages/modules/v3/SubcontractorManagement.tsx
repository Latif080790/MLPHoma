import React, { useState, useEffect, useCallback } from 'react'
import { Users, FileText, ClipboardList, TrendingUp, Plus, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip } from '@/components/patterns'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useProjectStore } from '@/store/projectStore'
import { subcontractorService } from '@/services/subcontractorService'
import type { SubcontractorInfo, SPK, Opname } from '@/services/subcontractorService'
import ModulePageState from '@/components/common/ModulePageState'

// ─── Status badges ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE:              { label: 'Aktif',          cls: 'bg-green-500/10 text-green-400 border border-green-500/20' },
    DRAFT:               { label: 'Draft',          cls: 'bg-white/[0.06] text-white/40 border border-white/10' },
    COMPLETED:           { label: 'Selesai',        cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
    TERMINATED:          { label: 'Terminasi',      cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
    SUBMITTED:           { label: 'Diajukan',       cls: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' },
    APPROVED:            { label: 'Disetujui',      cls: 'bg-green-500/10 text-green-400 border border-green-500/20' },
    REJECTED:            { label: 'Ditolak',        cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
    POSTED_TO_FINANCE:   { label: 'Posting AP',     cls: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' },
    INACTIVE:            { label: 'Nonaktif',       cls: 'bg-white/[0.06] text-white/40 border border-white/10' },
    BLACKLISTED:         { label: 'Blacklist',      cls: 'bg-red-500/10 text-red-400 border border-red-500/20' },
  }
  const cfg = map[status] ?? { label: status, cls: 'bg-surface-subtle text-secondary' }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ─── Format currency ──────────────────────────────────────────────────────────
function fmtIDR(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`
}

// ─── SPK Card ─────────────────────────────────────────────────────────────────
function SPKCard({ spk, opnames, subcons }: { spk: SPK; opnames: Opname[]; subcons: SubcontractorInfo[] }) {
  const spkOpnames = opnames.filter(o => o.spkId === spk.id && o.status !== 'REJECTED')
  const totalProgress = spkOpnames.reduce((s, o) => s + o.currentPeriodProgressPercentage, 0)
  const totalPaid = spkOpnames.filter(o => o.status === 'APPROVED' || o.status === 'POSTED_TO_FINANCE').reduce((s, o) => s + o.netPayable, 0)
  const subcon = subcons.find(s => s.id === spk.subconId)

  return (
    <div className="rounded-radius-md border border-border-subtle bg-surface p-padding-sm hover:border-border-hover transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-secondary">{spk.spkNumber}</span>
            <StatusBadge status={spk.status} />
          </div>
          <p className="mt-1 text-sm font-medium text-primary truncate">{spk.description}</p>
          <p className="text-xs text-secondary mt-0.5">{subcon?.name ?? spk.subconId}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-semibold text-primary">{fmtIDR(spk.contractValue)}</p>
          <p className="text-xs text-secondary">Nilai Kontrak</p>
        </div>
      </div>
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-secondary mb-1">
          <span>Progress</span>
          <span>{totalProgress.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-subtle overflow-hidden">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${Math.min(totalProgress, 100)}%` }} />
        </div>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-secondary">
        <span>{spkOpnames.length} opname</span>
        <span>Terbayar: {fmtIDR(totalPaid)}</span>
      </div>
    </div>
  )
}

// ─── Opname Row ────────────────────────────────────────────────────────────────
function OpnameRow({ opname, spkNumber }: { opname: Opname; spkNumber: string }) {
  const statusIcon = opname.status === 'APPROVED' || opname.status === 'POSTED_TO_FINANCE'
    ? <CheckCircle size={14} className="text-success" />
    : opname.status === 'REJECTED'
    ? <XCircle size={14} className="text-destructive" />
    : opname.status === 'SUBMITTED'
    ? <Clock size={14} className="text-warning" />
    : <AlertCircle size={14} className="text-secondary" />

  return (
    <tr className="border-b border-border-subtle hover:bg-surface-subtle/50 transition-colors">
      <td className="px-3 py-2 text-xs font-mono text-secondary">{spkNumber}</td>
      <td className="px-3 py-2 text-xs text-primary">Periode {opname.periodNumber}</td>
      <td className="px-3 py-2 text-xs text-right">{opname.progressPercentage.toFixed(1)}%</td>
      <td className="px-3 py-2 text-xs text-right">{fmtIDR(opname.grossAmount)}</td>
      <td className="px-3 py-2 text-xs text-right text-warning-fg">-{fmtIDR(opname.retentionDeduction)}</td>
      <td className="px-3 py-2 text-xs text-right font-medium">{fmtIDR(opname.netPayable)}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1">
          {statusIcon}
          <StatusBadge status={opname.status} />
        </div>
      </td>
    </tr>
  )
}

// ─── Add Vendor Dialog ─────────────────────────────────────────────────────────
interface AddVendorDialogProps {
  open: boolean
  projectId: string
  onClose: () => void
  onSaved: () => void
}

function AddVendorDialog({ open, projectId, onClose, onSaved }: AddVendorDialogProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState<'MANDOR' | 'SUBCON'>('SUBCON')
  const [specialty, setSpecialty] = useState('')
  const [phone, setPhone] = useState('')
  const [bankAccount, setBankAccount] = useState('')
  const [status, setStatus] = useState<SubcontractorInfo['status']>('ACTIVE')
  const [saving, setSaving] = useState(false)

  const reset = () => {
    setName(''); setType('SUBCON'); setSpecialty(''); setPhone(''); setBankAccount(''); setStatus('ACTIVE')
  }

  const handleClose = () => { reset(); onClose() }

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Nama vendor wajib diisi'); return }
    setSaving(true)
    try {
      await subcontractorService.createSubcon(
        { name: name.trim(), type, specialty: specialty.trim(), phone: phone.trim(), bankAccount: bankAccount.trim(), rating: 0, status },
        projectId
      )
      reset()
      onSaved()
      onClose()
    } catch (err) {
      toast.error(`Gagal menyimpan: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Vendor / Mandor</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nama Perusahaan / Mandor *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="PT Maju Jaya / Pak Budi" />
          </div>
          <div className="space-y-1.5">
            <Label>Tipe</Label>
            <Select value={type} onValueChange={v => setType(v as 'MANDOR' | 'SUBCON')}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="SUBCON">Subkontraktor</SelectItem>
                <SelectItem value="MANDOR">Mandor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Spesialisasi</Label>
            <Input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="Bekisting, Besi, MEP, dll." />
          </div>
          <div className="space-y-1.5">
            <Label>Nomor HP / Telp</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="0812-xxxx-xxxx" />
          </div>
          <div className="space-y-1.5">
            <Label>Rekening Bank</Label>
            <Input value={bankAccount} onChange={e => setBankAccount(e.target.value)} placeholder="BRI 1234-5678-9012" />
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={v => setStatus(v as SubcontractorInfo['status'])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Aktif</SelectItem>
                <SelectItem value="INACTIVE">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>Batal</Button>
          <Button onClick={handleSubmit} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SubcontractorManagement() {
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const projects = useProjectStore(s => s.projects)
  const [tab, setTab] = useState<'vendors' | 'spk' | 'opname'>('vendors')

  const [subcons, setSubcons] = useState<SubcontractorInfo[]>([])
  const [spks, setSpks] = useState<SPK[]>([])
  const [allOpnames, setAllOpnames] = useState<Opname[]>([])
  const [loading, setLoading] = useState(false)
  const [showAddVendor, setShowAddVendor] = useState(false)

  const activeProject = activeProjectId ? projects[activeProjectId] : null

  const loadData = useCallback(async () => {
    if (!activeProjectId) return
    setLoading(true)
    try {
      const [fetchedSubcons, fetchedSpks] = await Promise.all([
        subcontractorService.getSubcons(),
        subcontractorService.getSPKs(activeProjectId),
      ])
      setSubcons(fetchedSubcons)
      setSpks(fetchedSpks)

      // Fetch opnames for all SPKs
      const opnameResults = await Promise.all(
        fetchedSpks.map(spk => subcontractorService.getOpnamesBySPK(spk.id))
      )
      setAllOpnames(opnameResults.flat())
    } catch (err) {
      console.error('Failed to load subcontractor data:', err)
    } finally {
      setLoading(false)
    }
  }, [activeProjectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  if (!activeProjectId || !activeProject) {
    return (
      <ModulePageState
        icon={<Users size={18} />}
        title="Manajemen Subkontraktor"
        description="Kelola Mandor, SPK, dan Opname progres pekerjaan subkontraktor."
        variant="empty"
        message="Pilih proyek aktif untuk mengakses modul subkontraktor."
      />
    )
  }

  const totalContractValue = spks.reduce((s, spk) => s + spk.contractValue, 0)
  const totalPaid = allOpnames
    .filter(o => o.status === 'APPROVED' || o.status === 'POSTED_TO_FINANCE')
    .reduce((s, o) => s + o.netPayable, 0)
  const pendingClaims = allOpnames.filter(o => o.status === 'SUBMITTED').length
  const activeSpks = spks.filter(s => s.status === 'ACTIVE').length

  const kpis = [
    { label: 'Nilai Kontrak', value: fmtIDR(totalContractValue), icon: <FileText size={14} /> },
    { label: 'SPK Aktif', value: String(activeSpks), icon: <ClipboardList size={14} /> },
    { label: 'Total Terbayar', value: fmtIDR(totalPaid), icon: <TrendingUp size={14} /> },
    { label: 'Klaim Pending', value: String(pendingClaims), icon: <Clock size={14} /> },
  ]

  const TABS = [
    { id: 'vendors' as const, label: 'Vendor / Mandor', icon: <Users size={14} /> },
    { id: 'spk'     as const, label: 'SPK',              icon: <FileText size={14} /> },
    { id: 'opname'  as const, label: 'Opname',           icon: <ClipboardList size={14} /> },
  ]

  return (
    <PageShell
      contextBar={
        <GlobalContextBar
          projectName={activeProject.name}
          packageName={activeProject.code || undefined}
          versionLabel={activeProject.status || undefined}
          syncStatus="synced"
          healthItems={[{
            label: 'SPK',
            level: activeSpks > 0 ? 'good' : 'warning',
            value: `${activeSpks} aktif`,
          }]}
        />
      }
      header={
        <WorkspaceHeader
          title="Manajemen Subkontraktor"
          subtitle="Mandor · SPK · Opname · Retensi"
        />
      }
      summary={
        <SummaryStrip items={kpis} />
      }
    >
      {/* Tab nav */}
      <div className="flex gap-1 border-b border-border-subtle px-padding-md">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border-b-2 transition-colors ${
              tab === t.id
                ? 'border-brand text-brand font-medium'
                : 'border-transparent text-secondary hover:text-primary'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-padding-md">
        {loading && (
          <div className="py-10 text-center text-secondary text-sm">Memuat data...</div>
        )}

        {!loading && (
          <>
            {/* Vendor / Mandor Tab */}
            {tab === 'vendors' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary">Daftar Vendor & Mandor</h3>
                  <button
                    className="flex items-center gap-1.5 rounded-radius-sm bg-brand px-3 py-1.5 text-xs font-medium text-on-brand hover:bg-brand-hover transition-colors"
                    onClick={() => setShowAddVendor(true)}
                  >
                    <Plus size={12} />
                    Tambah Vendor
                  </button>
                </div>
                <div className="overflow-x-auto rounded-radius-md border border-border-subtle">
                  <table className="w-full text-xs">
                    <thead className="bg-surface-subtle">
                      <tr>
                        {['Nama', 'Tipe', 'Spesialisasi', 'Rating', 'Status'].map(h => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-secondary">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {subcons.map(s => (
                        <tr key={s.id} className="border-t border-border-subtle hover:bg-surface-subtle/50">
                          <td className="px-3 py-2 font-medium text-primary">{s.name}</td>
                          <td className="px-3 py-2 text-secondary">{s.type}</td>
                          <td className="px-3 py-2 text-secondary">{s.specialty}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium">{s.rating}</span>
                            <span className="text-secondary">/5</span>
                          </td>
                          <td className="px-3 py-2"><StatusBadge status={s.status} /></td>
                        </tr>
                      ))}
                      {subcons.length === 0 && (
                        <tr><td colSpan={5} className="px-3 py-6 text-center text-secondary">Belum ada vendor terdaftar</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* SPK Tab */}
            {tab === 'spk' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary">Surat Perintah Kerja (SPK)</h3>
                  <button className="flex items-center gap-1.5 rounded-radius-sm bg-brand px-3 py-1.5 text-xs font-medium text-on-brand hover:bg-brand-hover transition-colors">
                    <Plus size={12} />
                    Buat SPK
                  </button>
                </div>
                {spks.length === 0 ? (
                  <div className="py-10 text-center text-secondary text-sm">
                    Belum ada SPK untuk proyek ini
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {spks.map(spk => (
                      <SPKCard key={spk.id} spk={spk} opnames={allOpnames} subcons={subcons} />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Opname Tab */}
            {tab === 'opname' && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-primary">Opname Progress & Tagihan</h3>
                </div>
                {allOpnames.length === 0 ? (
                  <div className="py-10 text-center text-secondary text-sm">
                    Belum ada opname. Buat SPK terlebih dahulu.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-radius-md border border-border-subtle">
                    <table className="w-full text-xs">
                      <thead className="bg-surface-subtle">
                        <tr>
                          {['SPK', 'Periode', 'Progress', 'Bruto', 'Retensi', 'Neto', 'Status'].map(h => (
                            <th key={h} className="px-3 py-2 text-left font-medium text-secondary">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {allOpnames.map(opname => {
                          const spk = spks.find(s => s.id === opname.spkId)
                          return <OpnameRow key={opname.id} opname={opname} spkNumber={spk?.spkNumber ?? opname.spkId} />
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {activeProjectId && (
        <AddVendorDialog
          open={showAddVendor}
          projectId={activeProjectId}
          onClose={() => setShowAddVendor(false)}
          onSaved={loadData}
        />
      )}
    </PageShell>
  )
}
