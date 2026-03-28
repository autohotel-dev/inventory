-- Migration: Populate employee_movements with existing data
-- This will migrate existing room_stays and payments to the new movements table

-- First, let's create a temporary function to safely populate movements
CREATE OR REPLACE FUNCTION populate_existing_movements()
RETURNS TEXT AS $$
DECLARE
  room_stays_count INTEGER;
  payments_count INTEGER;
  total_movements INTEGER;
BEGIN
  RAISE NOTICE 'Starting population of employee_movements table...';
  
  -- Populate existing room_stays as check-in movements
  INSERT INTO employee_movements (
    employee_id,
    shift_session_id,
    movement_type,
    entity_type,
    entity_id,
    metadata,
    created_at
  )
  SELECT 
    COALESCE(rs.valet_employee_id, rs.checkout_valet_employee_id) as employee_id,
    rs.shift_session_id,
    'check_in' as movement_type,
    'room_stay' as entity_type,
    rs.id as entity_id,
    jsonb_build_object(
      'room_number', (SELECT number FROM rooms WHERE id = rs.room_id),
      'check_in_time', rs.check_in_at,
      'status', rs.status,
      'created_by_valet', rs.valet_employee_id IS NOT NULL,
      'checked_out_by_valet', rs.checkout_valet_employee_id IS NOT NULL
    ) as metadata,
    COALESCE(rs.check_in_at, rs.created_at) as created_at
  FROM room_stays rs
  WHERE rs.check_in_at >= CURRENT_DATE - INTERVAL '7 days'  -- Last 7 days
    AND (
      rs.valet_employee_id IS NOT NULL 
      OR rs.checkout_valet_employee_id IS NOT NULL
    )
    AND NOT EXISTS (
      SELECT 1 FROM employee_movements em 
      WHERE em.entity_id = rs.id 
        AND em.entity_type = 'room_stay'
        AND em.movement_type = 'check_in'
    );
  
  GET DIAGNOSTICS room_stays_count = ROW_COUNT;
  RAISE NOTICE 'Populated % room_stays as check-in movements', room_stays_count;
  
  -- Populate existing payments as payment movements
  INSERT INTO employee_movements (
    employee_id,
    shift_session_id,
    movement_type,
    entity_type,
    entity_id,
    amount,
    quantity,
    metadata,
    created_at
  )
  SELECT 
    p.collected_by as employee_id,
    p.shift_session_id,
    'payment' as movement_type,
    'payment' as entity_type,
    p.id as entity_id,
    p.amount,
    1 as quantity,
    jsonb_build_object(
      'payment_method', p.payment_method,
      'status', p.status,
      'created_at', p.created_at,
      'collected_by_valet', p.collected_by IS NOT NULL
    ) as metadata,
    p.created_at
  FROM payments p
  WHERE p.created_at >= CURRENT_DATE - INTERVAL '7 days'  -- Last 7 days
    AND p.status = 'PAGADO'
    AND p.collected_by IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM employee_movements em 
      WHERE em.entity_id = p.id 
        AND em.entity_type = 'payment'
        AND em.movement_type = 'payment'
    );
  
  GET DIAGNOSTICS payments_count = ROW_COUNT;
  RAISE NOTICE 'Populated % payments as payment movements', payments_count;
  
  -- Get total count
  SELECT COUNT(*) INTO total_movements FROM employee_movements 
  WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';
  
  RAISE NOTICE 'Total movements in last 7 days: %', total_movements;
  
  RETURN format('Successfully populated %s movements (%s room_stays, %s payments)', 
                total_movements, room_stays_count, payments_count);
END;
$$ LANGUAGE plpgsql;

-- Execute the population
SELECT populate_existing_movements();

-- Create a view for today's performance summary
CREATE OR REPLACE VIEW today_employee_performance AS
SELECT 
  e.id as employee_id,
  e.first_name,
  e.last_name,
  e.role,
  COUNT(CASE WHEN em.movement_type = 'check_in' THEN 1 END) as check_ins_today,
  COUNT(CASE WHEN em.movement_type = 'check_out' THEN 1 END) as check_outs_today,
  COUNT(CASE WHEN em.movement_type = 'payment' THEN 1 END) as payments_today,
  COALESCE(SUM(CASE WHEN em.movement_type = 'payment' THEN em.amount END), 0) as revenue_today,
  COUNT(CASE WHEN em.movement_type = 'extra_hour' THEN 1 END) as extra_hours_today,
  COUNT(CASE WHEN em.movement_type = 'extra_person' THEN 1 END) as extra_persons_today,
  COUNT(CASE WHEN em.movement_type = 'renewal' THEN 1 END) as renewals_today,
  COUNT(*) as total_movements_today,
  MAX(em.created_at) as last_activity
FROM employees e
LEFT JOIN employee_movements em ON e.id = em.employee_id 
  AND DATE(em.created_at) = CURRENT_DATE
  AND em.status = 'completed'
WHERE e.deleted_at IS NULL
GROUP BY e.id, e.first_name, e.last_name, e.role
ORDER BY revenue_today DESC NULLS LAST, check_ins_today DESC NULLS LAST;

-- Create a function to get real-time employee stats
CREATE OR REPLACE FUNCTION get_employee_real_time_stats(p_employee_id UUID)
RETURNS TABLE(
  check_ins_today INTEGER,
  check_outs_today INTEGER,
  payments_today INTEGER,
  revenue_today DECIMAL(10,2),
  extra_hours_today INTEGER,
  extra_persons_today INTEGER,
  renewals_today INTEGER,
  total_movements_today INTEGER,
  last_activity TIMESTAMP WITH TIME ZONE,
  efficiency_score DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(CASE WHEN em.movement_type = 'check_in' THEN 1 END)::INTEGER as check_ins_today,
    COUNT(CASE WHEN em.movement_type = 'check_out' THEN 1 END)::INTEGER as check_outs_today,
    COUNT(CASE WHEN em.movement_type = 'payment' THEN 1 END)::INTEGER as payments_today,
    COALESCE(SUM(CASE WHEN em.movement_type = 'payment' THEN em.amount END), 0)::DECIMAL(10,2) as revenue_today,
    COUNT(CASE WHEN em.movement_type = 'extra_hour' THEN 1 END)::INTEGER as extra_hours_today,
    COUNT(CASE WHEN em.movement_type = 'extra_person' THEN 1 END)::INTEGER as extra_persons_today,
    COUNT(CASE WHEN em.movement_type = 'renewal' THEN 1 END)::INTEGER as renewals_today,
    COUNT(*)::INTEGER as total_movements_today,
    MAX(em.created_at) as last_activity,
    CASE 
      WHEN COUNT(CASE WHEN em.movement_type = 'check_in' THEN 1 END) > 0 THEN
        ROUND(
          (COUNT(CASE WHEN em.movement_type = 'check_out' THEN 1 END)::DECIMAL / 
           NULLIF(COUNT(CASE WHEN em.movement_type = 'check_in' THEN 1 END), 0)) * 100, 2
        )
      ELSE 0
    END as efficiency_score
  FROM employee_movements em
  WHERE em.employee_id = p_employee_id
    AND DATE(em.created_at) = CURRENT_DATE
    AND em.status = 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment about the migration
COMMENT ON SCHEMA public IS 'Employee movements table populated with existing data';
