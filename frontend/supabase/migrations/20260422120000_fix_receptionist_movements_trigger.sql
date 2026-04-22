-- ==============================================================================
-- MIGRATION: Fix Receptionist check_in logging bug & correct historical data
-- Description:
-- 1. Redefines log_room_stay_check_in() to correctly fetch the receptionist's ID
--    from the `shift_sessions` instead of picking the first receptionist it finds.
-- 2. Retroactively fixes historical `employee_movements` so Jocelyn doesn't have 799 entries.
-- ==============================================================================

-- 1. Fix the trigger function to use the employee who actually opened the shift
CREATE OR REPLACE FUNCTION log_room_stay_check_in()
RETURNS TRIGGER AS $$
BEGIN
  -- Registrar movimiento del valet (si existe)
  IF NEW.valet_employee_id IS NOT NULL THEN
    INSERT INTO employee_movements (
      employee_id,
      shift_session_id,
      movement_type,
      entity_type,
      entity_id,
      metadata
    )
    VALUES (
      NEW.valet_employee_id,
      NEW.shift_session_id,
      'check_in',
      'room_stay',
      NEW.id,
      jsonb_build_object(
        'room_number', (SELECT number FROM rooms WHERE id = NEW.room_id),
        'check_in_time', NEW.check_in_at,
        'status', NEW.status,
        'role', 'valet'
      )
    );
  END IF;
  
  -- Registrar movimiento de la recepcionista basado en el turno activo
  IF NEW.shift_session_id IS NOT NULL THEN
    INSERT INTO employee_movements (
      employee_id,
      shift_session_id,
      movement_type,
      entity_type,
      entity_id,
      metadata
    )
    SELECT 
      ss.employee_id,
      NEW.shift_session_id,
      'check_in',
      'room_stay',
      NEW.id,
      jsonb_build_object(
        'room_number', (SELECT number FROM rooms WHERE id = NEW.room_id),
        'check_in_time', NEW.check_in_at,
        'status', NEW.status,
        'role', 'receptionist'
      )
    FROM shift_sessions ss
    WHERE ss.id = NEW.shift_session_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Retroactive data fix for Jocelyn (and any other incorrect assignment)
-- We map every existing 'check_in' and 'check_out' movement to the real
-- employee who owned that shift_session.
UPDATE employee_movements em
SET employee_id = ss.employee_id
FROM shift_sessions ss
WHERE em.shift_session_id = ss.id
  AND em.employee_id != ss.employee_id
  -- We specifically target receptionist movements, 
  -- but actually shift_session_id belongs ONLY to the employee who opened it.
  -- Wait! What if the movement is for a Valet? The valet uses the receptionist's shift_session_id?!
  -- Ah! If `NEW.shift_session_id` is the receptionist's session, 
  -- the valet's movement ALSO has `shift_session_id` = receptionist's session!
  -- So we cannot blindly update all movements based on shift_session_id.
  -- We must ONLY update those where the metadata->>'role' = 'receptionist'.
  AND (em.metadata->>'role') = 'receptionist';
