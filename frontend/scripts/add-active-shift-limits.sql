-- =====================================================
-- AGREGAR LIMITES DE TURNOS ACTIVOS POR ROL
-- =====================================================

-- 1. Agregar columnas a system_config
ALTER TABLE system_config 
ADD COLUMN IF NOT EXISTS max_shifts_receptionist INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS max_shifts_valet INTEGER DEFAULT 4,
ADD COLUMN IF NOT EXISTS max_shifts_admin INTEGER DEFAULT 2;

COMMENT ON COLUMN system_config.max_shifts_receptionist IS 'Máximo de recepcionistas con turno activo simultáneamente';
COMMENT ON COLUMN system_config.max_shifts_valet IS 'Máximo de cocheros con turno activo simultáneamente';
COMMENT ON COLUMN system_config.max_shifts_admin IS 'Máximo de administradores con turno activo simultáneamente';

-- 2. Función para validar límites antes de iniciar turno
CREATE OR REPLACE FUNCTION check_active_shift_limits()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_role VARCHAR;
  v_active_count INTEGER;
  v_limit INTEGER;
BEGIN
  -- Obtener rol del empleado que intenta iniciar turno
  SELECT role INTO v_employee_role 
  FROM employees 
  WHERE id = NEW.employee_id;

  -- Contar cuantos turnos activos hay YA para ese rol (sin contar el actual si fuera update, pero es insert)
  -- Solo contamos turnos activos (status = 'active' y clock_out_at IS NULL)
  SELECT COUNT(*) INTO v_active_count
  FROM shift_sessions ss
  JOIN employees e ON e.id = ss.employee_id
  WHERE ss.status = 'active' 
    AND ss.clock_out_at IS NULL
    AND e.role = v_employee_role;

  -- Obtener límite configurado
  SELECT 
    CASE 
      WHEN v_employee_role = 'receptionist' THEN max_shifts_receptionist
      WHEN v_employee_role = 'cochero' THEN max_shifts_valet -- 'cochero' es el rol en DB? Verificar.
      WHEN v_employee_role = 'admin' THEN max_shifts_admin
      WHEN v_employee_role = 'manager' THEN max_shifts_admin -- Manager usa limite de admin? O agregamos columna?
      ELSE 999 -- Sin limite para otros roles
    END INTO v_limit
  FROM system_config
  LIMIT 1;

  -- Validar
  -- Si v_active_count ya es igual o mayor al límite, NO permitir iniciar uno nuevo.
  IF v_active_count >= v_limit THEN
    RAISE EXCEPTION 'ROLE_SHIFT_LIMIT_EXCEEDED::%', v_employee_role;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger
DROP TRIGGER IF EXISTS check_shift_limits_trigger ON shift_sessions;
CREATE TRIGGER check_shift_limits_trigger
  BEFORE INSERT ON shift_sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_active_shift_limits();
