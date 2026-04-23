-- ==============================================================================
-- MIGRATION: Granular Camarista Tracking (room_cleanings)
-- Description:
-- 1. Creates `room_cleanings` table to perfectly track cleaning times.
-- 2. Updates `trigger_room_cleaning_timestamps` to populate it automatically.
-- 3. Performs retroactive data backfill from audit_logs.
-- 4. Rewrites get_camarista_performance_kpis to use the new source of truth.
-- ==============================================================================

-- 1. Create Granular Tracking Table
CREATE TABLE IF NOT EXISTS public.room_cleanings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_cleanings_room ON public.room_cleanings(room_id);
CREATE INDEX IF NOT EXISTS idx_room_cleanings_employee ON public.room_cleanings(employee_id);
CREATE INDEX IF NOT EXISTS idx_room_cleanings_dates ON public.room_cleanings(started_at, ended_at);

-- 2. Update the Trigger to Manage Cleanings
CREATE OR REPLACE FUNCTION set_room_cleaning_timestamps()
RETURNS TRIGGER AS $$
DECLARE
  v_employee_id UUID;
BEGIN
  IF NEW.status = 'LIMPIANDO' AND OLD.status != 'LIMPIANDO' THEN
    NEW.cleaning_started_at = NOW();
    -- Fetch the employee ID associated with the current auth user
    SELECT id INTO v_employee_id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
    NEW.cleaning_by_employee_id = v_employee_id;
    
    -- Open a new cleaning session
    INSERT INTO public.room_cleanings (room_id, employee_id, started_at)
    VALUES (NEW.id, v_employee_id, NOW());
  END IF;
  
  IF NEW.status = 'LIBRE' AND OLD.status = 'LIMPIANDO' THEN
    -- Close the active cleaning session
    UPDATE public.room_cleanings
    SET ended_at = NOW(),
        duration_minutes = EXTRACT(EPOCH FROM (NOW() - started_at))/60::INTEGER
    WHERE id = (
      SELECT id FROM public.room_cleanings 
      WHERE room_id = NEW.id AND ended_at IS NULL 
      ORDER BY started_at DESC LIMIT 1
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (The trigger is already bound to public.rooms, so replacing the function is enough)

-- 3. Retroactive Data Backfill (Parse old audit_logs into room_cleanings)
DO $$
DECLARE
  v_libre RECORD;
  v_limpia RECORD;
  v_duration INTEGER;
BEGIN
  -- Loop over all "LIBRE" logs
  FOR v_libre IN (
    SELECT entity_id, employee_id, created_at 
    FROM audit_logs 
    WHERE entity_type = 'rooms' AND description LIKE '%LIBRE%'
  ) LOOP
    -- Find the closest preceding "LIMPIANDO" log for this room
    SELECT created_at INTO v_limpia
    FROM audit_logs
    WHERE entity_id = v_libre.entity_id 
      AND description LIKE '%LIMPIANDO%' 
      AND created_at < v_libre.created_at
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- If we found a start and end, insert the history record
    IF v_limpia.created_at IS NOT NULL THEN
      v_duration := EXTRACT(EPOCH FROM (v_libre.created_at - v_limpia.created_at))/60::INTEGER;
      
      INSERT INTO room_cleanings (room_id, employee_id, started_at, ended_at, duration_minutes)
      VALUES (v_libre.entity_id, v_libre.employee_id, v_limpia.created_at, v_libre.created_at, v_duration);
    END IF;
  END LOOP;
END $$;

-- 4. Rewrite get_camarista_performance_kpis to use the new source of truth
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
    
    -- Total limpiadas (Sesiones cerradas en room_cleanings)
    (SELECT COUNT(rc.id)::INTEGER 
     FROM room_cleanings rc 
     WHERE rc.employee_id = e.id 
       AND rc.ended_at IS NOT NULL 
       AND DATE(rc.ended_at) BETWEEN p_start_date AND p_end_date) AS total_rooms_cleaned,
       
    -- Promedio de tiempo (Filtramos limpiezas > 180 min (3 horas) para evitar que olvidos humanos desvirtúen el promedio)
    COALESCE(
      (SELECT ROUND(AVG(rc.duration_minutes)::numeric, 2)
       FROM room_cleanings rc 
       WHERE rc.employee_id = e.id 
         AND rc.ended_at IS NOT NULL 
         AND rc.duration_minutes > 0 
         AND rc.duration_minutes <= 180 
         AND DATE(rc.ended_at) BETWEEN p_start_date AND p_end_date), 
    0) AS avg_cleaning_time_minutes,
    
    -- Cuántas está limpiando en este exacto momento
    (SELECT COUNT(r.id)::INTEGER 
     FROM rooms r 
     WHERE r.status = 'LIMPIANDO' 
       AND r.cleaning_by_employee_id = e.id) AS currently_cleaning,
       
    (e.deleted_at IS NULL) AS is_active
  FROM employees e
  LEFT JOIN roles r ON r.id = e.role_id
  WHERE LOWER(e.role) IN ('camarista', 'recamarista') OR LOWER(r.name) IN ('camarista', 'recamarista')
  GROUP BY e.id, e.first_name, e.last_name, e.deleted_at;
END;
$$;
