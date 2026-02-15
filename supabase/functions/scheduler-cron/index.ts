
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.0.0"

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!

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

        // 3. Task B: Auto-Calculate Tool Rent (Mock)
        // const { error: rentError } = await supabase.rpc('calculate_daily_rent')

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
