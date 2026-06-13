-- ================================================================
-- get_employee_risk_summary - Fixed with out_ prefixes
-- ================================================================

DROP FUNCTION IF EXISTS get_employee_risk_summary(UUID);

CREATE OR REPLACE FUNCTION get_employee_risk_summary(
    p_emp_id UUID
)
RETURNS TABLE (
    out_employee_id UUID,
    out_employee_name TEXT,
    out_employee_role TEXT,
    out_risk_score NUMERIC,
    out_risk_level TEXT,
    out_total_operations INT,
    out_anomalies_detected INT,
    out_incidents_reported INT,
    out_payment_discrepancies INT,
    out_person_mismatches INT,
    out_courtesy_abuse_count INT,
    out_fast_checkout_count INT,
    out_activity_summary JSONB,
    out_recent_incidents JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_ops INT := 0;
    v_anomalies INT := 0;
    v_incidents INT := 0;
    v_payment_disc INT := 0;
    v_person_mismatches INT := 0;
    v_courtesy_abuse INT := 0;
    v_fast_checkouts INT := 0;
    v_risk_score NUMERIC;
    v_risk_level TEXT;
    v_emp_name TEXT;
    v_emp_role TEXT;
    v_audit_count INT := 0;
    v_recent_incidents JSONB;
BEGIN
    SELECT e.first_name || ' ' || e.last_name, e.role INTO v_emp_name, v_emp_role
    FROM employees e WHERE e.id = p_emp_id;

    SELECT COUNT(*) INTO v_total_ops FROM operation_flows WHERE created_by = p_emp_id;
    SELECT COUNT(*) INTO v_audit_count FROM audit_logs WHERE employee_id = p_emp_id;
    v_total_ops := v_total_ops + v_audit_count;

    SELECT COUNT(*) INTO v_anomalies FROM flow_events
    WHERE actor_id = p_emp_id AND event_type IN ('VALET_PAYMENT_COLLECTED', 'VALET_FORM_SUBMITTED');

    SELECT COUNT(*) INTO v_incidents FROM incident_reports
    WHERE target_employee_id = p_emp_id AND status != 'DISMISSED';

    SELECT COUNT(DISTINCT f.id) INTO v_payment_disc
    FROM operation_flows f
    JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_PAYMENT_COLLECTED' AND vf.actor_id = p_emp_id
    WHERE NOT EXISTS (SELECT 1 FROM flow_events rf WHERE rf.flow_id = f.id AND rf.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED'));

    v_payment_disc := v_payment_disc + (
        SELECT COUNT(*) FROM audit_logs
        WHERE employee_id = p_emp_id AND action IN ('CANCEL_CHARGE', 'DAMAGE_CHARGE')
    );

    SELECT COUNT(*) INTO v_courtesy_abuse FROM audit_logs
    WHERE employee_id = p_emp_id AND action = 'COURTESY';

    SELECT COUNT(*) INTO v_fast_checkouts FROM operation_flows
    WHERE created_by = p_emp_id AND completed_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (completed_at - started_at)) < 120;

    v_risk_score := (v_payment_disc * 25) + (v_person_mismatches * 15) + (v_incidents * 20) + (v_courtesy_abuse * 10) + (v_fast_checkouts * 5);
    v_risk_score := LEAST(v_risk_score, 100);
    IF v_risk_score >= 75 THEN v_risk_level := 'CRITICAL';
    ELSIF v_risk_score >= 50 THEN v_risk_level := 'HIGH';
    ELSIF v_risk_score >= 25 THEN v_risk_level := 'MEDIUM';
    ELSE v_risk_level := 'LOW';
    END IF;

    SELECT jsonb_agg(sub.inc) INTO v_recent_incidents
    FROM (SELECT jsonb_build_object('title', title, 'severity', severity, 'status', status, 'created_at', created_at) AS inc
    FROM incident_reports WHERE target_employee_id = p_emp_id ORDER BY created_at DESC LIMIT 5) sub;

    out_employee_id := p_emp_id;
    out_employee_name := v_emp_name;
    out_employee_role := v_emp_role;
    out_risk_score := v_risk_score;
    out_risk_level := v_risk_level;
    out_total_operations := v_total_ops;
    out_anomalies_detected := v_anomalies;
    out_incidents_reported := v_incidents;
    out_payment_discrepancies := v_payment_disc;
    out_person_mismatches := v_person_mismatches;
    out_courtesy_abuse_count := v_courtesy_abuse;
    out_fast_checkout_count := v_fast_checkouts;
    out_activity_summary := jsonb_build_object('total_operations', v_total_ops, 'audit_entries', v_audit_count, 'anomalies', v_anomalies, 'payment_discrepancies', v_payment_disc);
    out_recent_incidents := COALESCE(v_recent_incidents, '[]'::jsonb);
    RETURN NEXT;
END;
$$;
