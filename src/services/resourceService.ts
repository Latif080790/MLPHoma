
import { assertSupabase } from '../lib/supabaseClient'

type ProjectRow = { id: string; name?: string }
type ToolUsageRow = { tool_name: string; project_id: string; hours_used?: number }

export interface ResourceUtilization {
    resourceName: string
    type: 'EQUIPMENT' | 'LABOR'
    allocation: {
        projectId: string
        projectName: string
        usagePercent: number
    }[]
    totalUsage: number
}

export const resourceService = {
    /**
     * Get cross-project resource utilization heatmap data
     */
    async getResourcePortfolioHeatmap(): Promise<ResourceUtilization[]> {
        const supabase = assertSupabase()

        // 1. Get Project Names for mapping
        const { data: projects } = await supabase.from('projects').select('id, name')
        const projectMap = (projects as ProjectRow[] | null)?.reduce<Record<string, string>>((acc, p) => {
            acc[p.id] = p.name
            return acc
        }, {}) || {}

        // 2. Aggregate Equipment Usage (from tools_usage_logs)
        const { data: toolLogs } = await supabase
            .from('tools_usage_logs')
            .select('tool_name, project_id, hours_used')

        const equipmentMap: Record<string, ResourceUtilization> = {}

        ;(toolLogs as ToolUsageRow[] | null)?.forEach((log) => {
            const tool = log.tool_name
            if (!equipmentMap[tool]) {
                equipmentMap[tool] = {
                    resourceName: tool,
                    type: 'EQUIPMENT',
                    allocation: [],
                    totalUsage: 0
                }
            }

            const pId = log.project_id
            const hours = log.hours_used || 0

            // Calculate a pseudo-utilization percentage (assume 8h = 100%)
            const utilization = Math.min(100, (hours / 8) * 100)

            const existing = equipmentMap[tool].allocation.find(a => a.projectId === pId)
            if (existing) {
                existing.usagePercent = Math.min(100, existing.usagePercent + utilization)
            } else {
                equipmentMap[tool].allocation.push({
                    projectId: pId,
                    projectName: projectMap[pId] || 'Unknown',
                    usagePercent: utilization
                })
            }
        })

        // Calculate total usage
        Object.values(equipmentMap).forEach(res => {
            res.totalUsage = res.allocation.reduce((sum, a) => sum + a.usagePercent, 0) / projects!.length
        })

        return Object.values(equipmentMap)
    }
}
