import React, { useState } from 'react'
import { Users, FileText, ClipboardList, TrendingUp, Plus, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react'
import { PageShell } from '@/components/layouts'
import { GlobalContextBar, WorkspaceHeader, SummaryStrip } from '@/components/patterns'
import { useProjectStore } from '@/store/projectStore'
import { subcontractorService } from '@/services/subcontractorService'
import type { SPK, Opname } from '@/services/subcontractorService'
import ModulePageState from '@/components/common/ModulePageState'

// ─── Status badges ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE:              { label: 'Aktif',          cls: 'bg-success-subtle text-success-fg' },
    DRAFT:               { label: 'Draft',          cls: 'bg-surface-subtle text-secondary' },
    COMPLETED:           { label: 'Selesai',        cls: 'bg-brand-subtle text-brand' },
    TERMINATED:          { label: 'Terminasi',      cls: 'bg-destructive-subtle text-destructive' },
    SUBMITTED:           { label: 'Diajukan',       cls: 'bg-warning-subtle text-warning-fg' },
    APPROVED:            { label: 'Disetujui',      cls: 'bg-success-subtle text-success-fg' },
    REJECTED:            { label: 'Ditolak',        cls: 'bg-destructive-subtle text-destructive' },
    POSTED_TO_FINANCE:   { label: 'Posting AP',     cls: 'bg-brand-subtle text-brand' },
    INACTIVE:            { label: 'Nonaktif',       cls: 'bg-surface-subtle text-secondary' },
    BLACKLISTED:         { label: 'Blacklist',      cls: 'bg-destructive-subtle text-destructive' },
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
function SPKCard({ spk, opnames }: { spk: SPK; opnames: Opname[] }) {
  const spkOpnames = opnames.filter(o => o.spkId === spk.id && o.status !== 'REJECTED')
  const totalProgress = spkOpnames.reduce((s, o) => s + o.currentPeriodProgressPercentage, 0)
  const totalPaid = spkOpnames.filter(o => o.status === 'APPROVED' || o.status === 'POSTED_TO_FINANCE').reduce((s, o) => s + o.netPayable, 0)
  const subcon = subcontractorService.getSubcons().find(s => s.id === spk.subconId)

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

// ─── Main Page ─────────────────────────────────────────────────────────────────
export default function SubcontractorManagement() {
  const activeProjectId = useProjectStore(s => s.activeProjectId)
  const projects = useProjectStore(s => s.projects)
  const [tab, setTab] = useState<'vendors' | 'spk' | 'opname'>('vendors')

  const activeProject = activeProjectId ? projects[activeProjectId] : null

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

  const subcons = subcontractorService.getSubcons()
  const spks = subcontractorService.getSPKs(activeProjectId)
  const allOpnames = spks.flatMap(spk => subcontractorService.getOpnamesBySPK(spk.id))

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
        {/* Vendor / Mandor Tab */}
        {tab === 'vendors' && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-primary">Daftar Vendor & Mandor</h3>
              <button className="flex items-center gap-1.5 rounded-radius-sm bg-brand px-3 py-1.5 text-xs font-medium text-on-brand hover:bg-brand-hover transition-colors">
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
                  <SPKCard key={spk.id} spk={spk} opnames={allOpnames} />
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
      </div>
    </PageShell>
  )
}
