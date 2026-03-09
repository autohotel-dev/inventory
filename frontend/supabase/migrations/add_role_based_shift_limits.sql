-- =====================================================
-- MIGRACIÓN: Límites de Turnos por Rol
-- =====================================================
-- Esta migración reemplaza el constraint global de un solo turno activo
-- con una validación por rol que permite diferentes límites según el tipo
-- de empleado.
--
-- Configuración de límites:
--   - receptionist: 1 turno activo máximo
--   - cochero: 2 turnos activos máximo
--   - camarista: 1 turno activo máximo
--   - mantenimiento: 2 turnos activos máximo
--   - otros roles: sin límite explícito (admin, manager, supervisor)

-- =====================================================
-- PASO 1: ELIMINAR EL ÍNDICE ÚNICO GLOBAL ANTERIOR
-- =====================================================
DROP INDEX IF EXISTS idx_single_active_shift_session;

-- =====================================================
-- PASO 2: CREAR FUNCIÓN DE VALIDACIÓN POR ROL
-- =====================================================
CREATE OR REPLACE FUNCTION check_shift_limit_by_role()
RETURNS TRIGGER AS $$
DECLARE
  employee_role TEXT;
  active_count INTEGER;
  max_allowed INTEGER;
  role_display_name TEXT;
BEGIN
  -- Solo validar si el status es 'active'
  IF NEW.status != 'active' THEN
    RETURN NEW;
  END IF;

  -- Obtener el rol del empleado
  SELECT role INTO employee_role
  FROM employees
  WHERE id = NEW.employee_id;

  -- Definir límites por rol
  CASE employee_role
    WHEN 'receptionist' THEN 
      max_allowed := 1;
      role_display_name := 'Recepcionista';
    WHEN 'cochero' THEN 
      max_allowed := 2;
      role_display_name := 'Cochero';
    WHEN 'camarista' THEN 
      max_allowed := 1;
      role_display_name := 'Camarista';
    WHEN 'mantenimiento' THEN 
      max_allowed := 2;
      role_display_name := 'Mantenimiento';
    ELSE
      -- Admin, manager, supervisor: sin límite (usar 999 como "sin límite")
      max_allowed := 999;
      role_display_name := employee_role;
  END CASE;

  -- Contar turnos activos actuales para este rol
  SELECT COUNT(*) INTO active_count
  FROM shift_sessions ss
  JOIN employees e ON e.id = ss.employee_id
  WHERE ss.status = 'active'
    AND e.role = employee_role;

  -- Verificar si se excede el límite
  IF active_count >= max_allowed THEN
    RAISE EXCEPTION 'ROLE_SHIFT_LIMIT_EXCEEDED::%::%::%', 
      role_display_name, 
      active_count, 
      max_allowed
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- PASO 3: CREAR TRIGGER
-- =====================================================
DROP TRIGGER IF EXISTS trg_check_shift_limit ON shift_sessions;

CREATE TRIGGER trg_check_shift_limit
  BEFORE INSERT ON shift_sessions
  FOR EACH ROW
  EXECUTE FUNCTION check_shift_limit_by_role();

-- =====================================================
-- PASO 4: CREAR ÍNDICE PARA OPTIMIZAR CONSULTAS
-- =====================================================
-- Índice compuesto para consultas de turnos activos por rol
CREATE INDEX IF NOT EXISTS idx_shift_sessions_active_by_role 
ON shift_sessions (status) 
WHERE status = 'active';

-- =====================================================
-- COMENTARIOS
-- =====================================================
COMMENT ON FUNCTION check_shift_limit_by_role IS 
  'Valida que no se exceda el límite de turnos activos por rol antes de insertar un nuevo turno. Límites: receptionist=1, cochero=2, camarista=1, mantenimiento=2';

COMMENT ON TRIGGER trg_check_shift_limit ON shift_sessions IS
  'Trigger que ejecuta la validación de límites de turno por rol antes de cada INSERT';

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
DO $$
BEGIN
  RAISE NOTICE '✓ Migración completada: Límites de turnos por rol configurados';
  RAISE NOTICE '  - receptionist: máximo 1 turno activo';
  RAISE NOTICE '  - cochero: máximo 2 turnos activos';
  RAISE NOTICE '  - camarista: máximo 1 turno activo';
  RAISE NOTICE '  - mantenimiento: máximo 2 turnos activos';
END $$;
