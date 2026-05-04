-- ============================================================================
-- OPERATION FLOWS: Flujo maestro de operaciones en tiempo real
-- Cada estancia genera un flujo (operation_flow) que agrupa todos los
-- micro-eventos (flow_events) desde la asignación hasta el checkout.
-- ============================================================================

-- ─── 1. Tabla Maestra de Flujos ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS operation_flows (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_number   serial UNIQUE,
    room_stay_id  uuid REFERENCES room_stays(id) ON DELETE SET NULL,
    sales_order_id uuid REFERENCES sales_orders(id) ON DELETE SET NULL,
    room_id       uuid REFERENCES rooms(id) ON DELETE SET NULL,
    room_number   text NOT NULL,
    status        text NOT NULL DEFAULT 'ACTIVO'
                    CHECK (status IN ('ACTIVO', 'COMPLETADO', 'CANCELADO')),
    current_stage text DEFAULT 'ROOM_ASSIGNED',
    started_at    timestamptz NOT NULL DEFAULT now(),
    completed_at  timestamptz,
    shift_session_id uuid,
    created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Indices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_operation_flows_status ON operation_flows(status);
CREATE INDEX IF NOT EXISTS idx_operation_flows_room_stay ON operation_flows(room_stay_id);
CREATE INDEX IF NOT EXISTS idx_operation_flows_room_number ON operation_flows(room_number);
CREATE INDEX IF NOT EXISTS idx_operation_flows_created_at ON operation_flows(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_operation_flows_started_at ON operation_flows(started_at DESC);

-- ─── 2. Tabla de Eventos Granulares ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS flow_events (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    flow_id                  uuid NOT NULL REFERENCES operation_flows(id) ON DELETE CASCADE,
    event_type               text NOT NULL,
    event_category           text NOT NULL DEFAULT 'SYSTEM'
                               CHECK (event_category IN (
                                 'ROOM', 'PAYMENT', 'VALET', 'CONSUMPTION',
                                 'CHECKOUT', 'SYSTEM', 'EXTRAS', 'CLIENT'
                               )),
    description              text NOT NULL,
    actor_id                 uuid,
    actor_name               text,
    actor_role               text,
    metadata                 jsonb DEFAULT '{}'::jsonb,
    sequence_number          integer NOT NULL DEFAULT 0,
    duration_from_previous_ms bigint DEFAULT 0,
    created_at               timestamptz NOT NULL DEFAULT now()
);

-- Indices para consultas frecuentes
CREATE INDEX IF NOT EXISTS idx_flow_events_flow_id ON flow_events(flow_id);
CREATE INDEX IF NOT EXISTS idx_flow_events_type ON flow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_flow_events_category ON flow_events(event_category);
CREATE INDEX IF NOT EXISTS idx_flow_events_created_at ON flow_events(created_at);
CREATE INDEX IF NOT EXISTS idx_flow_events_flow_seq ON flow_events(flow_id, sequence_number);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE operation_flows ENABLE ROW LEVEL SECURITY;
ALTER TABLE flow_events ENABLE ROW LEVEL SECURITY;

-- Políticas permisivas para usuarios autenticados (lectura y escritura)
CREATE POLICY "Authenticated users can read operation_flows"
    ON operation_flows FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert operation_flows"
    ON operation_flows FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Authenticated users can update operation_flows"
    ON operation_flows FOR UPDATE
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can read flow_events"
    ON flow_events FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Authenticated users can insert flow_events"
    ON flow_events FOR INSERT
    TO authenticated
    WITH CHECK (true);

-- ─── 4. Trigger: updated_at automático ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_operation_flows_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_operation_flows_updated_at
    BEFORE UPDATE ON operation_flows
    FOR EACH ROW
    EXECUTE FUNCTION update_operation_flows_updated_at();

-- ─── 5. Trigger: Auto-calculate sequence_number y duration ───────────────────

CREATE OR REPLACE FUNCTION calculate_flow_event_sequence()
RETURNS TRIGGER AS $$
DECLARE
    prev_seq integer;
    prev_ts  timestamptz;
BEGIN
    -- Obtener el último evento de este flujo
    SELECT sequence_number, created_at
    INTO prev_seq, prev_ts
    FROM flow_events
    WHERE flow_id = NEW.flow_id
    ORDER BY sequence_number DESC
    LIMIT 1;

    IF prev_seq IS NULL THEN
        NEW.sequence_number := 1;
        NEW.duration_from_previous_ms := 0;
    ELSE
        NEW.sequence_number := prev_seq + 1;
        NEW.duration_from_previous_ms := EXTRACT(EPOCH FROM (NEW.created_at - prev_ts)) * 1000;
    END IF;

    -- Actualizar current_stage del flujo padre
    UPDATE operation_flows
    SET current_stage = NEW.event_type,
        updated_at = now()
    WHERE id = NEW.flow_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_flow_event_sequence
    BEFORE INSERT ON flow_events
    FOR EACH ROW
    EXECUTE FUNCTION calculate_flow_event_sequence();

-- ─── 6. RPC: Crear o obtener flujo existente para una estancia ───────────────

CREATE OR REPLACE FUNCTION create_or_get_flow(
    p_room_stay_id uuid,
    p_sales_order_id uuid DEFAULT NULL,
    p_room_id uuid DEFAULT NULL,
    p_room_number text DEFAULT '',
    p_shift_session_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_flow_id uuid;
BEGIN
    -- Buscar flujo activo existente para esta estancia
    SELECT id INTO v_flow_id
    FROM operation_flows
    WHERE room_stay_id = p_room_stay_id
      AND status = 'ACTIVO'
    LIMIT 1;

    -- Si no existe, crear uno nuevo
    IF v_flow_id IS NULL THEN
        INSERT INTO operation_flows (
            room_stay_id, sales_order_id, room_id, room_number,
            shift_session_id, created_by
        ) VALUES (
            p_room_stay_id, p_sales_order_id, p_room_id, p_room_number,
            p_shift_session_id, auth.uid()
        )
        RETURNING id INTO v_flow_id;
    END IF;

    RETURN v_flow_id;
END;
$$;

-- ─── 7. RPC: Obtener timeline de un flujo ────────────────────────────────────

CREATE OR REPLACE FUNCTION get_flow_timeline(p_flow_id uuid)
RETURNS TABLE (
    id uuid,
    event_type text,
    event_category text,
    description text,
    actor_id uuid,
    actor_name text,
    actor_role text,
    metadata jsonb,
    sequence_number integer,
    duration_from_previous_ms bigint,
    created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT
        fe.id,
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
    ORDER BY fe.sequence_number ASC;
$$;

-- ─── 8. Habilitar Realtime ───────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE operation_flows;
ALTER PUBLICATION supabase_realtime ADD TABLE flow_events;

-- ─── FIN ─────────────────────────────────────────────────────────────────────
