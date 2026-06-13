-- ================================================================
-- get_all_employees_risk_overview - Fixed with out_ prefixes
-- ================================================================

DROP FUNCTION IF EXISTS get_all_employees_risk_overview();

CREATE OR REPLACE FUNCTION get_all_employees_risk_overview()
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
    emp_rec RECORD;
    v_total_ops INT;
    v_anomalies INT;
    v_incidents INT;
    v_payment_disc INT;
    v_courtesy_abuse INT;
    v_fast_checkouts INT;
    v_risk_score NUMERIC;
    v_risk_level TEXT;
    v_audit_count INT;
    v_recent_incidents JSONB;
BEGIN
    FOR emp_rec IN SELECT e.id, e.first_name || ' ' || e.last_name AS name, e.role FROM employees e WHERE e.is_active = true LOOP
        v_total_ops := 0; v_anomalies := 0; v_incidents := 0;
        v_payment_disc := 0; v_courtesy_abuse := 0; v_fast_checkouts := 0;
        v_audit_count := 0;

        SELECT COUNT(*) INTO v_audit_count FROM audit_logs WHERE employee_id = emp_rec.id;
        SELECT COUNT(*) INTO v_total_ops FROM operation_flows WHERE created_by = emp_rec.id;
        v_total_ops := v_total_ops + v_audit_count;

        SELECT COUNT(*) INTO v_anomalies FROM flow_events
        WHERE actor_id = emp_rec.id AND event_type IN ('VALET_PAYMENT_COLLECTED', 'VALET_FORM_SUBMITTED');

        SELECT COUNT(*) INTO v_incidents FROM incident_reports
        WHERE target_employee_id = emp_rec.id AND status != 'DISMISSED';

        SELECT COUNT(*) INTO v_courtesy_abuse FROM audit_logs
        WHERE employee_id = emp_rec.id AND action = 'COURTESY';

        v_payment_disc := (SELECT COUNT(*) FROM audit_logs
        WHERE employee_id = emp_rec.id AND action IN ('CANCEL_CHARGE', 'DAMAGE_CHARGE'));

        SELECT COUNT(*) INTO v_fast_checkouts FROM operation_flows
        WHERE created_by = emp_rec.id AND completed_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (completed_at - started_at)) < 120;

        v_risk_score := (v_payment_disc * 25) + (v_incidents * 20) + (v_courtesy_abuse * 10) + (v_fast_checkouts * 5);
        v_risk_score := LEAST(v_risk_score, 100);
        IF v_risk_score >= 75 THEN v_risk_level := 'CRITICAL';
        ELSIF v_risk_score >= 50 THEN v_risk_level := 'HIGH';
        ELSIF v_risk_score >= 25 THEN v_risk_level := 'MEDIUM';
        ELSE v_risk_level := 'LOW';
        END IF;

        SELECT jsonb_agg(jsonb_build_object('title', ir.title, 'severity', ir.severity, 'status', ir.status, 'created_at', ir.created_at)) INTO v_recent_incidents
        FROM incident_reports ir WHERE ir.target_employee_id = emp_rec.id ORDER BY ir.created_at DESC LIMIT 5;

        out_employee_id := emp_rec.id;
        out_employee_name := emp_rec.name;
        out_employee_role := emp_rec.role;
        out_risk_score := v_risk_score;
        out_risk_level := v_risk_level;
        out_total_operations := v_total_ops;
        out_anomalies_detected := v_anomalies;
        out_incidents_reported := v_incidents;
        out_payment_discrepancies := v_payment_disc;
        out_person_mismatches := 0;
        out_courtesy_abuse_count := v_courtesy_abuse;
        out_fast_checkout_count := v_fast_checkouts;
        out_activity_summary := jsonb_build_object('total_operations', v_total_ops, 'audit_entries', v_audit_count, 'anomalies', v_anomalies);
        out_recent_incidents := COALESCE(v_recent_incidents, '[]'::jsonb);
        RETURN NEXT;
    END LOOP;
END;
$$;
