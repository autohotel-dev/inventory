-- Enhanced Audit Logs Table
-- Designed for comprehensive payment flow tracking and system monitoring

CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Event Classification
  event_type TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  action TEXT NOT NULL,
  severity TEXT DEFAULT 'INFO' CHECK (severity IN ('DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL')),
  
  -- Who performed the action
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name TEXT,
  user_role TEXT,
  
  -- What changed
  old_data JSONB,
  new_data JSONB,
  changed_fields TEXT[],
  
  -- Payment-specific context
  session_id UUID,
  room_number TEXT,
  payment_method TEXT,
  amount DECIMAL(10,2),
  
  -- Legacy compatibility
  table_name TEXT,
  record_id UUID,
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Technical details
  ip_address TEXT,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced Indexes for Performance
CREATE INDEX idx_audit_logs_event_type ON audit_logs(event_type);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_employee ON audit_logs(employee_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_severity ON audit_logs(severity);
CREATE INDEX idx_audit_logs_session ON audit_logs(session_id);
CREATE INDEX idx_audit_logs_room ON audit_logs(room_number);
CREATE INDEX idx_audit_logs_payment_method ON audit_logs(payment_method);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
-- CREATE INDEX idx_audit_logs_created_date ON audit_logs(DATE(created_at)); -- Commented out - DATE() function is not IMMUTABLE

-- Composite indexes for common queries
CREATE INDEX idx_audit_logs_employee_date ON audit_logs(employee_id, created_at DESC);
CREATE INDEX idx_audit_logs_event_date ON audit_logs(event_type, created_at DESC);
CREATE INDEX idx_audit_logs_severity_date ON audit_logs(severity, created_at DESC);

-- Row Level Security
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins/managers can view logs
CREATE POLICY audit_logs_select_policy ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM employees
      WHERE auth_user_id = auth.uid()
        AND role IN ('admin', 'manager', 'gerente')
        AND deleted_at IS NULL
    )
  );

-- Any authenticated user can insert logs
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- No one can modify or delete logs (except cleanup function)
-- No UPDATE/DELETE policies created

-- Drop existing function first
DROP FUNCTION IF EXISTS log_audit(TEXT, TEXT, UUID, TEXT, JSONB, JSONB, JSONB);

-- Enhanced logging function
CREATE OR REPLACE FUNCTION log_audit(
  p_event_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_action TEXT DEFAULT 'CREATE',
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}',
  p_severity TEXT DEFAULT 'INFO'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_log_id UUID;
  v_changed_fields TEXT[];
BEGIN
  -- Get current employee info
  SELECT id, first_name || ' ' || last_name AS full_name, role
  INTO v_employee
  FROM employees
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  -- Calculate changed fields
  IF p_old_data IS NOT NULL AND p_new_data IS NOT NULL THEN
    SELECT array_agg(key)
    INTO v_changed_fields
    FROM (
      SELECT key
      FROM jsonb_each_text(p_old_data)
      WHERE jsonb_extract_path_text(p_new_data, key) != value
    ) t;
  END IF;

  -- Extract payment-specific fields from metadata
  INSERT INTO audit_logs (
    event_type, entity_type, entity_id, action, severity,
    user_id, employee_id, employee_name, user_role,
    old_data, new_data, changed_fields,
    session_id, room_number, payment_method, amount,
    description, metadata,
    ip_address, user_agent
  ) VALUES (
    p_event_type, p_entity_type, p_entity_id, p_action, p_severity,
    auth.uid(), v_employee.id, v_employee.full_name, v_employee.role,
    p_old_data, p_new_data, v_changed_fields,
    p_metadata->>'session_id', p_metadata->>'room_number', 
    p_metadata->>'payment_method', (p_metadata->>'amount')::DECIMAL,
    p_description, p_metadata,
    inet_client_addr(), current_setting('request.headers')::json->>'user-agent'
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_audit TO authenticated;

-- Payment flow specific logging function
CREATE OR REPLACE FUNCTION log_payment_flow(
  p_payment_id UUID,
  p_event_type TEXT,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_severity TEXT DEFAULT 'INFO'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_payment RECORD;
  v_metadata JSONB;
BEGIN
  -- Get payment details for context
  SELECT p.*, so.room_id, r.number as room_number
  INTO v_payment
  FROM payments p
  JOIN sales_orders so ON p.sales_order_id = so.id
  LEFT JOIN rooms r ON so.room_id = r.id
  WHERE p.id = p_payment_id;

  -- Build metadata
  v_metadata := jsonb_build_object(
    'payment_method', v_payment.payment_method,
    'amount', v_payment.amount,
    'room_number', v_payment.room_number,
    'session_id', v_payment.shift_session_id,
    'collected_by', v_payment.collected_by
  );

  -- Log the event
  RETURN log_audit(
    p_event_type := p_event_type,
    p_entity_type := 'PAYMENT',
    p_entity_id := p_payment_id,
    p_old_data := p_old_data,
    p_new_data := p_new_data,
    p_description := p_description,
    p_metadata := v_metadata,
    p_severity := p_severity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION log_payment_flow TO authenticated;

-- Drop existing cleanup functions first (both variants)
DROP FUNCTION IF EXISTS cleanup_old_audit_logs();
DROP FUNCTION IF EXISTS cleanup_old_audit_logs(INTEGER);

-- Enhanced cleanup function (configurable retention)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(
  p_days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  -- Log the cleanup action
  INSERT INTO audit_logs (
    event_type, entity_type, entity_id, action, severity,
    description, metadata
  ) VALUES (
    'SYSTEM_MAINTENANCE', 'audit_logs', gen_random_uuid(), 'DELETE', 'INFO',
    format('Cleaned up %s old audit logs (older than %s days)', v_deleted_count, p_days_to_keep),
    jsonb_build_object('deleted_count', v_deleted_count, 'retention_days', p_days_to_keep)
  );
  
  RETURN v_deleted_count;
END;
$$;

GRANT EXECUTE ON FUNCTION cleanup_old_audit_logs TO authenticated;

-- Anomaly detection helper function
CREATE OR REPLACE FUNCTION detect_payment_anomalies()
RETURNS TABLE (
  payment_id UUID,
  anomaly_type TEXT,
  description TEXT,
  severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET row_security = off
AS $$
BEGIN
  RETURN QUERY
  -- Detect payments without collected_by but with payment_method != EFECTIVO
  SELECT 
    p.id,
    'MISSING_COLLECTED_BY',
    'Payment made without collector information',
    'WARNING'
  FROM payments p
  WHERE p.collected_by IS NULL 
    AND p.payment_method != 'EFECTIVO'
    AND p.status = 'PAGADO'
    AND p.created_at > NOW() - INTERVAL '1 day'
  
  UNION ALL
  
  -- Detect payments in wrong shift
  SELECT 
    p.id,
    'WRONG_SHIFT_ASSIGNMENT',
    'Payment assigned to non-receptionist shift',
    'ERROR'
  FROM payments p
  JOIN shift_sessions ss ON p.shift_session_id = ss.id
  JOIN employees e ON ss.employee_id = e.id
  WHERE p.status = 'PAGADO'
    AND p.created_at > NOW() - INTERVAL '1 day'
    AND e.role NOT IN ('receptionist', 'admin', 'manager');
END;
$$;

GRANT EXECUTE ON FUNCTION detect_payment_anomalies TO authenticated;

COMMENT ON TABLE audit_logs IS 'Enhanced audit system: payment flows, user actions, system events, and anomaly detection';
COMMENT ON FUNCTION log_audit IS 'Enhanced audit logging with payment-specific context';
COMMENT ON FUNCTION log_payment_flow IS 'Specialized logging for payment flow events';
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Configurable cleanup of old audit logs';
COMMENT ON FUNCTION detect_payment_anomalies IS 'Automatic detection of payment-related anomalies';
