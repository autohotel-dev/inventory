-- Migration: Add receptionist check-in movement for existing room_stay
-- This will add the missing receptionist participation

-- Insert movement for receptionist for the existing check-in
INSERT INTO employee_movements (
  employee_id,
  shift_session_id,
  movement_type,
  entity_type,
  entity_id,
  metadata,
  created_at,
  updated_at
)
SELECT 
  e.id,
  rs.shift_session_id,
  'check_in',
  'room_stay',
  rs.id,
  jsonb_build_object(
    'room_number', (SELECT number FROM rooms WHERE id = rs.room_id),
    'check_in_time', rs.check_in_at,
    'status', rs.status,
    'role', 'receptionist',
    'added_manually', true
  ),
  rs.check_in_at,
  NOW()
FROM room_stays rs
CROSS JOIN employees e
WHERE rs.id = '63553aae-be94-4d6a-9195-929b9772e506'  -- El room_stay existente
  AND e.role = 'receptionist'
  AND e.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM employee_movements em 
    WHERE em.entity_id = rs.id 
      AND em.entity_type = 'room_stay'
      AND em.movement_type = 'check_in'
      AND em.employee_id = e.id
  );

-- Add comment
COMMENT ON TABLE employee_movements IS 'Enhanced with dual participation tracking (valet + receptionist)';
