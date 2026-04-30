-- =====================================================
-- Migration: TV Audit Enrichment
-- Purpose: Enrich room_asset_logs for forensic-grade audit trail
-- =====================================================

-- 1. Add new columns to room_asset_logs for granular traceability
ALTER TABLE public.room_asset_logs
  ADD COLUMN IF NOT EXISTS assigned_to_employee_id UUID REFERENCES public.employees(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES public.rooms(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS room_number TEXT;

-- Backfill room_id for existing logs
UPDATE public.room_asset_logs l
SET room_id = ra.room_id
FROM public.room_assets ra
WHERE l.asset_id = ra.id AND l.room_id IS NULL;

-- Backfill room_number for existing logs
UPDATE public.room_asset_logs l
SET room_number = r.number
FROM public.rooms r
WHERE l.room_id = r.id AND l.room_number IS NULL;

-- 2. Update assign_asset_to_employee to record enriched audit fields
CREATE OR REPLACE FUNCTION public.assign_asset_to_employee(
    p_room_id UUID,
    p_asset_type TEXT,
    p_employee_id UUID,
    p_action_by_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset_id UUID;
    v_current_status TEXT;
    v_room_number TEXT;
BEGIN
    -- Get room number for audit
    SELECT number INTO v_room_number FROM public.rooms WHERE id = p_room_id;

    -- Get or create asset
    SELECT id, status INTO v_asset_id, v_current_status
    FROM public.room_assets
    WHERE room_id = p_room_id AND asset_type = p_asset_type;

    IF v_asset_id IS NULL THEN
        INSERT INTO public.room_assets (room_id, asset_type, status, assigned_employee_id)
        VALUES (p_room_id, p_asset_type, 'PENDIENTE_ENCENDIDO', p_employee_id)
        RETURNING id INTO v_asset_id;
        v_current_status := 'NO_EXISTIA';
    ELSE
        UPDATE public.room_assets
        SET status = 'PENDIENTE_ENCENDIDO',
            assigned_employee_id = p_employee_id
        WHERE id = v_asset_id;
    END IF;

    -- Enriched audit log
    INSERT INTO public.room_asset_logs (
        asset_id, previous_status, new_status, employee_id, action_type,
        assigned_to_employee_id, room_id, room_number
    ) VALUES (
        v_asset_id, v_current_status, 'PENDIENTE_ENCENDIDO', p_action_by_employee_id, 'ASSIGNED_TO_COCHERO_FOR_TV',
        p_employee_id, p_room_id, v_room_number
    );

    RETURN jsonb_build_object('success', true, 'message', 'Cochero asignado exitosamente para encender TV');
END;
$$;

-- 3. Update confirm_tv_on to record enriched audit fields
CREATE OR REPLACE FUNCTION public.confirm_tv_on(
    p_room_id UUID,
    p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_asset_id UUID;
    v_current_status TEXT;
    v_room_number TEXT;
BEGIN
    SELECT number INTO v_room_number FROM public.rooms WHERE id = p_room_id;

    SELECT id, status INTO v_asset_id, v_current_status
    FROM public.room_assets
    WHERE room_id = p_room_id AND asset_type = 'TV_REMOTE';

    IF v_asset_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Activo no encontrado para esta habitación');
    END IF;

    UPDATE public.room_assets
    SET status = 'TV_ENCENDIDA',
        assigned_employee_id = NULL
    WHERE id = v_asset_id;

    INSERT INTO public.room_asset_logs (
        asset_id, previous_status, new_status, employee_id, action_type,
        room_id, room_number
    ) VALUES (
        v_asset_id, v_current_status, 'TV_ENCENDIDA', p_employee_id, 'CONFIRMED_TV_ON',
        p_room_id, v_room_number
    );

    RETURN jsonb_build_object('success', true, 'message', 'Televisión confirmada como encendida');
END;
$$;

-- 4. Create RPC for querying the full audit trail with employee names
CREATE OR REPLACE FUNCTION public.get_tv_audit_trail(
    p_room_number TEXT DEFAULT NULL,
    p_employee_id UUID DEFAULT NULL,
    p_action_type TEXT DEFAULT NULL,
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL,
    p_limit INT DEFAULT 100,
    p_offset INT DEFAULT 0
)
RETURNS TABLE (
    log_id UUID,
    created_at TIMESTAMPTZ,
    room_number TEXT,
    room_id UUID,
    action_type TEXT,
    previous_status TEXT,
    new_status TEXT,
    action_by_name TEXT,
    action_by_id UUID,
    assigned_to_name TEXT,
    assigned_to_id UUID,
    notes TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT
        l.id AS log_id,
        l.created_at,
        COALESCE(l.room_number, r.number, '?') AS room_number,
        COALESCE(l.room_id, ra.room_id) AS room_id,
        l.action_type,
        l.previous_status,
        l.new_status,
        COALESCE(e_action.first_name || ' ' || e_action.last_name, '—') AS action_by_name,
        l.employee_id AS action_by_id,
        COALESCE(e_assigned.first_name || ' ' || e_assigned.last_name, '—') AS assigned_to_name,
        l.assigned_to_employee_id AS assigned_to_id,
        l.notes
    FROM public.room_asset_logs l
    JOIN public.room_assets ra ON l.asset_id = ra.id
    LEFT JOIN public.rooms r ON ra.room_id = r.id
    LEFT JOIN public.employees e_action ON l.employee_id = e_action.id
    LEFT JOIN public.employees e_assigned ON l.assigned_to_employee_id = e_assigned.id
    WHERE ra.asset_type = 'TV_REMOTE'
      AND (p_room_number IS NULL OR COALESCE(l.room_number, r.number) = p_room_number)
      AND (p_employee_id IS NULL OR l.employee_id = p_employee_id OR l.assigned_to_employee_id = p_employee_id)
      AND (p_action_type IS NULL OR l.action_type = p_action_type)
      AND (p_date_from IS NULL OR l.created_at >= p_date_from)
      AND (p_date_to IS NULL OR l.created_at <= p_date_to)
    ORDER BY l.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- 5. Create RPC for audit stats per cochero (response time, counts)
CREATE OR REPLACE FUNCTION public.get_tv_audit_stats(
    p_date_from TIMESTAMPTZ DEFAULT NULL,
    p_date_to TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    employee_id UUID,
    employee_name TEXT,
    total_assignments INT,
    total_confirmations INT,
    avg_response_minutes NUMERIC,
    fastest_response_minutes NUMERIC,
    slowest_response_minutes NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH assignments AS (
        SELECT
            l.assigned_to_employee_id AS eid,
            l.asset_id,
            l.created_at AS assigned_at
        FROM public.room_asset_logs l
        JOIN public.room_assets ra ON l.asset_id = ra.id
        WHERE ra.asset_type = 'TV_REMOTE'
          AND l.action_type = 'ASSIGNED_TO_COCHERO_FOR_TV'
          AND (p_date_from IS NULL OR l.created_at >= p_date_from)
          AND (p_date_to IS NULL OR l.created_at <= p_date_to)
    ),
    confirmations AS (
        SELECT
            l.employee_id AS eid,
            l.asset_id,
            l.created_at AS confirmed_at
        FROM public.room_asset_logs l
        JOIN public.room_assets ra ON l.asset_id = ra.id
        WHERE ra.asset_type = 'TV_REMOTE'
          AND l.action_type = 'CONFIRMED_TV_ON'
          AND (p_date_from IS NULL OR l.created_at >= p_date_from)
          AND (p_date_to IS NULL OR l.created_at <= p_date_to)
    ),
    matched AS (
        SELECT
            a.eid,
            a.asset_id,
            a.assigned_at,
            c.confirmed_at,
            EXTRACT(EPOCH FROM (c.confirmed_at - a.assigned_at)) / 60.0 AS response_minutes
        FROM assignments a
        LEFT JOIN LATERAL (
            SELECT c2.confirmed_at
            FROM confirmations c2
            WHERE c2.asset_id = a.asset_id
              AND c2.confirmed_at > a.assigned_at
            ORDER BY c2.confirmed_at ASC
            LIMIT 1
        ) c ON true
    ),
    employee_stats AS (
        SELECT
            m.eid,
            COUNT(*)::INT AS total_assignments,
            COUNT(m.confirmed_at)::INT AS total_confirmations,
            ROUND(AVG(m.response_minutes)::NUMERIC, 1) AS avg_response_minutes,
            ROUND(MIN(m.response_minutes)::NUMERIC, 1) AS fastest_response_minutes,
            ROUND(MAX(m.response_minutes)::NUMERIC, 1) AS slowest_response_minutes
        FROM matched m
        WHERE m.eid IS NOT NULL
        GROUP BY m.eid
    )
    SELECT
        es.eid AS employee_id,
        COALESCE(e.first_name || ' ' || e.last_name, '—') AS employee_name,
        es.total_assignments,
        es.total_confirmations,
        es.avg_response_minutes,
        es.fastest_response_minutes,
        es.slowest_response_minutes
    FROM employee_stats es
    LEFT JOIN public.employees e ON es.eid = e.id
    ORDER BY es.total_assignments DESC;
END;
$$;
