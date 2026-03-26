-- Migration: 055_cco_cascade_rpc.sql
-- Description: Implement atomic Change Order (VO) cascade mutation via Postgres RPC.
-- This ensures that VO approval, RAB updates, Timeline adjustments, and Budget sinks happen in a single transaction.

CREATE OR REPLACE FUNCTION public.rpc_execute_cco_cascade(v_change_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_project_id TEXT;
    v_vo_status TEXT;
    v_schedule_impact INTEGER;
    v_total_budget_delta NUMERIC := 0;
    v_rab_updated INTEGER := 0;
    v_tasks_updated INTEGER := 0;
    v_item RECORD;
    v_task RECORD;
    v_rab_item_id UUID;
BEGIN
    -- 1. Fetch Change Order header & Validate
    SELECT project_id, status, schedule_impact_days
    INTO v_project_id, v_vo_status, v_schedule_impact
    FROM public.change_orders
    WHERE id = v_change_order_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Change Order ' || v_change_order_id || ' not found');
    END IF;

    -- Enforce status check
    IF v_vo_status != 'APPROVED' THEN
         RETURN jsonb_build_object('success', false, 'error', 'Change Order status is ' || v_vo_status || '. Must be APPROVED to execute cascade.');
    END IF;

    -- 2. Process Change Order Items (RAB Cascade)
    FOR v_item IN (SELECT * FROM public.change_order_items WHERE change_order_id = v_change_order_id) LOOP
        IF v_item.target_wbs_id IS NOT NULL THEN
            -- Check for existing RAB item linked to this WBS 
            SELECT id INTO v_rab_item_id 
            FROM public.rab_items 
            WHERE wbs_id = v_item.target_wbs_id AND project_id = v_project_id
            LIMIT 1;

            IF v_rab_item_id IS NOT NULL THEN
                -- Update existing RAB item
                UPDATE public.rab_items
                SET 
                    volume = volume + v_item.volume_delta,
                    final_total = (volume + v_item.volume_delta) * unit_price,
                    updated_at = NOW()
                WHERE id = v_rab_item_id;
                v_rab_updated := v_rab_updated + 1;
            ELSE
                -- Insert new RAB item
                INSERT INTO public.rab_items (
                    id,
                    project_id,
                    wbs_id,
                    name,
                    volume,
                    unit_price,
                    final_total,
                    created_at,
                    updated_at
                ) VALUES (
                    uuid_generate_v4(),
                    v_project_id,
                    v_item.target_wbs_id,
                    v_item.item_description,
                    v_item.volume_delta,
                    v_item.unit_price,
                    v_item.total_delta,
                    NOW(),
                    NOW()
                );
                v_rab_updated := v_rab_updated + 1;
            END IF;

            v_total_budget_delta := v_total_budget_delta + v_item.total_delta;

            -- 3. Timeline Cascade (per item WBS)
            IF v_schedule_impact != 0 THEN
                FOR v_task IN (
                    SELECT id, duration, end_date 
                    FROM public.timeline_tasks 
                    WHERE wbs_id = v_item.target_wbs_id AND project_id::text = v_project_id
                ) LOOP
                    UPDATE public.timeline_tasks
                    SET 
                        duration = GREATEST(1, COALESCE(duration, 0) + v_schedule_impact),
                        end_date = end_date + (v_schedule_impact || ' days')::INTERVAL,
                        updated_at = NOW()
                    WHERE id = v_task.id;
                    v_tasks_updated := v_tasks_updated + 1;
                END LOOP;
            END IF;
        END IF;
    END LOOP;

    -- 4. Update Project Total Budget
    UPDATE public.projects
    SET budget = COALESCE(budget, 0) + v_total_budget_delta,
        updated_at = NOW()
    WHERE id::text = v_project_id;

    -- 5. Return Summary
    RETURN jsonb_build_object(
        'success', true,
        'projectId', v_project_id,
        'rabItemsUpdated', v_rab_updated,
        'timelineTasksUpdated', v_tasks_updated,
        'budgetDelta', v_total_budget_delta,
        'scheduleDelta', v_schedule_impact
    );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.rpc_execute_cco_cascade(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.rpc_execute_cco_cascade(UUID) TO service_role;
