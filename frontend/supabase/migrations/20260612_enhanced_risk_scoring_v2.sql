-- ================================================================
-- Enhanced Risk Scoring - Fixed version with consistent out_ prefixes
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
    out_cash_payment_ratio NUMERIC,
    out_void_count INT,
    out_refund_count INT,
    out_adjustment_count INT,
    out_last_anomaly_days INT,
    out_risk_factors JSONB,
    out_activity_summary JSONB,
    out_recent_incidents JSONB
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
    v_courtesy_abuse INT := 0;
    v_fast_checkouts INT := 0;
    v_audit_count INT := 0;
    v_risk_score NUMERIC;
    v_risk_level TEXT;
    v_recent_incidents JSONB;
    v_risk_factors JSONB := '[]'::jsonb;
    v_cash_count INT := 0;
    v_total_payments INT := 0;
    v_cash_ratio NUMERIC := 0;
    v_void_count INT := 0;
    v_refund_count INT := 0;
    v_adjustment_count INT := 0;
    v_last_anomaly_days INT := 999;
    v_last_anomaly_date TIMESTAMPTZ;
    v_points NUMERIC := 0;
BEGIN
    FOR emp_rec IN
        SELECT e.id, e.first_name || ' ' || e.last_name AS name, e.role
        FROM employees e WHERE e.is_active = true AND e.role IN ('cochero', 'receptionist')
    LOOP
        -- Reset counters
        v_total_ops := 0; v_anomalies := 0; v_incidents := 0;
        v_payment_disc := 0; v_courtesy_abuse := 0; v_fast_checkouts := 0;
        v_audit_count := 0; v_cash_count := 0; v_total_payments := 0;
        v_void_count := 0; v_refund_count := 0; v_adjustment_count := 0;
        v_points := 0; v_risk_factors := '[]'::jsonb;

        -- 1. Total operations
        SELECT COUNT(*) INTO v_audit_count FROM audit_logs WHERE employee_id = emp_rec.id;
        SELECT COUNT(*) INTO v_total_ops FROM operation_flows WHERE created_by = emp_rec.id;
        v_total_ops := v_total_ops + v_audit_count;

        -- 2. Anomalies from flow_events
        SELECT COUNT(*) INTO v_anomalies FROM flow_events
        WHERE actor_id = emp_rec.id AND event_type IN ('VALET_PAYMENT_COLLECTED', 'VALET_FORM_SUBMITTED');

        -- 3. Incidents reported
        SELECT COUNT(*) INTO v_incidents FROM incident_reports
        WHERE target_employee_id = emp_rec.id AND status != 'DISMISSED';

        -- 4. Courtesy abuse
        SELECT COUNT(*) INTO v_courtesy_abuse FROM audit_logs
        WHERE employee_id = emp_rec.id AND action = 'COURTESY';

        -- 5. Void/Cancel transactions
        SELECT COUNT(*) INTO v_void_count FROM audit_logs
        WHERE employee_id = emp_rec.id AND action IN ('CANCEL_CHARGE', 'CANCEL_ITEM');

        -- 6. Refunds
        SELECT COUNT(*) INTO v_refund_count FROM audit_logs
        WHERE employee_id = emp_rec.id AND action = 'PAYMENT_REFUNDED';

        -- 7. Manual adjustments
        v_adjustment_count := (SELECT COUNT(*) FROM audit_logs
        WHERE employee_id = emp_rec.id AND action IN ('DAMAGE_CHARGE', 'ADMIN_OVERRIDE'));

        -- 8. Payment discrepancies
        v_payment_disc := v_void_count + v_refund_count + v_adjustment_count;

        -- 9. Cash payment ratio
        SELECT COUNT(*) INTO v_cash_count FROM audit_logs
        WHERE employee_id = emp_rec.id AND payment_method = 'EFECTIVO';
        SELECT COUNT(*) INTO v_total_payments FROM audit_logs
        WHERE employee_id = emp_rec.id AND payment_method IS NOT NULL;
        IF v_total_payments > 0 THEN
            v_cash_ratio := (v_cash_count::NUMERIC / v_total_payments) * 100;
        END IF;

        -- 10. Fast checkouts
        SELECT COUNT(*) INTO v_fast_checkouts FROM operation_flows
        WHERE created_by = emp_rec.id AND completed_at IS NOT NULL
        AND EXTRACT(EPOCH FROM (completed_at - started_at)) < 120;

        -- 11. Days since last anomaly
        SELECT MAX(created_at) INTO v_last_anomaly_date FROM flow_events
        WHERE actor_id = emp_rec.id AND event_type IN ('VALET_PAYMENT_COLLECTED', 'VALET_FORM_SUBMITTED');
        IF v_last_anomaly_date IS NOT NULL THEN
            v_last_anomaly_days := EXTRACT(EPOCH FROM (NOW() - v_last_anomaly_date)) / 86400;
        END IF;

        -- === RISK SCORE CALCULATION (0-100) ===
        v_points := 0;

        -- Payment discrepancies (up to 30 pts)
        IF v_payment_disc >= 5 THEN v_points := v_points + 30;
        ELSIF v_payment_disc >= 3 THEN v_points := v_points + 20;
        ELSIF v_payment_disc >= 1 THEN v_points := v_points + 10;
        END IF;
        IF v_payment_disc > 0 THEN v_risk_factors := v_risk_factors || jsonb_build_object('factor', 'Discrepancias en pagos', 'count', v_payment_disc, 'points', CASE WHEN v_payment_disc >= 5 THEN 30 WHEN v_payment_disc >= 3 THEN 20 ELSE 10 END); END IF;

        -- Incidents (up to 25 pts)
        IF v_incidents >= 3 THEN v_points := v_points + 25;
        ELSIF v_incidents >= 2 THEN v_points := v_points + 18;
        ELSIF v_incidents >= 1 THEN v_points := v_points + 10;
        END IF;
        IF v_incidents > 0 THEN v_risk_factors := v_risk_factors || jsonb_build_object('factor', 'Incidentes reportados', 'count', v_incidents, 'points', CASE WHEN v_incidents >= 3 THEN 25 WHEN v_incidents >= 2 THEN 18 ELSE 10 END); END IF;

        -- Courtesy abuse (up to 15 pts)
        IF v_courtesy_abuse >= 5 THEN v_points := v_points + 15;
        ELSIF v_courtesy_abuse >= 3 THEN v_points := v_points + 10;
        ELSIF v_courtesy_abuse >= 1 THEN v_points := v_points + 5;
        END IF;
        IF v_courtesy_abuse > 0 THEN v_risk_factors := v_risk_factors || jsonb_build_object('factor', 'Abuso de cortesias', 'count', v_courtesy_abuse, 'points', CASE WHEN v_courtesy_abuse >= 5 THEN 15 WHEN v_courtesy_abuse >= 3 THEN 10 ELSE 5 END); END IF;

        -- Cash payment ratio (up to 10 pts)
        IF v_cash_ratio > 80 THEN v_points := v_points + 10;
        ELSIF v_cash_ratio > 60 THEN v_points := v_points + 5;
        END IF;
        IF v_cash_ratio > 60 THEN v_risk_factors := v_risk_factors || jsonb_build_object('factor', 'Alto porcentaje de efectivo', 'percentage', ROUND(v_cash_ratio, 1), 'points', CASE WHEN v_cash_ratio > 80 THEN 10 ELSE 5 END); END IF;

        -- Void/Cancel transactions (up to 10 pts)
        IF v_void_count >= 3 THEN v_points := v_points + 10;
        ELSIF v_void_count >= 1 THEN v_points := v_points + 5;
        END IF;
        IF v_void_count > 0 THEN v_risk_factors := v_risk_factors || jsonb_build_object('factor', 'Transacciones anuladas', 'count', v_void_count, 'points', CASE WHEN v_void_count >= 3 THEN 10 ELSE 5 END); END IF;

        -- Refunds (up to 10 pts)
        IF v_refund_count >= 2 THEN v_points := v_points + 10;
        ELSIF v_refund_count >= 1 THEN v_points := v_points + 5;
        END IF;
        IF v_refund_count > 0 THEN v_risk_factors := v_risk_factors || jsonb_build_object('factor', 'Reembolsos procesados', 'count', v_refund_count, 'points', CASE WHEN v_refund_count >= 2 THEN 10 ELSE 5 END); END IF;

        -- Fast checkouts (up to 5 pts)
        IF v_fast_checkouts >= 3 THEN v_points := v_points + 5;
        ELSIF v_fast_checkouts >= 1 THEN v_points := v_points + 3;
        END IF;

        -- Recent anomaly (up to 5 pts)
        IF v_last_anomaly_days < 7 THEN v_points := v_points + 5;
        ELSIF v_last_anomaly_days < 30 THEN v_points := v_points + 3;
        END IF;

        -- Calculate final score
        v_risk_score := LEAST(v_points, 100);

        -- Determine risk level
        IF v_risk_score >= 75 THEN v_risk_level := 'CRITICAL';
        ELSIF v_risk_score >= 50 THEN v_risk_level := 'HIGH';
        ELSIF v_risk_score >= 25 THEN v_risk_level := 'MEDIUM';
        ELSE v_risk_level := 'LOW';
        END IF;

        -- Get recent incidents
        SELECT jsonb_agg(sub.inc) INTO v_recent_incidents
        FROM (SELECT jsonb_build_object('title', title, 'severity', severity, 'status', status, 'created_at', created_at) AS inc
        FROM incident_reports WHERE target_employee_id = emp_rec.id ORDER BY created_at DESC LIMIT 5) sub;

        -- Output all fields
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
        out_cash_payment_ratio := ROUND(v_cash_ratio, 1);
        out_void_count := v_void_count;
        out_refund_count := v_refund_count;
        out_adjustment_count := v_adjustment_count;
        out_last_anomaly_days := v_last_anomaly_days;
        out_risk_factors := v_risk_factors;
        out_activity_summary := jsonb_build_object(
            'total_operations', v_total_ops,
            'audit_entries', v_audit_count,
            'cash_payments', v_cash_count,
            'total_payments', v_total_payments,
            'cash_ratio', ROUND(v_cash_ratio, 1)
        );
        out_recent_incidents := COALESCE(v_recent_incidents, '[]'::jsonb);
        RETURN NEXT;
    END LOOP;
END;
$$;
