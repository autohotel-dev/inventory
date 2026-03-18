-- Tabla de Logs de Auditoría
-- Cubre: acciones generales (CRUD), mantenimiento/purge, y sesión/auth

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Quién
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id UUID REFERENCES employees(id) ON DELETE SET NULL,
  employee_name TEXT,
  -- Qué
  action TEXT NOT NULL CHECK (action IN (
    'INSERT', 'UPDATE', 'DELETE',
    'LOGIN', 'LOGOUT', 'LOGIN_FAILED',
    'PERMISSION_CHANGE',
    'PURGE_SYSTEM', 'MAINTENANCE'
  )),
  -- Dónde
  table_name TEXT,
  record_id UUID,
  -- Detalles
  description TEXT,
  old_data JSONB,
  new_data JSONB,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  -- Cuándo
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_employee ON audit_logs(employee_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_table ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_record ON audit_logs(record_id) WHERE record_id IS NOT NULL;

-- RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Solo admins/managers pueden ver logs
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

-- Cualquier usuario autenticado puede insertar logs
CREATE POLICY audit_logs_insert_policy ON audit_logs
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Nadie puede modificar ni borrar logs (excepto purgesystem con SECURITY DEFINER)
-- No se crean policies de UPDATE ni DELETE

-- Función helper para insertar logs fácilmente desde el frontend
CREATE OR REPLACE FUNCTION log_audit(
  p_action TEXT,
  p_table_name TEXT DEFAULT NULL,
  p_record_id UUID DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_old_data JSONB DEFAULT NULL,
  p_new_data JSONB DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_employee RECORD;
  v_log_id UUID;
BEGIN
  -- Obtener info del empleado actual
  SELECT id, first_name || ' ' || last_name AS full_name
  INTO v_employee
  FROM employees
  WHERE auth_user_id = auth.uid()
  LIMIT 1;

  INSERT INTO audit_logs (
    user_id, employee_id, employee_name,
    action, table_name, record_id,
    description, old_data, new_data, metadata
  ) VALUES (
    auth.uid(), v_employee.id, v_employee.full_name,
    p_action, p_table_name, p_record_id,
    p_description, p_old_data, p_new_data, p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

GRANT EXECUTE ON FUNCTION log_audit(TEXT, TEXT, UUID, TEXT, JSONB, JSONB, JSONB) TO authenticated;

-- Función de limpieza de logs antiguos (más de 90 días)
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$;

COMMENT ON TABLE audit_logs IS 'Registro de auditoría: acciones CRUD, login/logout, mantenimiento y cambios de permisos';
