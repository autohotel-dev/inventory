-- ================================================================
-- scan_historical_anomalies - Fixed version with proper aliases
-- ================================================================

CREATE OR REPLACE FUNCTION scan_historical_anomalies(
    p_days INT DEFAULT 30
)
RETURNS TABLE (
    out_employee_id UUID,
    out_employee_name TEXT,
    out_employee_role TEXT,
    out_anomaly_type TEXT,
    out_severity TEXT,
    out_occurrence_count INT,
    out_total_amount NUMERIC,
    out_description TEXT,
    out_sample_flow_ids UUID[],
    out_first_seen TIMESTAMPTZ,
    out_last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Payment not registered
    RETURN QUERY
    SELECT
        vf.actor_id,
        vf.actor_name,
        vf.actor_role,
        'PAYMENT_NOT_REGISTERED'::TEXT,
        'CRITICAL'::TEXT,
        COUNT(DISTINCT f.id)::INT,
        SUM(COALESCE((vf.metadata->>'total_paid')::NUMERIC, 0)),
        format('%s pagos cobrados sin registro', COUNT(DISTINCT f.id)),
        ARRAY_AGG(DISTINCT f.id),
        MIN(f.started_at),
        MAX(f.started_at)
    FROM operation_flows f
    JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_PAYMENT_COLLECTED' AND vf.actor_id IS NOT NULL
    WHERE f.started_at >= NOW() - (p_days || ' days')::INTERVAL
      AND NOT EXISTS (SELECT 1 FROM flow_events rf WHERE rf.flow_id = f.id AND rf.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED'))
    GROUP BY vf.actor_id, vf.actor_name, vf.actor_role
    HAVING COUNT(DISTINCT f.id) >= 1;

    -- Person count mismatches
    RETURN QUERY
    SELECT
        vf.actor_id,
        vf.actor_name,
        vf.actor_role,
        'PERSON_COUNT_MISMATCH'::TEXT,
        'HIGH'::TEXT,
        COUNT(DISTINCT f.id)::INT,
        NULL,
        format('%s discrepancias de personas', COUNT(DISTINCT f.id)),
        ARRAY_AGG(DISTINCT f.id),
        MIN(f.started_at),
        MAX(f.started_at)
    FROM operation_flows f
    JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_FORM_SUBMITTED' AND vf.actor_id IS NOT NULL
    JOIN room_stays rs ON rs.id = f.room_stay_id
    WHERE f.started_at >= NOW() - (p_days || ' days')::INTERVAL
      AND (vf.metadata->>'person_count')::INT != rs.current_people
      AND (vf.metadata->>'person_count')::INT > 0 AND rs.current_people > 0
    GROUP BY vf.actor_id, vf.actor_name, vf.actor_role
    HAVING COUNT(DISTINCT f.id) >= 1;

    -- Payment amount mismatches
    RETURN QUERY
    SELECT
        vf.actor_id,
        vf.actor_name,
        vf.actor_role,
        'PAYMENT_AMOUNT_MISMATCH'::TEXT,
        'CRITICAL'::TEXT,
        COUNT(DISTINCT f.id)::INT,
        SUM(ABS(COALESCE((vf.metadata->>'total_paid')::NUMERIC, 0) - COALESCE((rf.metadata->>'amount')::NUMERIC, 0))),
        format('%s discrepancias en montos', COUNT(DISTINCT f.id)),
        ARRAY_AGG(DISTINCT f.id),
        MIN(f.started_at),
        MAX(f.started_at)
    FROM operation_flows f
    JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_PAYMENT_COLLECTED' AND vf.actor_id IS NOT NULL
    JOIN flow_events rf ON rf.flow_id = f.id AND rf.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED')
    WHERE f.started_at >= NOW() - (p_days || ' days')::INTERVAL
      AND ABS(COALESCE((vf.metadata->>'total_paid')::NUMERIC, 0) - COALESCE((rf.metadata->>'amount')::NUMERIC, 0)) > 0.50
    GROUP BY vf.actor_id, vf.actor_name, vf.actor_role
    HAVING COUNT(DISTINCT f.id) >= 1;
END;
$$;
