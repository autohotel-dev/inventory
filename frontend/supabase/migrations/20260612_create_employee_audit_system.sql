-- ================================================================
-- Employee Audit & Fraud Investigation System
-- Complete tracking, incident reporting, and risk scoring
-- ================================================================

-- 1. employee_activity_log: Every action by every employee
CREATE TABLE IF NOT EXISTS employee_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id),
    employee_name TEXT NOT NULL,
    employee_role TEXT NOT NULL,
    action_type TEXT NOT NULL,
    action_category TEXT NOT NULL DEFAULT 'GENERAL',
    entity_type TEXT,
    entity_id UUID,
    room_number TEXT,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    ip_address TEXT,
    session_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_eal_employee ON employee_activity_log(employee_id);
CREATE INDEX IF NOT EXISTS idx_eal_action ON employee_activity_log(action_type);
CREATE INDEX IF NOT EXISTS idx_eal_room ON employee_activity_log(room_number);
CREATE INDEX IF NOT EXISTS idx_eal_created ON employee_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_eal_category ON employee_activity_log(action_category);

-- 2. incident_reports: Document fraud incidents with evidence
CREATE TABLE IF NOT EXISTS incident_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_number SERIAL,
    reported_by UUID NOT NULL REFERENCES employees(id),
    reported_by_name TEXT NOT NULL,
    target_employee_id UUID REFERENCES employees(id),
    target_employee_name TEXT NOT NULL,
    incident_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'MEDIUM',
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    evidence_type TEXT,
    evidence_url TEXT,
    evidence_notes TEXT,
    room_number TEXT,
    amount_involved NUMERIC(10,2),
    shift_session_id UUID REFERENCES shift_sessions(id),
    operation_flow_id UUID REFERENCES operation_flows(id),
    status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'INVESTIGATING', 'CONFIRMED', 'DISMISSED', 'RESOLVED')),
    resolution_notes TEXT,
    resolved_by UUID REFERENCES employees(id),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ir_target ON incident_reports(target_employee_id);
CREATE INDEX IF NOT EXISTS idx_ir_status ON incident_reports(status);
CREATE INDEX IF NOT EXISTS idx_ir_type ON incident_reports(incident_type);
CREATE INDEX IF NOT EXISTS idx_ir_created ON incident_reports(created_at DESC);

-- 3. employee_risk_scores: Calculated risk scores per employee
CREATE TABLE IF NOT EXISTS employee_risk_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    employee_id UUID NOT NULL REFERENCES employees(id) UNIQUE,
    employee_name TEXT NOT NULL,
    employee_role TEXT NOT NULL,
    risk_score NUMERIC(5,2) NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL DEFAULT 'LOW' CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
    total_operations INT DEFAULT 0,
    anomalies_detected INT DEFAULT 0,
    incidents_reported INT DEFAULT 0,
    payment_discrepancies INT DEFAULT 0,
    person_mismatches INT DEFAULT 0,
    courtesy_abuse_count INT DEFAULT 0,
    fast_checkout_count INT DEFAULT 0,
    last_anomaly_at TIMESTAMPTZ,
    last_incident_at TIMESTAMPTZ,
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ers_risk ON employee_risk_scores(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_ers_level ON employee_risk_scores(risk_level);

-- 4. Auto-update updated_at triggers
CREATE OR REPLACE FUNCTION update_incident_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_employee_risk_scores_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_incident_reports_updated_at
    BEFORE UPDATE ON incident_reports
    FOR EACH ROW EXECUTE FUNCTION update_incident_reports_updated_at();

CREATE TRIGGER trigger_employee_risk_scores_updated_at
    BEFORE UPDATE ON employee_risk_scores
    FOR EACH ROW EXECUTE FUNCTION update_employee_risk_scores_updated_at();

-- 5. RLS policies
ALTER TABLE employee_activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE employee_risk_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read activity" ON employee_activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert activity" ON employee_activity_log FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated read incidents" ON incident_reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert incidents" ON incident_reports FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update incidents" ON incident_reports FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Authenticated read risk" ON employee_risk_scores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated upsert risk" ON employee_risk_scores FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update risk" ON employee_risk_scores FOR UPDATE TO authenticated USING (true);

-- ================================================================
-- RPC: get_employee_audit_trail
-- Complete activity history for an employee
-- ================================================================
CREATE OR REPLACE FUNCTION get_employee_audit_trail(
    p_employee_id UUID DEFAULT NULL,
    p_employee_name TEXT DEFAULT NULL,
    p_date_from TIMESTAMPTZ DEFAULT NOW() - INTERVAL '7 days',
    p_date_to TIMESTAMPTZ DEFAULT NOW(),
    p_action_category TEXT DEFAULT NULL
)
RETURNS TABLE (
    log_id UUID,
    employee_id UUID,
    employee_name TEXT,
    employee_role TEXT,
    action_type TEXT,
    action_category TEXT,
    entity_type TEXT,
    entity_id UUID,
    room_number TEXT,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        eal.id, eal.employee_id, eal.employee_name, eal.employee_role,
        eal.action_type, eal.action_category, eal.entity_type, eal.entity_id,
        eal.room_number, eal.description, eal.metadata, eal.created_at
    FROM employee_activity_log eal
    WHERE (p_employee_id IS NULL OR eal.employee_id = p_employee_id)
      AND (p_employee_name IS NULL OR eal.employee_name ILIKE '%' || p_employee_name || '%')
      AND eal.created_at BETWEEN p_date_from AND p_date_to
      AND (p_action_category IS NULL OR eal.action_category = p_action_category)
    ORDER BY eal.created_at DESC
    LIMIT 200;
END;
$$;

-- ================================================================
-- RPC: scan_historical_anomalies
-- Scan past operations for fraud patterns
-- ================================================================
CREATE OR REPLACE FUNCTION scan_historical_anomalies(
    p_days INT DEFAULT 30
)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    employee_role TEXT,
    anomaly_type TEXT,
    severity TEXT,
    occurrence_count INT,
    total_amount NUMERIC,
    description TEXT,
    sample_flow_ids UUID[],
    first_seen TIMESTAMPTZ,
    last_seen TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    -- Payment not registered (valet collected but reception didn't register)
    SELECT
        valet_fe.actor_id,
        valet_fe.actor_name,
        valet_fe.actor_role,
        'PAYMENT_NOT_REGISTERED'::TEXT,
        'CRITICAL'::TEXT,
        COUNT(DISTINCT f.id)::INT,
        SUM(COALESCE((valet_fe.metadata->>'total_paid')::NUMERIC, 0)),
        format('%s pagos cobrados por cochero sin registro en recepción', COUNT(DISTINCT f.id)),
        ARRAY_AGG(DISTINCT f.id),
        MIN(f.started_at),
        MAX(f.started_at)
    FROM operation_flows f
    JOIN flow_events valet_fe ON valet_fe.flow_id = f.id AND valet_fe.event_type = 'VALET_PAYMENT_COLLECTED'
    WHERE f.started_at >= NOW() - (p_days || ' days')::INTERVAL
      AND valet_fe.actor_id IS NOT NULL
      AND NOT EXISTS (
          SELECT 1 FROM flow_events rf
          WHERE rf.flow_id = f.id
          AND rf.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED')
      )
    GROUP BY valet_fe.actor_id, valet_fe.actor_name, valet_fe.actor_role
    HAVING COUNT(DISTINCT f.id) >= 1

    UNION ALL

    -- Person count mismatches
    SELECT
        valet_fe.actor_id,
        valet_fe.actor_name,
        valet_fe.actor_role,
        'PERSON_COUNT_MISMATCH'::TEXT,
        'HIGH'::TEXT,
        COUNT(DISTINCT f.id)::INT,
        NULL,
        format('%s discrepancias de personas reportadas', COUNT(DISTINCT f.id)),
        ARRAY_AGG(DISTINCT f.id),
        MIN(f.started_at),
        MAX(f.started_at)
    FROM operation_flows f
    JOIN flow_events valet_fe ON valet_fe.flow_id = f.id AND valet_fe.event_type = 'VALET_FORM_SUBMITTED'
    JOIN room_stays rs ON rs.id = f.room_stay_id
    WHERE f.started_at >= NOW() - (p_days || ' days')::INTERVAL
      AND valet_fe.actor_id IS NOT NULL
      AND (valet_fe.metadata->>'person_count')::INT != rs.current_people
      AND (valet_fe.metadata->>'person_count')::INT > 0
      AND rs.current_people > 0
    GROUP BY valet_fe.actor_id, valet_fe.actor_name, valet_fe.actor_role
    HAVING COUNT(DISTINCT f.id) >= 1

    UNION ALL

    -- Payment amount mismatches
    SELECT
        valet_fe.actor_id,
        valet_fe.actor_name,
        valet_fe.actor_role,
        'PAYMENT_AMOUNT_MISMATCH'::TEXT,
        'CRITICAL'::TEXT,
        COUNT(DISTINCT f.id)::INT,
        SUM(ABS(COALESCE((valet_fe.metadata->>'total_paid')::NUMERIC, 0) - COALESCE((rec_fe.metadata->>'amount')::NUMERIC, 0))),
        format('%s discrepancias en montos entre cochero y recepción', COUNT(DISTINCT f.id)),
        ARRAY_AGG(DISTINCT f.id),
        MIN(f.started_at),
        MAX(f.started_at)
    FROM operation_flows f
    JOIN flow_events valet_fe ON valet_fe.flow_id = f.id AND valet_fe.event_type = 'VALET_PAYMENT_COLLECTED'
    JOIN flow_events rec_fe ON rec_fe.flow_id = f.id AND rec_fe.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED')
    WHERE f.started_at >= NOW() - (p_days || ' days')::INTERVAL
      AND valet_fe.actor_id IS NOT NULL
      AND ABS(COALESCE((valet_fe.metadata->>'total_paid')::NUMERIC, 0) - COALESCE((rec_fe.metadata->>'amount')::NUMERIC, 0)) > 0.50
    GROUP BY valet_fe.actor_id, valet_fe.actor_name, valet_fe.actor_role
    HAVING COUNT(DISTINCT f.id) >= 1

    UNION ALL

    -- Unusually fast checkouts per employee
    SELECT
        created_by,
        (SELECT e.first_name || ' ' || e.last_name FROM employees e WHERE e.id = f.created_by),
        (SELECT e.role FROM employees e WHERE e.id = f.created_by),
        'UNUSUALLY_FAST'::TEXT,
        'MEDIUM'::TEXT,
        COUNT(*)::INT,
        NULL,
        format('%s procesos completados en menos de 2 minutos', COUNT(*)),
        ARRAY_AGG(f.id),
        MIN(f.started_at),
        MAX(f.started_at)
    FROM operation_flows f
    WHERE f.started_at >= NOW() - (p_days || ' days')::INTERVAL
      AND EXTRACT(EPOCH FROM (f.completed_at - f.started_at)) < 120
      AND f.completed_at IS NOT NULL
      AND f.created_by IS NOT NULL
    GROUP BY created_by
    HAVING COUNT(*) >= 2

    ORDER BY occurrence_count DESC, total_amount DESC NULLS LAST;
END;
$$;

-- ================================================================
-- RPC: get_employee_risk_summary
-- Get risk summary for a specific employee
-- ================================================================
CREATE OR REPLACE FUNCTION get_employee_risk_summary(
    p_employee_id UUID
)
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
    v_total_ops INT;
    v_anomalies INT;
    v_incidents INT;
    v_payment_disc INT;
    v_person_mismatches INT;
    v_courtesy_abuse INT;
    v_fast_checkouts INT;
    v_risk_score NUMERIC;
    v_risk_level TEXT;
    v_emp_name TEXT;
    v_emp_role TEXT;
BEGIN
    SELECT e.first_name || ' ' || e.last_name, e.role INTO v_emp_name, v_emp_role
    FROM employees e WHERE e.id = p_employee_id;

    -- Count operations
    SELECT COUNT(*) INTO v_total_ops FROM operation_flows WHERE created_by = p_employee_id;

    -- Count anomalies involving this employee
    SELECT COUNT(*) INTO v_anomalies FROM flow_events
    WHERE actor_id = p_employee_id
    AND event_type IN ('VALET_PAYMENT_COLLECTED', 'VALET_FORM_SUBMITTED')
    AND flow_id IN (SELECT id FROM operation_flows WHERE started_at >= NOW() - INTERVAL '30 days');

    -- Count payment discrepancies
    SELECT COUNT(DISTINCT f.id) INTO v_payment_disc
    FROM operation_flows f
    JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_PAYMENT_COLLECTED' AND vf.actor_id = p_employee_id
    WHERE NOT EXISTS (SELECT 1 FROM flow_events rf WHERE rf.flow_id = f.id AND rf.event_type IN ('PAYMENT_REGISTERED', 'PAYMENT_CONFIRMED'));

    -- Count person mismatches
    SELECT COUNT(DISTINCT f.id) INTO v_person_mismatches
    FROM operation_flows f
    JOIN flow_events vf ON vf.flow_id = f.id AND vf.event_type = 'VALET_FORM_SUBMITTED' AND vf.actor_id = p_employee_id
    JOIN room_stays rs ON rs.id = f.room_stay_id
    WHERE (vf.metadata->>'person_count')::INT != rs.current_people
      AND (vf.metadata->>'person_count')::INT > 0 AND rs.current_people > 0;

    -- Count incidents
    SELECT COUNT(*) INTO v_incidents FROM incident_reports WHERE target_employee_id = p_employee_id AND status != 'DISMISSED';

    -- Count courtesy abuse (receptionist)
    SELECT COUNT(*) INTO v_courtesy_abuse FROM flow_events
    WHERE actor_id = p_employee_id AND event_type = 'COURTESY_APPLIED'
    AND flow_id IN (
        SELECT f2.id FROM operation_flows f2
        WHERE f2.created_by = p_employee_id
        AND EXISTS (SELECT 1 FROM flow_events vf WHERE vf.flow_id = f2.id AND vf.event_type = 'VALET_PAYMENT_COLLECTED')
    );

    -- Count fast checkouts
    SELECT COUNT(*) INTO v_fast_checkouts FROM operation_flows
    WHERE created_by = p_employee_id
    AND completed_at IS NOT NULL
    AND EXTRACT(EPOCH FROM (completed_at - started_at)) < 120;

    -- Calculate risk score (0-100)
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

    employee_id := p_employee_id;
    employee_name := v_emp_name;
    employee_role := v_emp_role;
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
        'courtesy_abuse', v_courtesy_abuse,
        'fast_checkouts', v_fast_checkouts
    );
    recent_incidents := (
        SELECT jsonb_agg(jsonb_build_object(
            'title', ir.title, 'severity', ir.severity, 'status', ir.status,
            'created_at', ir.created_at, 'incident_type', ir.incident_type
        ))
        FROM incident_reports ir
        WHERE ir.target_employee_id = p_employee_id
        ORDER BY ir.created_at DESC LIMIT 5
    );

    RETURN NEXT;
END;
$$;

-- ================================================================
-- RPC: get_all_employees_risk_overview
-- Overview of all employees sorted by risk
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
    incidents_reported INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT * FROM get_employee_risk_summary(e.id)
    ORDER BY risk_score DESC;
END;
$$;
