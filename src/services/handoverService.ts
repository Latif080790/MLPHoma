import { assertSupabase } from '@/lib/supabaseClient';
import { supplyChainService } from './supplyChainService';

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

        const planned = rapData?.reduce((sum: number, item: any) => sum + (item.total_price || 0), 0) || 0;

        // 2. Fetch Schedule Progress (WBS weighted average)
        const { data: wbsData } = await supabase
            .from('wbs_items')
            .select('progress, weight, start_date, end_date')
            .eq('project_id', projectId);

        const totalWeight = wbsData?.reduce((sum: number, item: any) => sum + (item.weight || 0), 0) || 0;
        const weightedProgress = wbsData?.reduce((sum: number, item: any) => sum + ((item.progress || 0) * (item.weight || 0)), 0) || 0;
        const projectProgress = totalWeight > 0 ? weightedProgress / totalWeight : 0;

        // 3. Fetch Risks
        const { data: risksData } = await supabase
            .from('risks')
            .select('severity')
            .eq('project_id', projectId)
            .eq('status', 'OPEN');

        // 4. Fetch Inventory Stock
        const stock = await supplyChainService.getInventoryStock(projectId);

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
                    .filter((w: any) => w.progress === 100)
                    .sort((a: any, b: any) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime())[0]?.end_date || '-',
            },
            safety: {
                total: risksData?.length || 0,
                highSeverity: (risksData || []).filter((r: any) => r.severity === 'HIGH' || r.severity === 'CRITICAL').length || 0,
                incidents: 0,
                manhours: 0,
            },
            inventory: stock.map(s => ({
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
            .select('id, title, status, severity')
            .eq('project_id', projectId)
            .in('severity', ['HIGH', 'CRITICAL'])
            .eq('status', 'OPEN');

        if (risks) {
            risks.forEach((r: any) => issues.push({
                id: r.id,
                type: 'RISK',
                desc: r.title,
                status: r.status,
                priority: r.severity
            }));
        }

        // Fetch Incomplete WBS
        const { data: wbs } = await supabase
            .from('wbs_items')
            .select('id, name, status, progress')
            .eq('project_id', projectId)
            .lt('progress', 100);

        if (wbs) {
            wbs.forEach((w: any) => issues.push({
                id: w.id,
                type: 'WBS',
                desc: w.name,
                status: `${w.progress}%`,
                priority: 'Normal'
            }));
        }

        // Fetch Open Purchase Orders
        const { data: pos } = await supabase
            .from('purchase_orders')
            .select('id, po_number, status, total_amount')
            .eq('project_id', projectId)
            .not('status', 'in', '("COMPLETED", "CANCELLED")');

        if (pos) {
            pos.forEach((p: any) => issues.push({
                id: p.id,
                type: 'PO',
                desc: `PO #${p.po_number}`,
                status: p.status,
                priority: 'Normal'
            }));
        }

        return issues;
    }
};
