-- ================================================================
-- Simplified Employee Risk Overview
-- Works without requiring operation_flows/flow_events data
-- ================================================================

CREATE OR REPLACE FUNCTION get_all_employees_risk_overview()
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    employee_role TEXT,
    risk_score NUMERIC,
    risk_level TEXT,
    total_operations INT,
    anomalies_detected INT,
    incidents_reported INT,
    payment_discrepancies INT,
    person_mismatches INT,
    courtesy_abuse_count INT,
    fast_checkout_count INT,
    activity_summary JSONB,
    recent_incidents JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    emp_rec RECORD;
    v_total_ops INT := 0;
    v_anomalies INT := 0;
    v_incidents INT := 0;
    v_payment_disc INT := 0;
    v_person_mismatches INT := 0;
    v_courtesy_abuse INT := 0;
    v_fast_checkouts INT := 0;
    v_risk_score NUMERIC;
    v_risk_level TEXT;
    v_recent_incidents JSONB;
BEGIN
    FOR emp_rec IN
        SELECT e.id, e.first_name || ' ' || e.last_name AS name, e.role
        FROM employees e WHERE e.is_active = true
    LOOP
        -- Count operations (safe even if table is empty)
        SELECT COUNT(*) INTO v_total_ops FROM operation_flows WHERE created_by = emp_rec.id;

        -- Count anomalies
        SELECT COUNT(*) INTO v_anomalies FROM flow_events
        WHERE actor_id = emp_rec.id
        AND event_type IN ('VALET_PAYMENT_COLLECTED', 'VALET_FORM_SUBMITTED');

        -- Count incidents
        SELECT COUNT(*) INTO v_incidents FROM incident_reports
        WHERE target_employee_id = emp_rec.id AND status != 'DISMISSED';

        -- Count payment discrepancies
        SELECT COUNT(DISTINCT f.id) INTO v_payment_disc
        FROM operation_flows f
        JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_PAYMENT_COLLECTED' AND vf.actor_id = emp_rec.id
        WHERE NOT EXISTS (SELECT 1 FROM flow_events rf WHERE rf.flow_id = f.id AND rf.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED'));

        -- Count person mismatches
        SELECT COUNT(DISTINCT f.id) INTO v_person_mismatches
        FROM operation_flows f
        JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_FORM_SUBMITTED' AND vf.actor_id = emp_rec.id
        JOIN room_stays rs ON rs.id = f.room_stay_id
        WHERE (vf.metadata->>'person_count')::INT != rs.current_people
          AND (vf.metadata->>'person_count')::INT > 0 AND rs.current_people > 0;

        -- Count courtesy abuse
        SELECT COUNT(*) INTO v_courtesy_abuse FROM flow_events
        WHERE actor_id = emp_rec.id AND event_type = 'COURTESY_APPLIED';

        -- Count fast checkouts
        SELECT COUNT(*) INTO v_fast_checkouts FROM operation_flows
        WHERE created_by = emp_rec.id
        AND completed_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (completed_at - started_at)) < 120;

        -- Calculate risk score
        v_risk_score := 0;
        v_risk_score := v_risk_score + (v_payment_disc * 25);
        v_risk_score := v_risk_score + (v_person_mismatches * 15);
        v_risk_score := v_risk_score + (v_incidents * 20);
        v_risk_score := v_risk_score + (v_courtesy_abuse * 10);
        v_risk_score := v_risk_score + (v_fast_checkouts * 5);
        v_risk_score := LEAST(v_risk_score, 100);

        IF v_risk_score >= 75 THEN v_risk_level := 'CRITICAL';
        ELSIF v_risk_score >= 50 THEN v_risk_level := 'HIGH';
        ELSIF v_risk_score >= 25 THEN v_risk_level := 'MEDIUM';
        ELSE v_risk_level := 'LOW';
        END IF;

        -- Get recent incidents
        SELECT jsonb_agg(jsonb_build_object(
            'title', ir.title, 'severity', ir.severity, 'status', ir.status,
            'created_at', ir.created_at, 'incident_type', ir.incident_type
        )) INTO v_recent_incidents
        FROM incident_reports ir
        WHERE ir.target_employee_id = emp_rec.id
        ORDER BY ir.created_at DESC LIMIT 5;

        employee_id := emp_rec.id;
        employee_name := emp_rec.name;
        employee_role := emp_rec.role;
        risk_score := v_risk_score;
        risk_level := v_risk_level;
        total_operations := v_total_ops;
        anomalies_detected := v_anomalies;
        incidents_reported := v_incidents;
        payment_discrepancies := v_payment_disc;
        person_mismatches := v_person_mismatches;
        courtesy_abuse_count := v_courtesy_abuse;
        fast_checkout_count := v_fast_checkouts;
        activity_summary := jsonb_build_object(
            'total_operations', v_total_ops,
            'anomalies', v_anomalies,
            'payment_discrepancies', v_payment_disc,
            'person_mismatches', v_person_mismatches,
            'fast_checkouts', v_fast_checkouts
        );
        recent_incidents := COALESCE(v_recent_incidents, '[]'::jsonb);

        RETURN NEXT;
    END LOOP;
END;
$$;
