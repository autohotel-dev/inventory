-- =====================================================
-- MIGRACIÓN: Agregar Estado "pending_closing" a Turnos
-- =====================================================
-- Este script permite que los empleados cierren su turno
-- sin completar el corte inmediatamente, liberando la
-- computadora de recepción para el siguiente turno.

-- =====================================================
-- 1. ACTUALIZAR CONSTRAINT DE ESTADO
-- =====================================================

-- Eliminar constraint existente
ALTER TABLE shift_sessions 
DROP CONSTRAINT IF EXISTS shift_sessions_status_check;

-- Agregar nuevo constraint con pending_closing
ALTER TABLE shift_sessions 
ADD CONSTRAINT shift_sessions_status_check 
CHECK (status IN ('active', 'pending_closing', 'closed', 'cancelled'));

COMMENT ON CONSTRAINT shift_sessions_status_check ON shift_sessions IS 
  'Estados: active (turno activo), pending_closing (cerrado pero sin corte), closed (cerrado con corte), cancelled (cancelado)';

-- =====================================================
-- 2. AGREGAR ÍNDICE PARA BÚSQUEDA EFICIENTE
-- =====================================================

-- Índice para encontrar rápidamente sesiones pendientes de un empleado
CREATE INDEX IF NOT EXISTS idx_shift_sessions_pending_by_employee
ON shift_sessions(employee_id, status, clock_out_at DESC)
WHERE status = 'pending_closing';

COMMENT ON INDEX idx_shift_sessions_pending_by_employee IS 
  'Optimiza búsqueda de turnos pendientes de corte por empleado';

-- =====================================================
-- 3. ACTUALIZAR POLÍTICAS RLS (Si existen)
-- =====================================================

-- Permitir a los empleados ver sus sesiones pending_closing
DROP POLICY IF EXISTS "Users can view their sessions" ON shift_sessions;

CREATE POLICY "Users can view their sessions"
ON shift_sessions
FOR SELECT
USING (
  employee_id IN (
    SELECT id FROM employees WHERE auth_user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- Permitir actualizar solo sus propias sesiones
DROP POLICY IF EXISTS "Users can update their sessions" ON shift_sessions;

CREATE POLICY "Users can update their sessions"
ON shift_sessions
FOR UPDATE
USING (
  employee_id IN (
    SELECT id FROM employees WHERE auth_user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
)
WITH CHECK (
  employee_id IN (
    SELECT id FROM employees WHERE auth_user_id = auth.uid()
  )
  OR
  EXISTS (
    SELECT 1 FROM employees 
    WHERE auth_user_id = auth.uid() 
    AND role IN ('admin', 'manager')
  )
);

-- =====================================================
-- 4. FUNCIÓN AUXILIAR: Contar Cortes Pendientes
-- =====================================================

CREATE OR REPLACE FUNCTION get_pending_closings_count(p_employee_id UUID)
RETURNS INTEGER AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::INTEGER
    FROM shift_sessions
    WHERE employee_id = p_employee_id
    AND status = 'pending_closing'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION get_pending_closings_count IS 
  'Cuenta el número de turnos pendientes de corte para un empleado';

-- =====================================================
-- 5. VALIDACIÓN: Verificar Integridad de Datos
-- =====================================================

-- Verificar que no existan sesiones con clock_out_at pero status='active'
DO $$
DECLARE
  inconsistent_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO inconsistent_count
  FROM shift_sessions
  WHERE status = 'active' AND clock_out_at IS NOT NULL;
  
  IF inconsistent_count > 0 THEN
    RAISE WARNING 'Se encontraron % sesiones con clock_out_at pero status=active. Considera actualizar manualmente.', inconsistent_count;
  END IF;
END;
$$;

-- =====================================================
-- 6. DATOS DE PRUEBA (Opcional - Comentar en producción)
-- =====================================================

-- Ejemplo de cómo quedaría una sesión pending_closing:
/*
UPDATE shift_sessions
SET 
  clock_out_at = NOW(),
  status = 'pending_closing'
WHERE id = 'ID_DE_SESION_DE_PRUEBA';
*/

-- =====================================================
-- 7. VERIFICACIÓN POST-MIGRACIÓN
-- =====================================================

-- Verificar que el constraint se actualizó correctamente
SELECT 
  conname as constraint_name,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conname = 'shift_sessions_status_check';

-- Verificar índices
SELECT 
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'shift_sessions'
AND indexname = 'idx_shift_sessions_pending_by_employee';

-- Mostrar resumen de estados actuales
SELECT 
  status,
  COUNT(*) as count,
  COUNT(*) FILTER (WHERE clock_out_at IS NOT NULL) as with_clock_out
FROM shift_sessions
GROUP BY status
ORDER BY status;

-- =====================================================
-- NOTAS IMPORTANTES
-- =====================================================
-- 1. Esta migración es NO DESTRUCTIVA (solo agrega, no elimina)
-- 2. Los datos existentes NO se modifican automáticamente
-- 3. Las sesiones 'closed' existentes permanecen así
-- 4. El nuevo flujo se aplicará solo a futuros clock-outs
-- 5. Compatible con versión anterior del código

-- =====================================================
-- ROLLBACK (Si es necesario)
-- =====================================================
/*
-- Para revertir cambios:
ALTER TABLE shift_sessions 
DROP CONSTRAINT shift_sessions_status_check;

ALTER TABLE shift_sessions 
ADD CONSTRAINT shift_sessions_status_check 
CHECK (status IN ('active', 'closed', 'cancelled'));

DROP INDEX IF EXISTS idx_shift_sessions_pending_by_employee;
DROP FUNCTION IF EXISTS get_pending_closings_count(UUID);
*/
