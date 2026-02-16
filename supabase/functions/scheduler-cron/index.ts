
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SERVICE_ROLE_KEY")!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

serve(async (req) => {
    try {
        // 1. Log Invocation
        console.log("Scheduler Cron Started at", new Date().toISOString())

        // 2. Task A: Check Overdue Tasks & Send Notifications
        const { data: overdueTasks, error: taskError } = await supabase
            .from('timeline_tasks')
            .select('id, name, end_date, project_id, assigned_resources')
            .lt('end_date', new Date().toISOString())
            .neq('status', 'completed')

        if (taskError) throw taskError

        console.log(`Found ${overdueTasks?.length || 0} overdue tasks.`)

        // In a real scenario, we would insert into a 'notifications' table here
        // For now, we just log them to prove automation works
        if (overdueTasks && overdueTasks.length > 0) {
            for (const task of overdueTasks) {
                await supabase.from('notifications').insert({
                    project_id: task.project_id,
                    title: 'Task Overdue',
                    message: `Task "${task.name}" is overdue (End: ${task.end_date})`,
                    type: 'ALERT',
                    read: false,
                    created_at: new Date().toISOString()
                })
            }
        }

        // 3. Task B: Auto-Calculate Tool Rent
        // Logic: Find all tools currently marked 'ACTIVE' in tools_usage_logs (latest entry per resource per project)
        // and insert a new daily log for today.

        // A. Get "Active" Allocations
        // Since we lack a dedicated 'allocations' table, we infer from the latest log.
        // real-world: use a dedicated 'project_resources' or 'allocations' table.
        // For this framework: Query distinct resources.

        // Fetch known active tools (This part is a simplified simulation for the framework)
        // In production, you'd query: "SELECT * FROM tools_usage_logs WHERE id IN (SELECT MAX(id) ...)"
        // Here we'll just check for a specialized 'allocations' state if it existed, or check `resources`

        // Simplified Logic: Query all `tools_usage_logs` from YESTERDAY that were 'ACTIVE'
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];

        const { data: previousLogs } = await supabase
            .from('tools_usage_logs')
            .select('project_id, resource_id, status, rent_cost')
            .eq('log_date', yesterdayStr)
            .eq('status', 'ACTIVE');

        if (previousLogs && previousLogs.length > 0) {
            const todayStr = new Date().toISOString().split('T')[0];
            const newLogs = previousLogs.map(log => ({
                project_id: log.project_id,
                resource_id: log.resource_id,
                log_date: todayStr,
                status: 'ACTIVE',
                hours_used: 8, // Assume full day
                rent_cost: log.rent_cost, // Carry over cost
                created_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
                .from('tools_usage_logs')
                .insert(newLogs);

            if (insertError) console.error("Rent Calc Error:", insertError);
            else console.log(`Generated ${newLogs.length} daily tool rent logs.`);
        }

        return new Response(
            JSON.stringify({
                success: true,
                processed_tasks: overdueTasks?.length || 0,
                timestamp: new Date().toISOString()
            }),
            { headers: { "Content-Type": "application/json" } },
        )
    } catch (error) {
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        )
    }
})
