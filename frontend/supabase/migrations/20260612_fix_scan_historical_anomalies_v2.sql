-- ================================================================
-- scan_historical_anomalies - Final fixed version
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
    out_total_amount NUMERIC(10,2),
    out_description TEXT,
    out_first_seen TIMESTAMPTZ,
    out_last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    rec RECORD;
    v_amount NUMERIC(10,2);
BEGIN
    -- Payment not registered
    FOR rec IN
        SELECT vf.actor_id, vf.actor_name, vf.actor_role,
               COUNT(DISTINCT f.id)::INT AS cnt,
               MIN(f.started_at) AS first_seen,
               MAX(f.started_at) AS last_seen
        FROM operation_flows f
        JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_PAYMENT_COLLECTED' AND vf.actor_id IS NOT NULL
        WHERE f.started_at >= NOW() - (p_days || ' days')::INTERVAL
          AND NOT EXISTS (SELECT 1 FROM flow_events rf WHERE rf.flow_id = f.id AND rf.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED'))
        GROUP BY vf.actor_id, vf.actor_name, vf.actor_role
        HAVING COUNT(DISTINCT f.id) >= 1
    LOOP
        -- Get amount separately to avoid type issues
        SELECT COALESCE(SUM((vf2.metadata->>'total_paid')::NUMERIC), 0) INTO v_amount
        FROM flow_events vf2
        JOIN operation_flows f2 ON f2.id = vf2.flow_id AND f2.created_by = rec.actor_id
        WHERE vf2.event_type = 'VALET_PAYMENT_COLLECTED'
          AND vf2.actor_id = rec.actor_id
          AND NOT EXISTS (SELECT 1 FROM flow_events rf WHERE rf.flow_id = f2.id AND rf.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED'));

        out_employee_id := rec.actor_id;
        out_employee_name := rec.actor_name;
        out_employee_role := rec.actor_role;
        out_anomaly_type := 'PAYMENT_NOT_REGISTERED';
        out_severity := 'CRITICAL';
        out_occurrence_count := rec.cnt;
        out_total_amount := v_amount;
        out_description := rec.cnt || ' pagos cobrados sin registro';
        out_first_seen := rec.first_seen;
        out_last_seen := rec.last_seen;
        RETURN NEXT;
    END LOOP;

    -- Person count mismatches
    FOR rec IN
        SELECT vf.actor_id, vf.actor_name, vf.actor_role,
               COUNT(DISTINCT f.id)::INT AS cnt,
               MIN(f.started_at) AS first_seen,
               MAX(f.started_at) AS last_seen
        FROM operation_flows f
        JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_FORM_SUBMITTED' AND vf.actor_id IS NOT NULL
        JOIN room_stays rs ON rs.id = f.room_stay_id
        WHERE f.started_at >= NOW() - (p_days || ' days')::INTERVAL
          AND (vf.metadata->>'person_count')::INT != rs.current_people
          AND (vf.metadata->>'person_count')::INT > 0 AND rs.current_people > 0
        GROUP BY vf.actor_id, vf.actor_name, vf.actor_role
        HAVING COUNT(DISTINCT f.id) >= 1
    LOOP
        out_employee_id := rec.actor_id;
        out_employee_name := rec.actor_name;
        out_employee_role := rec.actor_role;
        out_anomaly_type := 'PERSON_COUNT_MISMATCH';
        out_severity := 'HIGH';
        out_occurrence_count := rec.cnt;
        out_total_amount := NULL;
        out_description := rec.cnt || ' discrepancias de personas';
        out_first_seen := rec.first_seen;
        out_last_seen := rec.last_seen;
        RETURN NEXT;
    END LOOP;
END;
$$;
