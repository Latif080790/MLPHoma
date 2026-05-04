/**
 * SubcontractorPanel.tsx
 *
 * Tab panel for managing outsourced labor, Mandors, and active SPKs.
 * Typically fits into the Supply Chain or Schedule & Ops modules.
 */

import React, { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useProjectStore } from '@/store/projectStore'
import { subcontractorService, type SubcontractorInfo, type SPK } from '@/services/subcontractorService'
import { useAuthStore } from '@/store/authStore'
import { Plus, Users, HardHat, FileSignature, Search, ShieldCheck, Play } from 'lucide-react'

export function SubcontractorPanel() {
    const { activeProjectId } = useProjectStore()
    const [subcons, setSubcons] = useState<SubcontractorInfo[]>(subcontractorService.getSubcons())
    const [spks, setSpks] = useState<SPK[]>(activeProjectId ? subcontractorService.getSPKs(activeProjectId) : [])
    const profile = useAuthStore(s => s.profile)

    const [viewMode, setViewMode] = useState<'SUBCONS' | 'SPKS'>('SUBCONS')
    const [search, setSearch] = useState('')

    // Subcon Dialog
    const [subconOpen, setSubconOpen] = useState(false)
    const [newSubconName, setNewSubconName] = useState('')
    const [newSubconType, setNewSubconType] = useState<'MANDOR' | 'SUBCON'>('MANDOR')
    const [newSubconSpecialty, setNewSubconSpecialty] = useState('')

    // SPK Dialog
    const [spkOpen, setSpkOpen] = useState(false)
    const [spkSubconId, setSpkSubconId] = useState('')
    const [spkWbsId, _setSpkWbsId] = useState('') // Mocked for now
    const [spkDesc, setSpkDesc] = useState('')
    const [spkContractVal, setSpkContractVal] = useState(0)
    const [spkDp, setSpkDp] = useState(20)
    const [spkRetensi, setSpkRetensi] = useState(5)

    if (!activeProjectId) return null

    const refreshData = () => {
        setSubcons(subcontractorService.getSubcons())
        if (activeProjectId) setSpks(subcontractorService.getSPKs(activeProjectId))
    }

    const handleCreateSubcon = () => {
        if (!newSubconName || !newSubconSpecialty) return
        subcontractorService.createSubcon({
            name: newSubconName,
            type: newSubconType,
            specialty: newSubconSpecialty,
            phone: '-',
            bankAccount: '-',
            rating: 5,
            status: 'ACTIVE'
        })
        setSubconOpen(false)
        refreshData()
    }

    const handleCreateSPK = () => {
        if (!spkSubconId || !spkDesc || spkContractVal <= 0) return
        const userName = profile?.full_name || 'System'
        subcontractorService.createSPK({
            projectId: activeProjectId,
            wbsId: spkWbsId || 'WBS-OH', // Mock if not selected
            subconId: spkSubconId,
            description: spkDesc,
            contractValue: spkContractVal,
            downPaymentPercentage: spkDp,
            retainagePercentage: spkRetensi,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // +30 days mock
        }, userName)
        setSpkOpen(false)
        refreshData()
    }

    const handleActivateSPK = (id: string) => {
        const userName = profile?.full_name || 'System'
        subcontractorService.activateSPK(id, userName)
        refreshData()
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
                <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-md">
                    <button
                        className={`px-4 py-1.5 text-xs font-semibold rounded ${viewMode === 'SUBCONS' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}
                        onClick={() => setViewMode('SUBCONS')}
                    >
                        <Users size={14} className="inline mr-1.5 mb-0.5" /> Directory
                    </button>
                    <button
                        className={`px-4 py-1.5 text-xs font-semibold rounded ${viewMode === 'SPKS' ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}
                        onClick={() => setViewMode('SPKS')}
                    >
                        <FileSignature size={14} className="inline mr-1.5 mb-0.5" /> SPK Active
                    </button>
                </div>
                <div className="flex gap-2 items-center">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input className="h-8 pl-8 text-xs w-48" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} />
                    </div>
                    {viewMode === 'SUBCONS' ? (
                        <Button size="sm" className="h-8" onClick={() => setSubconOpen(true)}>
                            <Plus size={14} className="mr-1.5" /> New Partner
                        </Button>
                    ) : (
                        <Button size="sm" className="h-8 bg-blue-600" onClick={() => setSpkOpen(true)}>
                            <Plus size={14} className="mr-1.5" /> Issue SPK
                        </Button>
                    )}
                </div>
            </div>

            {viewMode === 'SUBCONS' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subcons.filter(s => s.name.toLowerCase().includes(search.toLowerCase())).map(sub => (
                        <Card key={sub.id} className="hover:border-blue-300 transition-colors cursor-default group">
                            <CardContent className="p-4">
                                <div className="flex justify-between items-start mb-2">
                                    <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded text-slate-600 dark:text-slate-300">
                                        {sub.type === 'MANDOR' ? <HardHat size={20} /> : <Users size={20} />}
                                    </div>
                                    <Badge variant="outline" className={`text-xs ${sub.status === 'ACTIVE' ? 'bg-green-50 text-green-700 border-green-200' : ''}`}>
                                        {sub.status}
                                    </Badge>
                                </div>
                                <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100">{sub.name}</h4>
                                <p className="text-xs text-slate-500 mb-3">{sub.specialty}</p>
                                <div className="border-t pt-3 flex items-center justify-between text-xs">
                                    <div className="text-slate-500 flex items-center gap-1.5">
                                        <ShieldCheck size={14} className="text-emerald-500" />
                                        Rating: {sub.rating}/5
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                    {subcons.length === 0 && <div className="col-span-3 text-center py-8 text-slate-500">No subcontractor profiles found.</div>}
                </div>
            )}

            {viewMode === 'SPKS' && (
                <Card>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-slate-900/50">
                                    <TableHead>SPK No.</TableHead>
                                    <TableHead>Partner</TableHead>
                                    <TableHead>Description</TableHead>
                                    <TableHead className="text-right">Value (Rp)</TableHead>
                                    <TableHead className="text-center">Status</TableHead>
                                    <TableHead className="text-right">Action</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {spks.map(spk => {
                                    const subcon = subcons.find(s => s.id === spk.subconId)
                                    return (
                                        <TableRow key={spk.id} className="text-sm">
                                            <TableCell className="font-mono text-xs">{spk.spkNumber}</TableCell>
                                            <TableCell className="font-medium text-blue-700 dark:text-blue-400">
                                                {subcon?.name || 'Unknown'}
                                            </TableCell>
                                            <TableCell className="text-slate-500">{spk.description}</TableCell>
                                            <TableCell className="text-right font-mono font-semibold">
                                                {spk.contractValue.toLocaleString('id-ID')}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="outline" className={`text-xs ${spk.status === 'ACTIVE' ? 'bg-blue-50 text-blue-700' :
                                                        spk.status === 'DRAFT' ? 'bg-slate-50 text-slate-600' :
                                                            'bg-emerald-50 text-emerald-700'
                                                    }`}>
                                                    {spk.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {spk.status === 'DRAFT' && (
                                                    <Button size="sm" variant="outline" className="h-7 text-xs bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100" onClick={() => handleActivateSPK(spk.id)}>
                                                        <Play size={12} className="mr-1" /> Activate
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                                {spks.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="h-32 text-center text-slate-500">No SPKs issued for this project.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            )}

            {/* Create Subcon Dialog */}
            <Dialog open={subconOpen} onOpenChange={setSubconOpen}>
                <DialogContent className="sm:max-w-[425px]">
                    <DialogHeader>
                        <DialogTitle>Register Partner</DialogTitle>
                        <DialogDescription>Add a new Mandor or Subcontractor to the directory.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Type</Label>
                            <Select value={newSubconType} onValueChange={(v: 'MANDOR' | 'SUBCON') => setNewSubconType(v)}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="MANDOR">Mandor (Individual)</SelectItem>
                                    <SelectItem value="SUBCON">Subcontractor (Entity)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Name</Label>
                            <Input value={newSubconName} onChange={e => setNewSubconName(e.target.value)} placeholder="e.g. Pak Budi / PT Bangun Maju" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Specialty</Label>
                            <Input value={newSubconSpecialty} onChange={e => setNewSubconSpecialty(e.target.value)} placeholder="e.g. Pembesian, MEP, Finishing" />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateSubcon}>Register</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Create SPK Dialog */}
            <Dialog open={spkOpen} onOpenChange={setSpkOpen}>
                <DialogContent className="sm:max-w-[500px]">
                    <DialogHeader>
                        <DialogTitle>Issue New SPK</DialogTitle>
                        <DialogDescription>Draft a Surat Perintah Kerja for an outsourced scope.</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="space-y-1.5">
                            <Label>Assignee / Partner</Label>
                            <Select value={spkSubconId} onValueChange={setSpkSubconId}>
                                <SelectTrigger><SelectValue placeholder="Select Subcon/Mandor" /></SelectTrigger>
                                <SelectContent>
                                    {subcons.map(s => <SelectItem key={s.id} value={s.id}>{s.name} ({s.specialty})</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Scope Description</Label>
                            <Input value={spkDesc} onChange={e => setSpkDesc(e.target.value)} placeholder="e.g. Pekerjaan Instalasi Pipa Lantai 2" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Nilai Kontrak / Contract Value (Rp)</Label>
                            <Input type="number" value={spkContractVal || ''} onChange={e => setSpkContractVal(Number(e.target.value))} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label>Downpayment (DP) %</Label>
                                <Input type="number" value={spkDp} onChange={e => setSpkDp(Number(e.target.value))} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Retainage (Retensi) %</Label>
                                <Input type="number" value={spkRetensi} onChange={e => setSpkRetensi(Number(e.target.value))} />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleCreateSPK}>Draft SPK</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
