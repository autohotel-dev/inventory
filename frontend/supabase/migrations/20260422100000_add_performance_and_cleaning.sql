-- ==============================================================================
-- MIGRATION: Employee Performance & Response Times Module
-- Description:
-- 1. Adds 'LIMPIANDO' to room status allowed values.
-- 2. Adds cleaning_started_at and cleaning_by_employee_id to rooms table.
-- 3. Creates RPC functions to calculate KPIs for Cocheros, Reception, Camaristas.
-- 4. Creates RPC function to get active SLA violations.
-- ==============================================================================

-- 1. Alter rooms table to add new fields
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS cleaning_started_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS cleaning_by_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL;

-- If there's a constraint on status, we'll need to drop and recreate it, or just rely on the frontend if no constraint exists.
-- Supabase typical enum behavior:
DO $$ 
BEGIN
  -- We assume status is a TEXT field based on previous migrations, but we update constraints if they exist
  ALTER TABLE public.rooms DROP CONSTRAINT IF EXISTS rooms_status_check;
  ALTER TABLE public.rooms ADD CONSTRAINT rooms_status_check CHECK (status IN ('LIBRE', 'OCUPADA', 'SUCIA', 'BLOQUEADA', 'LIMPIANDO', 'MANTENIMIENTO'));
EXCEPTION
  WHEN undefined_object THEN
    NULL;
END $$;

-- 2. Trigger to automatically set cleaning_started_at
CREATE OR REPLACE FUNCTION set_room_cleaning_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'LIMPIANDO' AND OLD.status != 'LIMPIANDO' THEN
    NEW.cleaning_started_at = NOW();
    -- Fetch the employee ID associated with the current auth user
    NEW.cleaning_by_employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1);
  END IF;
  
  IF NEW.status = 'LIBRE' AND OLD.status = 'LIMPIANDO' THEN
    -- Optionally log the cleaning duration here, but our RPC already calculates it using created_at/audit logs
    -- We leave cleaning_started_at intact so we can see the last time it was cleaned, or we can null it out.
    -- We'll leave it to keep historical trace.
    NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_room_cleaning_timestamps ON public.rooms;
CREATE TRIGGER trigger_room_cleaning_timestamps
  BEFORE UPDATE OF status ON public.rooms
  FOR EACH ROW
  EXECUTE FUNCTION set_room_cleaning_timestamps();

-- 3. Performance RPC for Cocheros
CREATE OR REPLACE FUNCTION get_cochero_performance_kpis(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_checkins INTEGER,
  avg_checkin_time_minutes DECIMAL,
  total_checkouts INTEGER,
  avg_checkout_time_minutes DECIMAL,
  total_services INTEGER
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id AS employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    COUNT(rs.id) FILTER (WHERE rs.check_in_at IS NOT NULL) AS total_checkins,
    -- Entry time: from vehicle requested (or creation) to check-in
    ROUND(AVG(EXTRACT(EPOCH FROM (rs.check_in_at - COALESCE(rs.vehicle_requested_at, rs.created_at)))/60)::numeric, 2) AS avg_checkin_time_minutes,
    COUNT(rs.id) FILTER (WHERE rs.actual_check_out_at IS NOT NULL AND rs.checkout_valet_employee_id = e.id) AS total_checkouts,
    -- Exit time: from valet requested to actual checkout
    ROUND(AVG(EXTRACT(EPOCH FROM (rs.actual_check_out_at - rs.valet_checkout_requested_at))/60)::numeric, 2) AS avg_checkout_time_minutes,
    -- Simulating services count from employee movements (extra persons, extra hours, etc.)
    (SELECT COUNT(*)::INTEGER FROM employee_movements em WHERE em.employee_id = e.id AND em.movement_type IN ('extra_hour', 'extra_person') AND DATE(em.created_at) BETWEEN p_start_date AND p_end_date) AS total_services
  FROM employees e
  LEFT JOIN room_stays rs ON rs.valet_employee_id = e.id OR rs.checkout_valet_employee_id = e.id
  WHERE e.role IN ('valet', 'Valet', 'cochero') 
    AND (rs.created_at IS NULL OR DATE(rs.created_at) BETWEEN p_start_date AND p_end_date)
  GROUP BY e.id, e.first_name, e.last_name;
END;
$$;

-- 3. Performance RPC for Recepcionistas
CREATE OR REPLACE FUNCTION get_receptionist_performance_kpis(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_entries_processed INTEGER,
  total_exits_processed INTEGER,
  total_extras_charged INTEGER,
  total_revenue DECIMAL,
  anomalies_detected INTEGER
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
    (SELECT COUNT(*)::INTEGER FROM detect_payment_anomalies() WHERE severity = 'ERROR') AS anomalies_detected
  FROM employees e
  WHERE e.role IN ('receptionist', 'recepcionista')
  GROUP BY e.id, e.first_name, e.last_name;
END;
$$;

-- 4. Performance RPC for Camaristas
-- Since we are adding cleaning_started_at, historical data might not have it.
-- This function calculates based on cleaning_started_at and current updated_at for completed cleanings
CREATE OR REPLACE FUNCTION get_camarista_performance_kpis(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_rooms_cleaned INTEGER,
  avg_cleaning_time_minutes DECIMAL,
  currently_cleaning INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id AS employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    -- Find how many rooms they cleaned (we can use audit logs where action='UPDATE', description='Estado de habitación cambiado a LIBRE')
    (SELECT COUNT(*)::INTEGER FROM audit_logs al WHERE al.employee_id = e.id AND al.entity_type = 'rooms' AND al.description LIKE '%LIBRE%' AND DATE(al.created_at) BETWEEN p_start_date AND p_end_date) AS total_rooms_cleaned,
    -- We can approximate average time based on audit logs, but moving forward we use real fields
    -- For now we return a safe estimate based on recent data or 0 if none
    COALESCE(
      (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (al2.created_at - (SELECT al1.created_at FROM audit_logs al1 WHERE al1.entity_id = al2.entity_id AND al1.description LIKE '%LIMPIANDO%' AND al1.created_at < al2.created_at ORDER BY al1.created_at DESC LIMIT 1)))/60)::numeric, 2)
       FROM audit_logs al2 
       WHERE al2.employee_id = e.id AND al2.entity_type = 'rooms' AND al2.description LIKE '%LIBRE%' AND DATE(al2.created_at) BETWEEN p_start_date AND p_end_date), 
    0) AS avg_cleaning_time_minutes,
    (SELECT COUNT(*)::INTEGER FROM rooms r WHERE r.status = 'LIMPIANDO' AND r.cleaning_by_employee_id = e.id) AS currently_cleaning
  FROM employees e
  WHERE e.role IN ('camarista', 'recamarista', 'Camarista', 'Recamarista')
  GROUP BY e.id, e.first_name, e.last_name;
END;
$$;

-- 5. RPC for Real-Time SLA Violations
CREATE OR REPLACE FUNCTION get_active_sla_violations()
RETURNS TABLE (
  entity_id UUID,
  entity_type TEXT,
  description TEXT,
  employee_name TEXT,
  minutes_elapsed INTEGER,
  severity TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  -- 1. Cocheros Check-In SLA: More than 10 mins from vehicle requested
  SELECT 
    rs.id AS entity_id,
    'CHECK_IN'::TEXT AS entity_type,
    'Demora en dar entrada a vehículo'::TEXT AS description,
    COALESCE(e.first_name || ' ' || e.last_name, 'Sin asignar') AS employee_name,
    EXTRACT(EPOCH FROM (NOW() - COALESCE(rs.vehicle_requested_at, rs.created_at)))/60::INTEGER AS minutes_elapsed,
    CASE 
      WHEN EXTRACT(EPOCH FROM (NOW() - COALESCE(rs.vehicle_requested_at, rs.created_at)))/60 > 20 THEN 'CRITICAL'::TEXT
      ELSE 'WARNING'::TEXT 
    END AS severity
  FROM room_stays rs
  LEFT JOIN employees e ON e.id = rs.valet_employee_id
  WHERE rs.status = 'PENDING_CHECK_IN' OR (rs.status = 'ACTIVA' AND rs.check_in_at IS NULL AND rs.created_at < NOW() - INTERVAL '10 minutes')
  
  UNION ALL
  
  -- 2. Cocheros Check-Out SLA: More than 15 mins since checkout requested
  SELECT 
    rs.id AS entity_id,
    'CHECK_OUT'::TEXT AS entity_type,
    'Demora en entrega de vehículo'::TEXT AS description,
    COALESCE(e.first_name || ' ' || e.last_name, 'Sin asignar') AS employee_name,
    EXTRACT(EPOCH FROM (NOW() - rs.valet_checkout_requested_at))/60::INTEGER AS minutes_elapsed,
    CASE 
      WHEN EXTRACT(EPOCH FROM (NOW() - rs.valet_checkout_requested_at))/60 > 25 THEN 'CRITICAL'::TEXT
      ELSE 'WARNING'::TEXT 
    END AS severity
  FROM room_stays rs
  LEFT JOIN employees e ON e.id = rs.checkout_valet_employee_id
  WHERE rs.valet_checkout_requested_at IS NOT NULL AND rs.actual_check_out_at IS NULL AND rs.valet_checkout_requested_at < NOW() - INTERVAL '15 minutes'
  
  UNION ALL
  
  -- 3. Camaristas Cleaning SLA: More than 45 mins since cleaning started
  SELECT 
    r.id AS entity_id,
    'CLEANING'::TEXT AS entity_type,
    'Habitación ' || r.number || ' demora en limpieza'::TEXT AS description,
    COALESCE(e.first_name || ' ' || e.last_name, 'Camarista sin asignar') AS employee_name,
    EXTRACT(EPOCH FROM (NOW() - r.cleaning_started_at))/60::INTEGER AS minutes_elapsed,
    CASE 
      WHEN EXTRACT(EPOCH FROM (NOW() - r.cleaning_started_at))/60 > 60 THEN 'CRITICAL'::TEXT
      ELSE 'WARNING'::TEXT 
    END AS severity
  FROM rooms r
  LEFT JOIN employees e ON e.id = r.cleaning_by_employee_id
  WHERE r.status = 'LIMPIANDO' AND r.cleaning_started_at < NOW() - INTERVAL '45 minutes';
  
END;
$$;
