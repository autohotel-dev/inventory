-- ============================================================================
-- BACKFILL: Crear flujos y eventos a partir de datos existentes
-- Ejecutar DESPUÉS de la migración 20260504_operation_flows.sql
-- ============================================================================

-- ─── 1. Crear operation_flows para TODAS las room_stays existentes ──────────

INSERT INTO operation_flows (
    room_stay_id,
    sales_order_id,
    room_id,
    room_number,
    status,
    current_stage,
    started_at,
    completed_at,
    shift_session_id,
    created_by
)
SELECT
    rs.id AS room_stay_id,
    rs.sales_order_id,
    rs.room_id,
    r.number AS room_number,
    CASE
        WHEN rs.status = 'ACTIVA' THEN 'ACTIVO'
        WHEN rs.status = 'FINALIZADA' THEN 'COMPLETADO'
        WHEN rs.status = 'CANCELADA' THEN 'CANCELADO'
        ELSE 'COMPLETADO'
    END AS status,
    CASE
        WHEN rs.status = 'ACTIVA' THEN 'ROOM_ASSIGNED'
        WHEN rs.status = 'FINALIZADA' THEN 'CHECKOUT_COMPLETED'
        ELSE 'ROOM_ASSIGNED'
    END AS current_stage,
    rs.check_in_at AS started_at,
    rs.actual_check_out_at AS completed_at,
    NULL AS shift_session_id,
    NULL AS created_by
FROM room_stays rs
JOIN rooms r ON r.id = rs.room_id
WHERE rs.sales_order_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM operation_flows of2
      WHERE of2.room_stay_id = rs.id
  )
ORDER BY rs.check_in_at ASC;

-- ─── 2. Reconstruir flow_events desde audit_logs ────────────────────────────
-- Mapeamos las acciones de audit_logs a event_types del catálogo

-- Mapa de acciones audit → event_type del catálogo de flujos
-- CHECKOUT       → CHECKOUT_COMPLETED
-- EXTRA_HOUR     → EXTRA_HOUR_ADDED
-- EXTRA_PERSON   → EXTRA_PERSON_ADDED
-- ADD_PERSON     → PERSON_ADDED
-- REMOVE_PERSON  → PERSON_REMOVED
-- TOLERANCE      → TOLERANCE_STARTED
-- COURTESY       → COURTESY_APPLIED
-- RENEWAL        → RENEWAL_APPLIED
-- DAMAGE_CHARGE  → DAMAGE_REPORTED
-- PROMO_4H       → EXTRA_HOUR_ADDED
-- CANCEL_ITEM    → PAYMENT_CANCELLED
-- CANCEL_CHARGE  → PAYMENT_CANCELLED
-- CONSUMPTION_ADDED → CONSUMPTION_ADDED
-- PAYMENT_METHOD_CHANGE → PAYMENT_METHOD_CHANGED
-- UPDATE (room status) → ROOM_STATUS_CHANGED

INSERT INTO flow_events (
    flow_id,
    event_type,
    event_category,
    description,
    actor_id,
    actor_name,
    actor_role,
    metadata,
    sequence_number,
    duration_from_previous_ms,
    created_at
)
SELECT
    of.id AS flow_id,
    CASE al.action
        WHEN 'CHECKOUT' THEN 'CHECKOUT_COMPLETED'
        WHEN 'EXTRA_HOUR' THEN 'EXTRA_HOUR_ADDED'
        WHEN 'EXTRA_PERSON' THEN 'EXTRA_PERSON_ADDED'
        WHEN 'ADD_PERSON' THEN 'PERSON_ADDED'
        WHEN 'REMOVE_PERSON' THEN 'PERSON_REMOVED'
        WHEN 'TOLERANCE' THEN 'TOLERANCE_STARTED'
        WHEN 'COURTESY' THEN 'COURTESY_APPLIED'
        WHEN 'RENEWAL' THEN 'RENEWAL_APPLIED'
        WHEN 'DAMAGE_CHARGE' THEN 'DAMAGE_REPORTED'
        WHEN 'PROMO_4H' THEN 'EXTRA_HOUR_ADDED'
        WHEN 'CANCEL_ITEM' THEN 'PAYMENT_CANCELLED'
        WHEN 'CANCEL_CHARGE' THEN 'PAYMENT_CANCELLED'
        WHEN 'CONSUMPTION_ADDED' THEN 'CONSUMPTION_ADDED'
        WHEN 'PAYMENT_METHOD_CHANGE' THEN 'PAYMENT_METHOD_CHANGED'
        WHEN 'UPDATE' THEN 'ROOM_STATUS_CHANGED'
        ELSE 'CUSTOM_EVENT'
    END AS event_type,
    CASE al.action
        WHEN 'CHECKOUT' THEN 'CHECKOUT'
        WHEN 'EXTRA_HOUR' THEN 'EXTRAS'
        WHEN 'EXTRA_PERSON' THEN 'EXTRAS'
        WHEN 'ADD_PERSON' THEN 'EXTRAS'
        WHEN 'REMOVE_PERSON' THEN 'EXTRAS'
        WHEN 'TOLERANCE' THEN 'CHECKOUT'
        WHEN 'COURTESY' THEN 'PAYMENT'
        WHEN 'RENEWAL' THEN 'ROOM'
        WHEN 'DAMAGE_CHARGE' THEN 'EXTRAS'
        WHEN 'PROMO_4H' THEN 'EXTRAS'
        WHEN 'CANCEL_ITEM' THEN 'PAYMENT'
        WHEN 'CANCEL_CHARGE' THEN 'PAYMENT'
        WHEN 'CONSUMPTION_ADDED' THEN 'CONSUMPTION'
        WHEN 'PAYMENT_METHOD_CHANGE' THEN 'PAYMENT'
        WHEN 'UPDATE' THEN 'ROOM'
        ELSE 'SYSTEM'
    END AS event_category,
    COALESCE(al.description, al.action || ' en Hab. ' || al.room_number) AS description,
    al.employee_id::uuid AS actor_id,
    al.employee_name AS actor_name,
    al.user_role AS actor_role,
    COALESCE(al.metadata, '{}'::jsonb) ||
        CASE WHEN al.amount IS NOT NULL THEN jsonb_build_object('amount', al.amount) ELSE '{}'::jsonb END ||
        CASE WHEN al.payment_method IS NOT NULL THEN jsonb_build_object('payment_method', al.payment_method) ELSE '{}'::jsonb END
    AS metadata,
    ROW_NUMBER() OVER (PARTITION BY of.id ORDER BY al.created_at ASC) AS sequence_number,
    0 AS duration_from_previous_ms,  -- Se recalculará abajo
    al.created_at
FROM audit_logs al
JOIN operation_flows of ON of.room_number = al.room_number
    AND al.created_at >= of.started_at
    AND (of.completed_at IS NULL OR al.created_at <= of.completed_at + interval '1 hour')
WHERE al.room_number IS NOT NULL
  AND al.room_number != ''
  AND al.action IN (
      'CHECKOUT', 'EXTRA_HOUR', 'EXTRA_PERSON', 'ADD_PERSON', 'REMOVE_PERSON',
      'TOLERANCE', 'COURTESY', 'RENEWAL', 'DAMAGE_CHARGE', 'PROMO_4H',
      'CANCEL_ITEM', 'CANCEL_CHARGE', 'CONSUMPTION_ADDED', 'PAYMENT_METHOD_CHANGE',
      'UPDATE'
  )
  -- Evitar duplicados si se ejecuta múltiples veces
  AND NOT EXISTS (
      SELECT 1 FROM flow_events fe
      WHERE fe.flow_id = of.id
        AND fe.created_at = al.created_at
        AND fe.description = COALESCE(al.description, al.action || ' en Hab. ' || al.room_number)
  )
ORDER BY al.created_at ASC;

-- ─── 3. Agregar evento inicial ROOM_ASSIGNED para flujos sin eventos ────────
-- Para flujos que no tuvieron audit_logs coincidentes, crear al menos
-- el evento de asignación de habitación.

INSERT INTO flow_events (
    flow_id,
    event_type,
    event_category,
    description,
    metadata,
    sequence_number,
    duration_from_previous_ms,
    created_at
)
SELECT
    of.id AS flow_id,
    'ROOM_ASSIGNED' AS event_type,
    'ROOM' AS event_category,
    'Habitación ' || of.room_number || ' asignada (reconstruido del historial)' AS description,
    jsonb_build_object('room_number', of.room_number, 'backfilled', true) AS metadata,
    1 AS sequence_number,
    0 AS duration_from_previous_ms,
    of.started_at AS created_at
FROM operation_flows of
WHERE NOT EXISTS (
    SELECT 1 FROM flow_events fe WHERE fe.flow_id = of.id
);

-- ─── 4. Recalcular duration_from_previous_ms ────────────────────────────────

WITH ordered_events AS (
    SELECT
        fe.id,
        fe.flow_id,
        fe.created_at,
        LAG(fe.created_at) OVER (PARTITION BY fe.flow_id ORDER BY fe.sequence_number) AS prev_created_at
    FROM flow_events fe
)
UPDATE flow_events fe
SET duration_from_previous_ms = CASE
    WHEN oe.prev_created_at IS NULL THEN 0
    ELSE EXTRACT(EPOCH FROM (oe.created_at - oe.prev_created_at)) * 1000
END
FROM ordered_events oe
WHERE fe.id = oe.id;

-- ─── 5. Actualizar current_stage de cada flujo ──────────────────────────────

UPDATE operation_flows of
SET current_stage = (
    SELECT fe.event_type
    FROM flow_events fe
    WHERE fe.flow_id = of.id
    ORDER BY fe.sequence_number DESC
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 FROM flow_events fe WHERE fe.flow_id = of.id
);

-- ─── FIN ─────────────────────────────────────────────────────────────────────
-- Verificar resultados:
-- SELECT count(*) AS total_flows FROM operation_flows;
-- SELECT count(*) AS total_events FROM flow_events;
-- SELECT of.room_number, of.status, count(fe.id) AS events
-- FROM operation_flows of
-- LEFT JOIN flow_events fe ON fe.flow_id = of.id
-- GROUP BY of.id, of.room_number, of.status
-- ORDER BY of.started_at DESC
-- LIMIT 20;
