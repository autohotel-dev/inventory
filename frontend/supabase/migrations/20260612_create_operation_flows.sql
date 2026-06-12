-- ================================================================
-- Operation Flows & Flow Events
-- Granular event-sourced lifecycle tracking for hotel operations
-- ================================================================

-- 1. operation_flows: One flow per room stay (entry, extras, checkout)
CREATE TABLE IF NOT EXISTS operation_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_number SERIAL,
    room_stay_id UUID NOT NULL REFERENCES room_stays(id) ON DELETE CASCADE,
    sales_order_id UUID REFERENCES sales_orders(id),
    room_id UUID REFERENCES rooms(id),
    room_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVO' CHECK (status IN ('ACTIVO', 'COMPLETADO', 'CANCELADO')),
    current_stage TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    shift_session_id UUID REFERENCES shift_sessions(id),
    created_by UUID REFERENCES employees(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_operation_flows_room_stay ON operation_flows(room_stay_id);
CREATE INDEX IF NOT EXISTS idx_operation_flows_status ON operation_flows(status);
CREATE INDEX IF NOT EXISTS idx_operation_flows_room_number ON operation_flows(room_number);
CREATE INDEX IF NOT EXISTS idx_operation_flows_shift ON operation_flows(shift_session_id);
CREATE INDEX IF NOT EXISTS idx_operation_flows_started ON operation_flows(started_at DESC);

-- 2. flow_events: Individual events within a flow
CREATE TABLE IF NOT EXISTS flow_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id UUID NOT NULL REFERENCES operation_flows(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    event_category TEXT NOT NULL DEFAULT 'SYSTEM',
    description TEXT NOT NULL,
    actor_id UUID REFERENCES employees(id),
    actor_name TEXT,
    actor_role TEXT,
    metadata JSONB DEFAULT '{}',
    sequence_number INT,
    duration_from_previous_ms INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flow_events_flow ON flow_events(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_events_type ON flow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_flow_events_category ON flow_events(event_category);
CREATE INDEX IF NOT EXISTS idx_flow_events_created ON flow_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_flow_events_actor ON flow_events(actor_id);

-- 3. Auto-calculate sequence_number and duration_from_previous_ms
CREATE OR REPLACE FUNCTION trg_flow_event_sequence_fn()
RETURNS TRIGGER AS $$
DECLARE
    prev_event RECORD;
BEGIN
    -- Get the max sequence number for this flow
    SELECT sequence_number, created_at INTO prev_event
    FROM flow_events
    WHERE flow_id = NEW.flow_id
    ORDER BY created_at DESC
    LIMIT 1;

    IF prev_event IS NULL THEN
        NEW.sequence_number := 1;
        NEW.duration_from_previous_ms := 0;
    ELSE
        NEW.sequence_number := prev_event.sequence_number + 1;
        NEW.duration_from_previous_ms := EXTRACT(EPOCH FROM (NEW.created_at - prev_event.created_at)) * 1000;
    END IF;

    -- Update parent flow's current_stage
    UPDATE operation_flows
    SET current_stage = NEW.event_type, updated_at = NOW()
    WHERE id = NEW.flow_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_flow_event_sequence
    BEFORE INSERT ON flow_events
    FOR EACH ROW
    EXECUTE FUNCTION trg_flow_event_sequence_fn();

-- 4. Auto-update updated_at on operation_flows
CREATE OR REPLACE FUNCTION update_operation_flows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_operation_flows_updated_at
    BEFORE UPDATE ON operation_flows
    FOR EACH ROW
    EXECUTE FUNCTION update_operation_flows_updated_at();

-- 5. RLS policies
ALTER TABLE operation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read operation_flows"
    ON operation_flows FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert operation_flows"
    ON operation_flows FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated users can update operation_flows"
    ON operation_flows FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Authenticated users can read flow_events"
    ON flow_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users can insert flow_events"
    ON flow_events FOR INSERT TO authenticated WITH CHECK (true);

-- 6. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE operation_flows;
ALTER PUBLICATION supabase_realtime ADD TABLE flow_events;

-- ================================================================
-- RPC: create_or_get_flow
-- Creates a new flow or returns existing active one for a room_stay
-- ================================================================
CREATE OR REPLACE FUNCTION create_or_get_flow(
    p_room_stay_id UUID,
    p_sales_order_id UUID DEFAULT NULL,
    p_room_id UUID DEFAULT NULL,
    p_room_number TEXT DEFAULT '',
    p_shift_session_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_flow_id UUID;
    v_created_by UUID;
BEGIN
    -- Resolve current employee
    SELECT id INTO v_created_by FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;

    -- Check for existing active flow
    SELECT id INTO v_flow_id
    FROM operation_flows
    WHERE room_stay_id = p_room_stay_id AND status = 'ACTIVO'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_flow_id IS NOT NULL THEN
        RETURN v_flow_id;
    END IF;

    -- Create new flow
    INSERT INTO operation_flows (
        room_stay_id, sales_order_id, room_id, room_number,
        shift_session_id, created_by
    ) VALUES (
        p_room_stay_id, p_sales_order_id, p_room_id, p_room_number,
        p_shift_session_id, v_created_by
    ) RETURNING id INTO v_flow_id;

    RETURN v_flow_id;
END;
$$;

-- ================================================================
-- RPC: get_live_operations
-- Returns active operations with latest event info for the board
-- ================================================================
CREATE OR REPLACE FUNCTION get_live_operations(
    p_status TEXT DEFAULT 'ALL',
    p_shift_session_id UUID DEFAULT NULL
)
RETURNS TABLE (
    flow_id UUID,
    flow_number INT,
    room_stay_id UUID,
    room_number TEXT,
    room_status TEXT,
    flow_status TEXT,
    current_stage TEXT,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    stay_status TEXT,
    vehicle_plate TEXT,
    vehicle_brand TEXT,
    valet_name TEXT,
    guest_count INT,
    total_paid NUMERIC,
    latest_event_type TEXT,
    latest_event_desc TEXT,
    latest_event_at TIMESTAMPTZ,
    event_count BIGINT,
    shift_name TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        f.id AS flow_id,
        f.flow_number,
        f.room_stay_id,
        f.room_number,
        r.status AS room_status,
        f.status AS flow_status,
        f.current_stage,
        f.started_at,
        f.completed_at,
        rs.status AS stay_status,
        rs.vehicle_plate,
        rs.vehicle_brand,
        COALESCE(
            (SELECT e.first_name || ' ' || e.last_name
             FROM employees e WHERE e.id = rs.valet_employee_id),
            ''
        ) AS valet_name,
        rs.current_people AS guest_count,
        COALESCE(
            (SELECT SUM(p.amount) FROM payments p
             WHERE p.sales_order_id = f.sales_order_id AND p.status != 'CANCELADO'),
            0
        ) AS total_paid,
        latest.event_type AS latest_event_type,
        latest.description AS latest_event_desc,
        latest.created_at AS latest_event_at,
        (SELECT COUNT(*) FROM flow_events fe WHERE fe.flow_id = f.id) AS event_count,
        COALESCE(
            (SELECT sd.name FROM shift_sessions ss
             JOIN shift_definitions sd ON ss.shift_definition_id = sd.id
             WHERE ss.id = f.shift_session_id),
            ''
        ) AS shift_name
    FROM operation_flows f
    JOIN room_stays rs ON rs.id = f.room_stay_id
    LEFT JOIN rooms r ON r.id = f.room_id
    LEFT JOIN LATERAL (
        SELECT fe.event_type, fe.description, fe.created_at
        FROM flow_events fe
        WHERE fe.flow_id = f.id
        ORDER BY fe.created_at DESC
        LIMIT 1
    ) latest ON true
    WHERE (p_status = 'ALL' OR f.status = p_status)
      AND (p_shift_session_id IS NULL OR f.shift_session_id = p_shift_session_id)
    ORDER BY f.started_at DESC;
END;
$$;

-- ================================================================
-- RPC: get_flow_timeline
-- Returns all events for a specific flow, ordered chronologically
-- ================================================================
CREATE OR REPLACE FUNCTION get_flow_timeline(p_flow_id UUID)
RETURNS TABLE (
    event_id UUID,
    event_type TEXT,
    event_category TEXT,
    description TEXT,
    actor_id UUID,
    actor_name TEXT,
    actor_role TEXT,
    metadata JSONB,
    sequence_number INT,
    duration_from_previous_ms INT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT
        fe.id AS event_id,
        fe.event_type,
        fe.event_category,
        fe.description,
        fe.actor_id,
        fe.actor_name,
        fe.actor_role,
        fe.metadata,
        fe.sequence_number,
        fe.duration_from_previous_ms,
        fe.created_at
    FROM flow_events fe
    WHERE fe.flow_id = p_flow_id
    ORDER BY fe.created_at ASC;
END;
$$;
