-- ==============================================================================
-- MIGRATION: Add is_active flag to performance RPCs
-- Description:
-- Updates the performance KPIs RPCs to include whether the employee is active
-- so the frontend can filter them.
-- ==============================================================================

-- 1. Performance RPC for Cocheros
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
    -- Entry time: from vehicle requested (or creation) to check-in
    ROUND(AVG(EXTRACT(EPOCH FROM (rs.check_in_at - COALESCE(rs.vehicle_requested_at, rs.created_at)))/60)::numeric, 2) AS avg_checkin_time_minutes,
    COUNT(rs.id) FILTER (WHERE rs.actual_check_out_at IS NOT NULL AND rs.checkout_valet_employee_id = e.id)::INTEGER AS total_checkouts,
    -- Exit time: from valet requested to actual checkout
    ROUND(AVG(EXTRACT(EPOCH FROM (rs.actual_check_out_at - rs.valet_checkout_requested_at))/60)::numeric, 2) AS avg_checkout_time_minutes,
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

-- 2. Performance RPC for Recepcionistas
DROP FUNCTION IF EXISTS get_receptionist_performance_kpis(DATE, DATE);
CREATE OR REPLACE FUNCTION get_receptionist_performance_kpis(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_entries_processed INTEGER,
  total_exits_processed INTEGER,
  total_extras_charged INTEGER,
  total_revenue DECIMAL,
  anomalies_detected INTEGER,
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
    (SELECT COUNT(*)::INTEGER FROM employee_movements em WHERE em.employee_id = e.id AND em.movement_type = 'check_in' AND DATE(em.created_at) BETWEEN p_start_date AND p_end_date) AS total_entries_processed,
    (SELECT COUNT(*)::INTEGER FROM employee_movements em WHERE em.employee_id = e.id AND em.movement_type = 'check_out' AND DATE(em.created_at) BETWEEN p_start_date AND p_end_date) AS total_exits_processed,
    (SELECT COUNT(*)::INTEGER FROM employee_movements em WHERE em.employee_id = e.id AND em.movement_type IN ('extra_hour', 'extra_person', 'renewal') AND DATE(em.created_at) BETWEEN p_start_date AND p_end_date) AS total_extras_charged,
    (SELECT COALESCE(SUM(amount), 0)::DECIMAL FROM employee_movements em WHERE em.employee_id = e.id AND em.movement_type = 'payment' AND DATE(em.created_at) BETWEEN p_start_date AND p_end_date) AS total_revenue,
    (SELECT COUNT(*)::INTEGER FROM detect_payment_anomalies() WHERE severity = 'ERROR') AS anomalies_detected,
    (e.deleted_at IS NULL) AS is_active
  FROM employees e
  LEFT JOIN roles r ON r.id = e.role_id
  WHERE LOWER(e.role) IN ('receptionist', 'recepcionista') OR LOWER(r.name) IN ('receptionist', 'recepcionista')
  GROUP BY e.id, e.first_name, e.last_name, e.deleted_at;
END;
$$;

-- 3. Performance RPC for Camaristas
DROP FUNCTION IF EXISTS get_camarista_performance_kpis(DATE, DATE);
CREATE OR REPLACE FUNCTION get_camarista_performance_kpis(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_rooms_cleaned INTEGER,
  avg_cleaning_time_minutes DECIMAL,
  currently_cleaning INTEGER,
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
    (SELECT COUNT(*)::INTEGER FROM audit_logs al WHERE al.employee_id = e.id AND al.entity_type = 'rooms' AND al.description LIKE '%LIBRE%' AND DATE(al.created_at) BETWEEN p_start_date AND p_end_date) AS total_rooms_cleaned,
    COALESCE(
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (al2.created_at - (SELECT al1.created_at FROM audit_logs al1 WHERE al1.entity_id = al2.entity_id AND al1.description LIKE '%LIMPIANDO%' AND al1.created_at < al2.created_at ORDER BY al1.created_at DESC LIMIT 1)))/60)::numeric, 2)
       FROM audit_logs al2 
       WHERE al2.employee_id = e.id AND al2.entity_type = 'rooms' AND al2.description LIKE '%LIBRE%' AND DATE(al2.created_at) BETWEEN p_start_date AND p_end_date), 
    0) AS avg_cleaning_time_minutes,
    (SELECT COUNT(*)::INTEGER FROM rooms r WHERE r.status = 'LIMPIANDO' AND r.cleaning_by_employee_id = e.id) AS currently_cleaning,
    (e.deleted_at IS NULL) AS is_active
  FROM employees e
  LEFT JOIN roles r ON r.id = e.role_id
  WHERE LOWER(e.role) IN ('camarista', 'recamarista') OR LOWER(r.name) IN ('camarista', 'recamarista')
  GROUP BY e.id, e.first_name, e.last_name, e.deleted_at;
END;
$$;
