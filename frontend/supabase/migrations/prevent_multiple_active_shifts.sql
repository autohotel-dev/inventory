-- =====================================================
-- MIGRACIÓN: Prevenir Múltiples Turnos Activos
-- =====================================================
-- Esta migración agrega un constraint a nivel de base de datos
-- para garantizar que solo pueda existir UN turno con status 'active'
-- a la vez en todo el sistema.
-- 
-- Esto previene conflictos en los cortes de caja y asegura que
-- solo una persona esté trabajando a la vez.

-- =====================================================
-- PASO 1: LIMPIAR TURNOS ACTIVOS DUPLICADOS
-- =====================================================
-- Antes de crear el constraint, necesitamos cerrar los turnos
-- activos duplicados que ya existen en la base de datos.
-- Mantendremos solo el turno más reciente como 'active'.

-- Cerrar todos los turnos activos EXCEPTO el más reciente
UPDATE shift_sessions
SET 
  status = 'pending_closing',
  clock_out_at = CASE 
    WHEN clock_out_at IS NULL THEN NOW() 
    ELSE clock_out_at 
  END
WHERE status = 'active'
  AND id NOT IN (
    -- Mantener solo el turno más reciente
    SELECT id 
    FROM shift_sessions 
    WHERE status = 'active' 
    ORDER BY clock_in_at DESC 
    LIMIT 1
  );

-- Mostrar cuántos turnos fueron cerrados
DO $$
DECLARE
  closed_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO closed_count
  FROM shift_sessions
  WHERE status = 'pending_closing' 
    AND clock_out_at >= NOW() - INTERVAL '1 minute';
  
  IF closed_count > 0 THEN
    RAISE NOTICE '✓ Se cerraron % turnos activos duplicados', closed_count;
  ELSE
    RAISE NOTICE '✓ No había turnos duplicados que cerrar';
  END IF;
END $$;

-- =====================================================
-- PASO 2: CREAR UNIQUE PARTIAL INDEX
-- =====================================================
-- Ahora que solo hay 1 turno activo (o ninguno), podemos crear el índice

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_shift_session
ON shift_sessions (status)
WHERE status = 'active';

COMMENT ON INDEX idx_single_active_shift_session IS 
  'Garantiza que solo pueda existir un único turno con status=active en todo momento. Esto previene que múltiples recepcionistas inicien turno simultáneamente.';

-- =====================================================
-- NOTAS DE IMPLEMENTACIÓN
-- =====================================================
-- 1. Este constraint permite múltiples turnos con status 'pending_closing', 
--    'closed' o 'cancelled' sin problema.
-- 
-- 2. Si intentas insertar un segundo turno con status='active', 
--    obtendrás el error:
--    "duplicate key value violates unique constraint"
--
-- 3. Para iniciar un nuevo turno, primero debes cerrar el activo:
--    UPDATE shift_sessions SET status='pending_closing' WHERE status='active';
--
-- 4. Este constraint funciona en conjunto con la validación del frontend
--    para una mejor experiencia de usuario.

-- =====================================================
-- VERIFICACIÓN
-- =====================================================
-- Verificar que solo quede 1 turno activo (o ninguno)
DO $$
DECLARE
  active_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO active_count
  FROM shift_sessions
  WHERE status = 'active';
  
  RAISE NOTICE '✓ Turnos activos actuales: %', active_count;
  
  IF active_count > 1 THEN
    RAISE EXCEPTION 'ERROR: Todavía hay % turnos activos. La migración falló.', active_count;
  END IF;
END $$;
