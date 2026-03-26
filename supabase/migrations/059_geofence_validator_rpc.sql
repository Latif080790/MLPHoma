-- Migration: 059_geofence_validator_rpc.sql
-- Description: Implement server-side geofence validation to prevent GPS spoofing/faking.

CREATE OR REPLACE FUNCTION public.rpc_validate_project_geofence(
    p_project_id TEXT,
    p_user_lat DOUBLE PRECISION,
    p_user_lng DOUBLE PRECISION
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_proj_lat DOUBLE PRECISION;
    v_proj_lng DOUBLE PRECISION;
    v_distance DOUBLE PRECISION;
    v_radius DOUBLE PRECISION := 500; -- 500m default
BEGIN
    -- 1. Get project coordinates
    SELECT latitude, longitude INTO v_proj_lat, v_proj_lng
    FROM public.projects
    WHERE id = p_project_id;

    IF NOT FOUND OR v_proj_lat IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Project coordinates not configured');
    END IF;

    -- 2. Calculate Distance (Haversine)
    -- Haversine formula implementation in SQL
    v_distance := 6371000 * acos(
        cos(radians(p_user_lat)) * cos(radians(v_proj_lat)) *
        cos(radians(v_proj_lng) - radians(p_user_lng)) +
        sin(radians(p_user_lat)) * sin(radians(v_proj_lat))
    );

    -- 3. Return Result
    RETURN jsonb_build_object(
        'success', true,
        'valid', v_distance <= v_radius,
        'distance', round(v_distance::numeric, 2),
        'allowedRadius', v_radius
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.rpc_validate_project_geofence(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
