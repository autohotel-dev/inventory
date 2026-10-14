-- ════════════════════════════════════════════════════════════════════════════
-- Cobros del cochero: solicitud → aprobación de recepción
--
-- Regla de operación (2026-10-14): los cocheros son los ojos de recepción afuera; pueden
-- REPORTAR y SUGERIR cambios, pero quien aprueba o modifica cargos, horas y pagos es
-- recepción. valet_register_charge (20261014_valet_charges_and_room_status) generaba el cargo y
-- extendía la salida en el acto; ahora solo registra la solicitud con lo que cobró el cochero
-- y avisa a recepción. Recepción la aprueba (se genera el cargo, se extiende la salida o se
-- suma la persona, y los pagos quedan COBRADO_POR_VALET para corroborar como siempre) o la
-- rechaza con motivo; el cochero recibe el aviso de la decisión.
-- La app aún no usaba valet_register_charge: no hay cargos generados por la versión anterior.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

CREATE TABLE IF NOT EXISTS public.valet_charge_requests (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_stay_id       uuid NOT NULL REFERENCES public.room_stays(id) ON DELETE CASCADE,
  charge_type        text NOT NULL CHECK (charge_type IN ('EXTRA_HOUR', 'EXTRA_PERSON', 'DAMAGE_CHARGE')),
  amount             numeric(10,2) NOT NULL CHECK (amount > 0),
  payments           jsonb NOT NULL,
  description        text,
  request_id         uuid UNIQUE,
  requested_by       uuid NOT NULL REFERENCES public.employees(id),
  requested_shift_id uuid REFERENCES public.shift_sessions(id) ON DELETE SET NULL,
  requested_at       timestamptz NOT NULL DEFAULT now(),
  status             text NOT NULL DEFAULT 'PENDIENTE' CHECK (status IN ('PENDIENTE', 'APROBADA', 'RECHAZADA')),
  decided_by         uuid REFERENCES public.employees(id),
  decided_at         timestamptz,
  decision_note      text,
  item_id            uuid REFERENCES public.sales_order_items(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_valet_charge_requests_pending ON public.valet_charge_requests (requested_at) WHERE status = 'PENDIENTE';
CREATE INDEX IF NOT EXISTS idx_valet_charge_requests_stay ON public.valet_charge_requests (room_stay_id);

ALTER TABLE public.valet_charge_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS valet_charge_requests_select ON public.valet_charge_requests;
CREATE POLICY valet_charge_requests_select ON public.valet_charge_requests FOR SELECT TO authenticated USING (true);
-- Sin políticas de escritura: solo las funciones (SECURITY DEFINER) crean y deciden solicitudes
REVOKE INSERT, UPDATE, DELETE ON public.valet_charge_requests FROM anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables
                 WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'valet_charge_requests') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.valet_charge_requests;
  END IF;
END $$;

-- ── Cochero: reporta lo que cobró (solo solicitud) ───────────────────────────
CREATE OR REPLACE FUNCTION public.valet_register_charge(
    p_stay_id uuid, p_charge_type text, p_amount numeric, p_payments jsonb,
    p_description text DEFAULT NULL, p_request_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp    employees%ROWTYPE;
    v_shift  uuid;
    v_stay   room_stays%ROWTYPE;
    v_room   text;
    v_pay    jsonb;
    v_sum    numeric := 0;
    v_label  text;
    v_id     uuid;
    v_amount numeric := round(p_amount, 2);
BEGIN
    SELECT * INTO v_emp FROM employees
     WHERE auth_user_id = auth.uid() AND is_active AND deleted_at IS NULL
       AND role IN ('cochero', 'admin', 'manager', 'gerente', 'supervisor')
     LIMIT 1;
    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo un cochero puede reportar este cobro');
    END IF;

    SELECT id INTO v_shift FROM shift_sessions
     WHERE employee_id = v_emp.id AND status IN ('active', 'open')
     ORDER BY clock_in_at DESC LIMIT 1;
    IF v_shift IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Inicia tu turno para reportar cobros');
    END IF;

    IF p_charge_type NOT IN ('EXTRA_HOUR', 'EXTRA_PERSON', 'DAMAGE_CHARGE') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Tipo de cobro inválido');
    END IF;
    IF v_amount IS NULL OR v_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'El monto debe ser mayor a 0');
    END IF;
    IF p_charge_type = 'DAMAGE_CHARGE' AND nullif(trim(p_description), '') IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Describe el daño');
    END IF;

    IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) = 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Indica cómo se cobró');
    END IF;
    FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
        IF coalesce((v_pay->>'amount')::numeric, 0) <= 0 THEN
            RETURN jsonb_build_object('success', false, 'error', 'Cada pago debe ser mayor a 0');
        END IF;
        IF coalesce(v_pay->>'method', '') NOT IN ('EFECTIVO', 'TARJETA', 'TRANSFERENCIA') THEN
            RETURN jsonb_build_object('success', false, 'error', 'Método de pago inválido');
        END IF;
        v_sum := v_sum + round((v_pay->>'amount')::numeric, 2);
    END LOOP;
    IF abs(v_sum - v_amount) > 0.01 THEN
        RETURN jsonb_build_object('success', false, 'error', format('Los pagos ($%s) no suman el cobro ($%s)', v_sum, v_amount));
    END IF;

    -- Reintento o doble toque: la misma solicitud ya se registró
    IF p_request_id IS NOT NULL THEN
        SELECT id INTO v_id FROM valet_charge_requests WHERE request_id = p_request_id;
        IF v_id IS NOT NULL THEN
            RETURN jsonb_build_object('success', true, 'duplicate', true, 'request_id', v_id);
        END IF;
    END IF;

    SELECT * INTO v_stay FROM room_stays WHERE id = p_stay_id;
    IF v_stay.id IS NULL OR v_stay.status <> 'ACTIVA' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La habitación ya no tiene una estancia activa');
    END IF;
    SELECT number INTO v_room FROM rooms WHERE id = v_stay.room_id;

    INSERT INTO valet_charge_requests (room_stay_id, charge_type, amount, payments, description, request_id, requested_by, requested_shift_id)
    VALUES (p_stay_id, p_charge_type, v_amount, p_payments, nullif(trim(p_description), ''), p_request_id, v_emp.id, v_shift)
    RETURNING id INTO v_id;

    v_label := CASE p_charge_type WHEN 'EXTRA_HOUR' THEN 'hora extra' WHEN 'EXTRA_PERSON' THEN 'persona extra' ELSE 'daño' END;
    INSERT INTO notifications (user_id, type, title, message, data, is_read)
    SELECT DISTINCT e.auth_user_id, 'system_alert', '🚗 Cobro del cochero por aprobar',
           format('Hab. %s: %s reporta %s por $%s. Apruébalo o recházalo en Habitaciones.', coalesce(v_room, '?'), v_emp.first_name, v_label, v_amount),
           jsonb_build_object('type', 'VALET_CHARGE_REQUEST', 'requestId', v_id, 'stayId', p_stay_id),
           false
    FROM shift_sessions ss JOIN employees e ON e.id = ss.employee_id
    WHERE ss.status IN ('active', 'open')
      AND e.role IN ('receptionist', 'admin', 'manager', 'supervisor', 'gerente')
      AND e.auth_user_id IS NOT NULL;

    RETURN jsonb_build_object('success', true, 'request_id', v_id, 'pending', true);
END;
$function$;

-- ── Recepción: aprueba (genera el cargo) o rechaza ───────────────────────────
CREATE OR REPLACE FUNCTION public.decide_valet_charge_request(p_request_id uuid, p_approve boolean, p_note text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp     employees%ROWTYPE;
    v_req     valet_charge_requests%ROWTYPE;
    v_stay    room_stays%ROWTYPE;
    v_valet   employees%ROWTYPE;
    v_shift   uuid;
    v_ref     text;
    v_charge  jsonb;
    v_pending uuid;
    v_pay     jsonb;
    v_idx     integer := 0;
    v_label   text;
    v_room    text;
BEGIN
    SELECT * INTO v_emp FROM employees
     WHERE auth_user_id = auth.uid() AND is_active AND deleted_at IS NULL
       AND role IN ('receptionist', 'admin', 'manager', 'supervisor', 'gerente')
     LIMIT 1;
    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo recepción puede aprobar o rechazar cobros del cochero');
    END IF;

    SELECT * INTO v_req FROM valet_charge_requests WHERE id = p_request_id FOR UPDATE;
    IF v_req.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solicitud no encontrada');
    END IF;
    IF v_req.status <> 'PENDIENTE' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Esta solicitud ya fue ' || lower(v_req.status));
    END IF;

    SELECT * INTO v_valet FROM employees WHERE id = v_req.requested_by;
    SELECT * INTO v_stay FROM room_stays WHERE id = v_req.room_stay_id FOR UPDATE;
    SELECT number INTO v_room FROM rooms WHERE id = v_stay.room_id;
    v_label := CASE v_req.charge_type WHEN 'EXTRA_HOUR' THEN 'hora extra' WHEN 'EXTRA_PERSON' THEN 'persona extra' ELSE 'daño' END;

    IF NOT p_approve THEN
        IF nullif(trim(p_note), '') IS NULL THEN
            RETURN jsonb_build_object('success', false, 'error', 'Indica el motivo del rechazo');
        END IF;
        UPDATE valet_charge_requests SET status = 'RECHAZADA', decided_by = v_emp.id, decided_at = now(), decision_note = trim(p_note)
         WHERE id = p_request_id;
        IF v_valet.auth_user_id IS NOT NULL THEN
            INSERT INTO notifications (user_id, type, title, message, data, is_read)
            VALUES (v_valet.auth_user_id, 'system_alert', '❌ Cobro rechazado',
                    format('Hab. %s: recepción rechazó tu %s por $%s. Motivo: %s', coalesce(v_room, '?'), v_label, v_req.amount, trim(p_note)),
                    jsonb_build_object('type', 'VALET_CHARGE_REJECTED', 'requestId', p_request_id, 'stayId', v_req.room_stay_id), false);
        END IF;
        RETURN jsonb_build_object('success', true, 'status', 'RECHAZADA');
    END IF;

    IF v_stay.id IS NULL OR v_stay.status <> 'ACTIVA' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La estancia ya no está activa: no hay cuenta donde cargar. Recházala con el motivo.');
    END IF;

    SELECT id INTO v_shift FROM shift_sessions
     WHERE employee_id = v_emp.id AND status IN ('active', 'open')
     ORDER BY clock_in_at DESC LIMIT 1;

    v_ref := 'VALET-' || v_req.charge_type || '-' || v_req.id;
    v_charge := process_extra_charge(
        p_stay_id            => v_req.room_stay_id,
        p_charge_type        => v_req.charge_type,
        p_amount             => v_req.amount,
        p_quantity           => 1,
        p_hours_to_extend    => CASE WHEN v_req.charge_type = 'EXTRA_HOUR' THEN 1 ELSE 0 END,
        p_description        => CASE WHEN v_req.charge_type = 'DAMAGE_CHARGE' THEN 'DAÑO: ' || v_req.description END,
        p_shift_session_id   => v_shift,
        p_payment_reference  => v_ref,
        p_new_current_people => CASE WHEN v_req.charge_type = 'EXTRA_PERSON' THEN coalesce(v_stay.current_people, 2) + 1 END,
        p_new_total_people   => CASE WHEN v_req.charge_type = 'EXTRA_PERSON' THEN greatest(coalesce(v_stay.total_people, 2), coalesce(v_stay.current_people, 2) + 1) END
    );
    IF NOT coalesce((v_charge->>'success')::boolean, false) THEN
        RAISE EXCEPTION '%', coalesce(v_charge->>'error', 'No se pudo generar el cargo');
    END IF;

    -- El cochero ya hizo el trabajo: el renglón no le queda pendiente de verificar
    UPDATE sales_order_items SET
        delivery_status = 'DELIVERED', delivery_accepted_by = v_req.requested_by,
        delivery_accepted_at = v_req.requested_at, delivery_completed_at = v_req.requested_at
    WHERE id = (v_charge->>'item_id')::uuid;

    -- El dinero lo trae el cochero: pagos COBRADO_POR_VALET en su turno, recepción los corrobora como siempre
    SELECT id INTO v_pending FROM payments
     WHERE sales_order_id = v_stay.sales_order_id AND reference = v_ref AND status = 'PENDIENTE'
     LIMIT 1;

    FOR v_pay IN SELECT * FROM jsonb_array_elements(v_req.payments) LOOP
        v_idx := v_idx + 1;
        IF v_idx = 1 THEN
            UPDATE payments SET
                amount = round((v_pay->>'amount')::numeric, 2),
                payment_method = v_pay->>'method',
                terminal_code = nullif(v_pay->>'terminal', ''),
                card_type = nullif(v_pay->>'cardType', ''),
                card_last_4 = nullif(v_pay->>'cardLast4', ''),
                status = 'COBRADO_POR_VALET',
                payment_type = CASE WHEN jsonb_array_length(v_req.payments) > 1 THEN 'PARCIAL' ELSE 'COMPLETO' END,
                collected_by = v_req.requested_by, collected_at = v_req.requested_at,
                shift_session_id = coalesce(v_req.requested_shift_id, shift_session_id)
            WHERE id = v_pending;
        ELSE
            INSERT INTO payments (
                sales_order_id, amount, payment_method, terminal_code, card_type, card_last_4,
                reference, concept, status, payment_type, parent_payment_id,
                collected_by, collected_at, shift_session_id)
            SELECT v_stay.sales_order_id, round((v_pay->>'amount')::numeric, 2), v_pay->>'method',
                   nullif(v_pay->>'terminal', ''), nullif(v_pay->>'cardType', ''), nullif(v_pay->>'cardLast4', ''),
                   v_ref || '-' || v_idx, p.concept, 'COBRADO_POR_VALET', 'PARCIAL', v_pending,
                   v_req.requested_by, v_req.requested_at, coalesce(v_req.requested_shift_id, p.shift_session_id)
            FROM payments p WHERE p.id = v_pending;
        END IF;
    END LOOP;

    UPDATE valet_charge_requests SET status = 'APROBADA', decided_by = v_emp.id, decided_at = now(),
           decision_note = nullif(trim(p_note), ''), item_id = (v_charge->>'item_id')::uuid
     WHERE id = p_request_id;

    IF v_valet.auth_user_id IS NOT NULL THEN
        INSERT INTO notifications (user_id, type, title, message, data, is_read)
        VALUES (v_valet.auth_user_id, 'system_alert', '✅ Cobro aprobado',
                format('Hab. %s: recepción aprobó tu %s por $%s. Entrega el dinero en recepción.', coalesce(v_room, '?'), v_label, v_req.amount),
                jsonb_build_object('type', 'VALET_CHARGE_APPROVED', 'requestId', p_request_id, 'stayId', v_req.room_stay_id), false);
    END IF;

    RETURN jsonb_build_object('success', true, 'status', 'APROBADA', 'item_id', v_charge->>'item_id');
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.decide_valet_charge_request(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.decide_valet_charge_request(uuid, boolean, text) TO authenticated, service_role;

COMMIT;
