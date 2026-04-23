-- ==============================================================================
-- MIGRATION: Fix Cochero Performance Entry Time Calculation
-- Description:
-- Updates get_cochero_performance_kpis to fix the calculation of avg_checkin_time_minutes
-- which was incorrectly using vehicle_requested_at (a checkout field) causing
-- negative time values.
-- ==============================================================================

DROP FUNCTION IF EXISTS get_cochero_performance_kpis(DATE, DATE);
CREATE OR REPLACE FUNCTION get_cochero_performance_kpis(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_checkins INTEGER,
  avg_checkin_time_minutes DECIMAL,
  total_checkouts INTEGER,
  avg_checkout_time_minutes DECIMAL,
  total_services INTEGER,
  is_active BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id AS employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    COUNT(rs.id) FILTER (WHERE rs.check_in_at IS NOT NULL)::INTEGER AS total_checkins,
    -- Entry time: from creation (when valet receives car) to check-in
    ROUND(AVG(EXTRACT(EPOCH FROM (rs.check_in_at - rs.created_at))/60)::numeric, 2) AS avg_checkin_time_minutes,
    COUNT(rs.id) FILTER (WHERE rs.actual_check_out_at IS NOT NULL AND rs.checkout_valet_employee_id = e.id)::INTEGER AS total_checkouts,
    -- Exit time: from actual checkout back to when it was requested (either valet proposal or reception request)
    ROUND(AVG(EXTRACT(EPOCH FROM (rs.actual_check_out_at - COALESCE(rs.valet_checkout_requested_at, rs.vehicle_requested_at)))/60)::numeric, 2) AS avg_checkout_time_minutes,
    -- Simulating services count from employee movements (extra persons, extra hours, etc.)
    (SELECT COUNT(*)::INTEGER FROM employee_movements em WHERE em.employee_id = e.id AND em.movement_type IN ('extra_hour', 'extra_person') AND DATE(em.created_at) BETWEEN p_start_date AND p_end_date) AS total_services,
    (e.deleted_at IS NULL) AS is_active
  FROM employees e
  LEFT JOIN roles r ON r.id = e.role_id
  LEFT JOIN room_stays rs ON (rs.valet_employee_id = e.id OR rs.checkout_valet_employee_id = e.id)
                         AND DATE(rs.created_at) BETWEEN p_start_date AND p_end_date
  WHERE LOWER(e.role) IN ('valet', 'cochero') OR LOWER(r.name) IN ('valet', 'cochero')
  GROUP BY e.id, e.first_name, e.last_name, e.deleted_at;
END;
$$;
