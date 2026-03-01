import { assertSupabase } from '@/lib/supabaseClient';
import { supplyChainService } from './supplyChainService';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

// ─── Local row types ──────────────────────────────────────────────────────────
type RapItemRow = { total_price: number | null }
type WbsItemRow = { progress: number | null; weight: number | null; start_date: string | null; end_date: string | null }
type RiskRow = { id?: string; description?: string; status?: string; risk_score?: number | null }
type WbsIssueRow = { id: string; name: string; status: string; progress: number | null }
type PoRow = { id: string; po_number: string; status: string; total_amount: number }
type InventoryItem = { materialName: string; unit: string; current: number }
type HandoverDoc = jsPDF & { autoTable: (opts: Record<string, unknown>) => void; lastAutoTable: { finalY: number } }

export interface HandoverSummary {
    budget: {
        planned: number;
        actual: number;
        variance: number;
    };
    schedule: {
        startDate: string;
        endDate: string;
        progress: number;
        status: string;
        actualFinish: string;
    };
    safety: {
        total: number;
        highSeverity: number;
        incidents: number;
        manhours: number;
    };
    inventory: Array<{
        materialName: string;
        unit: string;
        current: number;
        value: number;
    }>;
}

export interface OutstandingIssue {
    id: string;
    type: 'RISK' | 'WBS' | 'PO';
    desc: string;
    status: string;
    priority: string;
}

export const handoverService = {
    async getHandoverSummary(projectId: string): Promise<HandoverSummary> {
        const supabase = assertSupabase();
        // 1. Fetch Budget (RAP items sum)
        const { data: rapData } = await supabase
            .from('rap_items')
            .select('total_price')
            .eq('project_id', projectId);

        const planned = rapData?.reduce((sum: number, item: RapItemRow) => sum + (item.total_price || 0), 0) || 0;

        // 2. Fetch Schedule Progress (WBS weighted average)
        // Columns progress/weight/start_date/end_date may not exist yet (added in migration 034)
        let wbsData: WbsItemRow[] | null = null;
        try {
            const { data, error } = await supabase
                .from('wbs_items')
                .select('progress, weight, start_date, end_date')
                .eq('project_id', projectId);
            if (!error) wbsData = data;
        } catch {
            // Columns may not exist yet — use defaults
        }

        const totalWeight = wbsData?.reduce((sum: number, item: WbsItemRow) => sum + (item.weight || 0), 0) || 0;
        const weightedProgress = wbsData?.reduce((sum: number, item: WbsItemRow) => sum + ((item.progress || 0) * (item.weight || 0)), 0) || 0;
        const projectProgress = totalWeight > 0 ? weightedProgress / totalWeight : 0;

        // 3. Fetch Risks
        const { data: risksData } = await supabase
            .from('risks')
            .select('severity')
            .eq('project_id', projectId)
            .eq('status', 'OPEN');

        // 4. Fetch Inventory Stock
        let stock: InventoryItem[] = [];
        try {
            stock = await supplyChainService.getInventoryStock(projectId);
        } catch {
            // Inventory may fail if supply chain tables have RLS issues
        }

        return {
            budget: {
                planned,
                actual: 0,
                variance: 0,
            },
            schedule: {
                startDate: wbsData?.[0]?.start_date || '',
                endDate: wbsData?.[0]?.end_date || '',
                progress: Math.round(projectProgress),
                status: projectProgress >= 100 ? 'Completed' : 'In Progress',
                actualFinish: (wbsData || [])
                    .filter((w: WbsItemRow) => w.progress === 100)
                    .sort((a: WbsItemRow, b: WbsItemRow) => new Date(b.end_date ?? '').getTime() - new Date(a.end_date ?? '').getTime())[0]?.end_date || '-',
            },
            safety: {
                total: risksData?.length || 0,
                highSeverity: (risksData || []).filter((r: RiskRow) => (r.risk_score || 0) >= 15).length || 0,
                incidents: 0,
                manhours: 0,
            },
            inventory: stock.map((s: InventoryItem) => ({
                materialName: s.materialName,
                unit: s.unit,
                current: s.current,
                value: 0
            }))
        };
    },

    async getOutstandingIssues(projectId: string): Promise<OutstandingIssue[]> {
        const supabase = assertSupabase();
        const issues: OutstandingIssue[] = [];

        // Fetch High/Critical Risks
        const { data: risks } = await supabase
            .from('risks')
            .select('id, description, status, risk_score')
            .eq('project_id', projectId)
            .gte('risk_score', 15)
            .eq('status', 'OPEN');

        if (risks) {
            risks.forEach((r: RiskRow) => issues.push({
                id: r.id,
                type: 'RISK',
                desc: r.description,
                status: r.status,
                priority: (r.risk_score || 0) >= 20 ? 'CRITICAL' : 'HIGH'
            }));
        }

        // Fetch Incomplete WBS
        // Columns status/progress may not exist yet (added in migration 034)
        try {
            const { data: wbs, error: wbsErr } = await supabase
                .from('wbs_items')
                .select('id, name, status, progress')
                .eq('project_id', projectId)
                .lt('progress', 100);

            if (!wbsErr && wbs) {
                wbs.forEach((w: WbsIssueRow) => issues.push({
                    id: w.id,
                    type: 'WBS',
                    desc: w.name,
                    status: `${w.progress || 0}%`,
                    priority: 'Normal'
                }));
            }
        } catch {
            // Columns may not exist yet — skip WBS issues
        }

        // Fetch Open Purchase Orders
        const { data: pos } = await supabase
            .from('purchase_orders')
            .select('id, po_number, status, total_amount')
            .eq('project_id', projectId)
            .not('status', 'in', '("COMPLETED", "CANCELLED")');

        if (pos) {
            pos.forEach((p: PoRow) => issues.push({
                id: p.id,
                type: 'PO',
                desc: `PO #${p.po_number}`,
                status: p.status,
                priority: 'Normal'
            }));
        }

        return issues;
    },

    async generateHandoverReport(projectId: string, summary: HandoverSummary, issues: OutstandingIssue[]) {
        const doc = new jsPDF();
        const h = doc as HandoverDoc;
        const now = new Date().toLocaleDateString('id-ID', { dateStyle: 'full' });

        // --- Page 1: Executive Summary ---
        doc.setFontSize(22);
        doc.text('Berita Acara Serah Terima Proyek', 105, 20, { align: 'center' });
        doc.setFontSize(12);
        doc.text(`Project ID: ${projectId}`, 105, 28, { align: 'center' });
        doc.text(`Tanggal: ${now}`, 105, 34, { align: 'center' });

        doc.setLineWidth(0.5);
        doc.line(20, 40, 190, 40);

        // Budget Section
        doc.setFontSize(14);
        doc.text('1. Ringkasan Anggaran', 20, 50);
        doc.setFontSize(10);
        h.autoTable({
            startY: 55,
            head: [['Keterangan', 'Nilai (Rp)']],
            body: [
                ['Anggaran Direncanakan (RAP)', summary.budget.planned.toLocaleString('id-ID')],
                ['Realisasi Biaya (Actual)', summary.budget.actual.toLocaleString('id-ID')],
                ['Variansi (Sisa/Overrun)', summary.budget.variance.toLocaleString('id-ID')]
            ],
            theme: 'plain',
        });

        // Schedule Section
        doc.setFontSize(14);
        doc.text('2. Jadwal & Progres', 20, h.lastAutoTable.finalY + 15);
        doc.setFontSize(10);
        h.autoTable({
            startY: h.lastAutoTable.finalY + 20,
            head: [['Parameter', 'Status']],
            body: [
                ['Tanggal Mulai', summary.schedule.startDate],
                ['Tanggal Selesai (Rencana)', summary.schedule.endDate],
                ['Tanggal Selesai (Aktual)', summary.schedule.actualFinish],
                ['Progres Fisik', `${summary.schedule.progress}%`],
                ['Status Akhir', summary.schedule.status]
            ],
            theme: 'plain',
        });

        // Safety Section
        doc.setFontSize(14);
        doc.text('3. K3L (Safety)', 20, h.lastAutoTable.finalY + 15);
        doc.setFontSize(10);
        h.autoTable({
            startY: h.lastAutoTable.finalY + 20,
            head: [['Parameter', 'Jumlah']],
            body: [
                ['Total Resiko Teridentifikasi', summary.safety.total],
                ['Resiko Tinggi/Critical', summary.safety.highSeverity],
                ['Insiden Tercatat', summary.safety.incidents],
                ['Jam Kerja Aman (Manhours)', summary.safety.manhours]
            ],
            theme: 'plain',
        });

        // --- Page 2: Outstanding Issues ---
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Daftar Masalah Tertunda (Outstanding Issues)', 20, 20);

        if (issues.length === 0) {
            doc.setFontSize(12);
            doc.text('Tidak ada masalah tertunda (Clean Handover).', 20, 30);
        } else {
            h.autoTable({
                startY: 25,
                head: [['Tipe', 'Deskripsi', 'Prioritas', 'Status']],
                body: issues.map(i => [i.type, i.desc, i.priority, i.status]),
                theme: 'grid',
                headStyles: { fillColor: [220, 53, 69] }
            });
        }

        // --- Page 3: Inventory & Assets ---
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Sisa Inventaris & Aset (Material On-Site)', 20, 20);

        if (summary.inventory.length === 0) {
            doc.setFontSize(12);
            doc.text('Tidak ada sisa material tercatat.', 20, 30);
        } else {
            h.autoTable({
                startY: 25,
                head: [['Material', 'Satuan', 'Sisa Stok']],
                body: summary.inventory.map(i => [i.materialName, i.unit, i.current]),
                theme: 'striped'
            });
        }

        // --- Page 4: Sign-off ---
        doc.addPage();
        doc.setFontSize(16);
        doc.text('Lembar Pengesahan (Sign-off)', 105, 30, { align: 'center' });

        const ySign = 80;
        doc.setFontSize(12);

        // Project Manager
        doc.text('Dibuat Oleh:', 40, ySign);
        doc.line(30, ySign + 30, 90, ySign + 30);
        doc.text('( Project Manager )', 45, ySign + 35);

        // Director/Owner
        doc.text('Disetujui Oleh:', 140, ySign);
        doc.line(130, ySign + 30, 190, ySign + 30);
        doc.text('( Direktur / Owner )', 145, ySign + 35);

        doc.setFontSize(10);
        doc.text('Dokumen ini digenerate otomatis oleh sistem MLPHoma.', 105, 280, { align: 'center' });

        doc.save(`BAST_Proyek_${projectId}.pdf`);
    }
};
