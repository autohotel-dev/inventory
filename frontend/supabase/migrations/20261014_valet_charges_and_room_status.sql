-- ════════════════════════════════════════════════════════════════════════════
-- Cobros del cochero, saldo sin doble conteo, faltantes de la app vieja y estado
-- de habitación de camaristas
--
-- 1. guard_direct_loan_status_change: la app instalada del cochero cambia el préstamo a
--    PERDIDO y DESPUÉS intenta crear el cargo, que siempre falla (inserta la columna
--    `description`, que no existe, y `total`, que es calculada). El guard lo marcaba como
--    COBRADO sin que existiera cargo. Ahora queda como faltante sin decidir y se avisa a
--    recepción, igual que resolve_loaned_item.
-- 2. process_extra_charge: el trigger de sales_order_items ya recalcula remaining_amount al
--    insertar el renglón; la función volvía a sumarle el cargo (saldo inflado hasta el
--    siguiente cambio de renglones). Ahora recalcula en lugar de sumar.
-- 3. valet_register_charge: hora extra / persona extra / daño cobrados por el cochero en una
--    sola transacción (cargo + pagos COBRADO_POR_VALET en su turno + extiende la salida o
--    suma la persona). Reemplaza los inserts del teléfono, que nunca funcionaron. Con
--    p_request_id, un doble toque o reintento no cobra dos veces.
-- 4. housekeeping_set_room_status: cambio de estado de camarista solo si la habitación sigue
--    en el estado que la camarista vio (una acción vieja o encolada sin conexión ya no puede
--    pisar una habitación ocupada) y solo transiciones de limpieza/mantenimiento.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. Faltantes de la app vieja: sin decidir, no "cobrados" ─────────────────
CREATE OR REPLACE FUNCTION public.guard_direct_loan_status_change()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp  employees%ROWTYPE;
    v_item text;
    v_room text;
BEGIN
    IF NEW.status IS NOT DISTINCT FROM OLD.status
       OR coalesce(current_setting('app.loan_rpc', true), '') = 'on' THEN
        RETURN NEW;
    END IF;

    IF OLD.status IN ('ANULADO', 'CERRADO_SIN_REVISION') THEN
        NEW.status := OLD.status;
        RETURN NEW;
    END IF;

    SELECT * INTO v_emp FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
    NEW.checked_by := coalesce(v_emp.id, NEW.checked_by);
    NEW.checked_at := now();

    IF NEW.status = 'PERDIDO' AND OLD.status <> 'PERDIDO' THEN
        -- La app vieja no logra crear el cargo: recepción decide (cobrar o perdonar)
        NEW.damage_decision := NULL;
        NEW.damage_amount   := NULL;
        SELECT name INTO v_item FROM loan_item_catalog WHERE id = NEW.loan_item_id;
        SELECT r.number INTO v_room FROM room_stays s JOIN rooms r ON r.id = s.room_id WHERE s.id = NEW.room_stay_id;

        INSERT INTO notifications (user_id, type, title, message, data, is_read)
        SELECT DISTINCT e.auth_user_id, 'system_alert', '⚠️ Artículo faltante',
               format('Hab. %s: falta %s x%s (reportó %s). Decide si se cobra o se perdona.',
                      coalesce(v_room, '?'), coalesce(v_item, 'artículo'), NEW.quantity, coalesce(v_emp.first_name, 'cochero')),
               jsonb_build_object('type', 'LOAN_MISSING', 'loanId', NEW.id, 'stayId', NEW.room_stay_id),
               false
        FROM shift_sessions ss
        JOIN employees e ON e.id = ss.employee_id
        WHERE ss.status IN ('active', 'open')
          AND e.role IN ('receptionist', 'admin', 'manager', 'supervisor', 'gerente')
          AND e.auth_user_id IS NOT NULL;
    ELSIF NEW.status = 'RECUPERADO' THEN
        NEW.recovered_by := coalesce(v_emp.id, NEW.recovered_by);
    END IF;

    RETURN NEW;
END;
$function$;

-- Faltantes que el guard anterior marcó "cobrados" sin cargo (no hay ninguno al escribir esto)
UPDATE public.stay_loaned_items
   SET damage_decision = NULL, damage_amount = NULL, decided_by = NULL, decided_at = NULL,
       notes = concat_ws(' | ', notes, 'Reabierto: la app anterior no generó el cargo')
 WHERE status = 'PERDIDO' AND damage_decision = 'COBRADO' AND damage_item_id IS NULL
   AND notes LIKE '%Cargo automático de la app del cochero (versión anterior)%';

-- ── 2. process_extra_charge: recalcular el saldo, no sumarlo dos veces ───────
CREATE OR REPLACE FUNCTION public.process_extra_charge(p_stay_id uuid, p_charge_type text, p_amount numeric, p_quantity integer DEFAULT 1, p_hours_to_extend integer DEFAULT 0, p_description text DEFAULT NULL::text, p_shift_session_id uuid DEFAULT NULL::uuid, p_payment_reference text DEFAULT 'PAY'::text, p_is_courtesy boolean DEFAULT false, p_courtesy_reason text DEFAULT NULL::text, p_new_current_people integer DEFAULT NULL::integer, p_new_total_people integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_sales_order_id UUID;
  v_stay_status TEXT;
  v_product_id UUID;
  v_product_sku TEXT;
  v_item_id UUID;
  v_total_charge NUMERIC;
  v_new_checkout TIMESTAMPTZ;
  v_i INT;
  v_first_item_id UUID;
  v_payment_concept TEXT;
BEGIN
  -- 1. VALIDATE
  SELECT sales_order_id, status
  INTO v_sales_order_id, v_stay_status
  FROM public.room_stays
  WHERE id = p_stay_id;

  IF v_sales_order_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estancia no encontrada');
  END IF;

  IF v_stay_status <> 'ACTIVA' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La estancia no está activa (estado: ' || v_stay_status || ')');
  END IF;

  -- 2. RESOLVE product
  IF p_charge_type = 'DAMAGE_CHARGE' THEN
    v_product_sku := 'SVC-DAMAGE';
  ELSE
    v_product_sku := 'SVC-ROOM';
  END IF;

  SELECT id INTO v_product_id
  FROM public.products
  WHERE sku = v_product_sku
  LIMIT 1;

  IF v_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Producto ' || v_product_sku || ' no encontrado.');
  END IF;

  -- Map charge_type to payment concept (compatible with mobile app expectations)
  v_payment_concept := CASE p_charge_type
    WHEN 'EXTRA_PERSON' THEN 'PERSONA_EXTRA'
    WHEN 'EXTRA_HOUR'   THEN 'HORA_EXTRA'
    WHEN 'PROMO_4H'     THEN 'PROMO_4H'
    WHEN 'RENEWAL'      THEN 'RENOVACION'
    WHEN 'DAMAGE_CHARGE' THEN 'CARGO_DANO'
    ELSE p_charge_type
  END;

  -- 3. INSERT items
  v_first_item_id := NULL;

  FOR v_i IN 1..p_quantity LOOP
    INSERT INTO public.sales_order_items (
      sales_order_id, product_id, qty, unit_price, concept_type,
      is_paid, is_courtesy, courtesy_reason, shift_session_id
    ) VALUES (
      v_sales_order_id, v_product_id, 1, p_amount, p_charge_type,
      false, p_is_courtesy,
      CASE
        WHEN p_is_courtesy THEN COALESCE(p_courtesy_reason, 'Cortesía')
        WHEN p_charge_type = 'DAMAGE_CHARGE' THEN p_description
        ELSE NULL
      END,
      p_shift_session_id
    ) RETURNING id INTO v_item_id;

    IF v_first_item_id IS NULL THEN
      v_first_item_id := v_item_id;
    END IF;
  END LOOP;

  -- 4. PAYMENT + UPDATE TOTALS (skip if courtesy)
  v_total_charge := p_amount * p_quantity;

  IF NOT p_is_courtesy AND v_total_charge > 0 THEN
    INSERT INTO public.payments (
      sales_order_id, amount, payment_method, reference,
      concept, status, payment_type, shift_session_id
    ) VALUES (
      v_sales_order_id, v_total_charge, 'PENDIENTE', p_payment_reference,
      v_payment_concept, 'PENDIENTE', 'COMPLETO', p_shift_session_id
    );

    UPDATE public.sales_orders SET
      subtotal = subtotal + v_total_charge,
      total = (subtotal + v_total_charge) + tax
    WHERE id = v_sales_order_id;
  END IF;

  -- El trigger de renglones ya lo calculó; se repite por claridad y para no depender del orden
  PERFORM public.recalculate_remaining_amount(v_sales_order_id);

  -- 5. EXTEND checkout time
  IF p_hours_to_extend > 0 THEN
    SELECT expected_check_out_at INTO v_new_checkout
    FROM public.room_stays WHERE id = p_stay_id;

    IF v_new_checkout IS NOT NULL THEN
      v_new_checkout := v_new_checkout + (p_hours_to_extend || ' hours')::interval;
      UPDATE public.room_stays
      SET expected_check_out_at = v_new_checkout
      WHERE id = p_stay_id;
    END IF;
  END IF;

  -- 6. PEOPLE update
  IF p_charge_type = 'EXTRA_PERSON' AND p_new_current_people IS NOT NULL THEN
    UPDATE public.room_stays SET
      current_people = p_new_current_people,
      total_people = COALESCE(p_new_total_people, p_new_current_people)
    WHERE id = p_stay_id;
  END IF;

  -- 7. RETURN
  RETURN jsonb_build_object(
    'success', true,
    'item_id', v_first_item_id,
    'total_charge', v_total_charge,
    'sales_order_id', v_sales_order_id,
    'items_created', p_quantity
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$function$;

-- ── 3. Cobros del cochero: hora extra, persona extra, daño ───────────────────
CREATE OR REPLACE FUNCTION public.valet_register_charge(
    p_stay_id uuid, p_charge_type text, p_amount numeric, p_payments jsonb,
    p_description text DEFAULT NULL, p_request_id uuid DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp      employees%ROWTYPE;
    v_shift    uuid;
    v_stay     room_stays%ROWTYPE;
    v_room     text;
    v_ref      text;
    v_charge   jsonb;
    v_pending  uuid;
    v_pay      jsonb;
    v_idx      integer := 0;
    v_sum      numeric := 0;
    v_label    text;
    v_amount   numeric := round(p_amount, 2);
BEGIN
    SELECT * INTO v_emp FROM employees
     WHERE auth_user_id = auth.uid() AND is_active AND deleted_at IS NULL
       AND role IN ('cochero', 'admin', 'manager', 'gerente', 'supervisor')
     LIMIT 1;
    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Solo un cochero puede registrar este cobro');
    END IF;

    SELECT id INTO v_shift FROM shift_sessions
     WHERE employee_id = v_emp.id AND status IN ('active', 'open')
     ORDER BY clock_in_at DESC LIMIT 1;
    IF v_shift IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Inicia tu turno para registrar cobros');
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

    -- Pagos: [{amount, method, terminal?, cardType?, cardLast4?, reference?}], suman el monto
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

    -- Reintento o doble toque: el mismo request ya se registró
    v_ref := 'VALET-' || p_charge_type || '-' || coalesce(p_request_id::text, gen_random_uuid()::text);
    IF p_request_id IS NOT NULL AND EXISTS (SELECT 1 FROM payments WHERE reference = v_ref) THEN
        RETURN jsonb_build_object('success', true, 'duplicate', true);
    END IF;

    SELECT * INTO v_stay FROM room_stays WHERE id = p_stay_id FOR UPDATE;
    IF v_stay.id IS NULL OR v_stay.status <> 'ACTIVA' THEN
        RETURN jsonb_build_object('success', false, 'error', 'La habitación ya no tiene una estancia activa');
    END IF;
    SELECT number INTO v_room FROM rooms WHERE id = v_stay.room_id;

    -- Cargo (renglón + pago pendiente + totales); el renglón queda en el turno de recepción
    v_charge := process_extra_charge(
        p_stay_id            => p_stay_id,
        p_charge_type        => p_charge_type,
        p_amount             => v_amount,
        p_quantity           => 1,
        p_hours_to_extend    => CASE WHEN p_charge_type = 'EXTRA_HOUR' THEN 1 ELSE 0 END,
        p_description        => CASE WHEN p_charge_type = 'DAMAGE_CHARGE' THEN 'DAÑO: ' || trim(p_description) END,
        p_shift_session_id   => NULL,
        p_payment_reference  => v_ref,
        p_new_current_people => CASE WHEN p_charge_type = 'EXTRA_PERSON' THEN coalesce(v_stay.current_people, 2) + 1 END,
        p_new_total_people   => CASE WHEN p_charge_type = 'EXTRA_PERSON' THEN greatest(coalesce(v_stay.total_people, 2), coalesce(v_stay.current_people, 2) + 1) END
    );
    IF NOT coalesce((v_charge->>'success')::boolean, false) THEN
        RAISE EXCEPTION '%', coalesce(v_charge->>'error', 'No se pudo generar el cargo');
    END IF;

    -- El cochero ya lo hizo: no debe aparecerle como pendiente de verificar
    UPDATE sales_order_items SET
        delivery_status = 'DELIVERED', delivery_accepted_by = v_emp.id,
        delivery_accepted_at = now(), delivery_completed_at = now()
    WHERE id = (v_charge->>'item_id')::uuid;

    -- Pago pendiente → cobrado por el cochero (el primero); los demás, parciales ligados
    SELECT id INTO v_pending FROM payments
     WHERE sales_order_id = v_stay.sales_order_id AND reference = v_ref AND status = 'PENDIENTE'
     LIMIT 1;

    FOR v_pay IN SELECT * FROM jsonb_array_elements(p_payments) LOOP
        v_idx := v_idx + 1;
        IF v_idx = 1 THEN
            UPDATE payments SET
                amount = round((v_pay->>'amount')::numeric, 2),
                payment_method = v_pay->>'method',
                terminal_code = nullif(v_pay->>'terminal', ''),
                card_type = nullif(v_pay->>'cardType', ''),
                card_last_4 = nullif(v_pay->>'cardLast4', ''),
                status = 'COBRADO_POR_VALET',
                payment_type = CASE WHEN jsonb_array_length(p_payments) > 1 THEN 'PARCIAL' ELSE 'COMPLETO' END,
                collected_by = v_emp.id, collected_at = now(),
                shift_session_id = v_shift
            WHERE id = v_pending;
        ELSE
            INSERT INTO payments (
                sales_order_id, amount, payment_method, terminal_code, card_type, card_last_4,
                reference, concept, status, payment_type, parent_payment_id,
                collected_by, collected_at, shift_session_id)
            SELECT v_stay.sales_order_id, round((v_pay->>'amount')::numeric, 2), v_pay->>'method',
                   nullif(v_pay->>'terminal', ''), nullif(v_pay->>'cardType', ''), nullif(v_pay->>'cardLast4', ''),
                   v_ref || '-' || v_idx, p.concept, 'COBRADO_POR_VALET', 'PARCIAL', v_pending,
                   v_emp.id, now(), v_shift
            FROM payments p WHERE p.id = v_pending;
        END IF;
    END LOOP;

    v_label := CASE p_charge_type WHEN 'EXTRA_HOUR' THEN 'hora extra' WHEN 'EXTRA_PERSON' THEN 'persona extra' ELSE 'daño' END;
    INSERT INTO notifications (user_id, type, title, message, data, is_read)
    SELECT DISTINCT e.auth_user_id, 'system_alert', '💵 Cobro del cochero',
           format('Hab. %s: %s cobró %s por $%s. Corrobora el dinero.', coalesce(v_room, '?'), v_emp.first_name, v_label, v_amount),
           jsonb_build_object('type', 'VALET_CHARGE', 'chargeType', p_charge_type, 'stayId', p_stay_id, 'itemId', v_charge->>'item_id'),
           false
    FROM shift_sessions ss JOIN employees e ON e.id = ss.employee_id
    WHERE ss.status IN ('active', 'open')
      AND e.role IN ('receptionist', 'admin', 'manager', 'supervisor', 'gerente')
      AND e.auth_user_id IS NOT NULL;

    RETURN jsonb_build_object('success', true, 'item_id', v_charge->>'item_id', 'amount', v_amount);
END;
$function$;

-- ── 4. Estado de habitación desde la app de camaristas ───────────────────────
CREATE OR REPLACE FUNCTION public.housekeeping_set_room_status(
    p_room_id uuid, p_expected_status text, p_new_status text,
    p_notes text DEFAULT NULL, p_image_url text DEFAULT NULL)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_emp  employees%ROWTYPE;
    v_room rooms%ROWTYPE;
    v_ok   boolean;
BEGIN
    SELECT * INTO v_emp FROM employees
     WHERE auth_user_id = auth.uid() AND is_active AND deleted_at IS NULL
       AND role IN ('camarista', 'mantenimiento', 'admin', 'manager', 'gerente', 'supervisor')
     LIMIT 1;
    IF v_emp.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'No tienes permiso para cambiar el estado de habitaciones');
    END IF;

    SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
    IF v_room.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Habitación no encontrada');
    END IF;

    -- Alguien más la cambió (recepción la ocupó, otra camarista la tomó, acción vieja sin conexión)
    IF v_room.status IS DISTINCT FROM p_expected_status THEN
        RETURN jsonb_build_object('success', false, 'conflict', true, 'current_status', v_room.status,
            'error', format('La habitación %s ya está %s', v_room.number, v_room.status));
    END IF;
    IF EXISTS (SELECT 1 FROM room_stays WHERE room_id = p_room_id AND status = 'ACTIVA') THEN
        RETURN jsonb_build_object('success', false, 'conflict', true, 'current_status', 'OCUPADA',
            'error', format('La habitación %s tiene una estancia activa', v_room.number));
    END IF;

    v_ok := (v_room.status, p_new_status) IN (
        ('LIMPIANDO', 'LIBRE'), ('BLOQUEADA', 'LIBRE'),
        ('SUCIA', 'LIMPIANDO'), ('LIBRE', 'LIMPIANDO'),
        ('LIBRE', 'SUCIA'), ('BLOQUEADA', 'SUCIA'),
        ('LIBRE', 'BLOQUEADA'), ('SUCIA', 'BLOQUEADA'), ('LIMPIANDO', 'BLOQUEADA'), ('BLOQUEADA', 'BLOQUEADA'));
    IF NOT v_ok THEN
        RETURN jsonb_build_object('success', false, 'error', format('No se puede pasar de %s a %s', v_room.status, p_new_status));
    END IF;
    IF p_new_status = 'BLOQUEADA' AND nullif(trim(p_notes), '') IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Describe el problema de mantenimiento');
    END IF;

    UPDATE rooms SET
        status = p_new_status,
        notes = CASE WHEN p_new_status = 'BLOQUEADA' THEN trim(p_notes) ELSE NULL END,
        maintenance_image_url = CASE WHEN p_new_status = 'BLOQUEADA' THEN coalesce(p_image_url, maintenance_image_url) ELSE NULL END
    WHERE id = p_room_id;

    RETURN jsonb_build_object('success', true, 'status', p_new_status);
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.valet_register_charge(uuid, text, numeric, jsonb, text, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.housekeeping_set_room_status(uuid, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valet_register_charge(uuid, text, numeric, jsonb, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.housekeeping_set_room_status(uuid, text, text, text, text) TO authenticated, service_role;

-- ── 5. Saldos de estancias activas inflados por el doble conteo ──────────────
SELECT public.recalculate_remaining_amount(s.sales_order_id)
FROM public.room_stays s
JOIN public.sales_orders so ON so.id = s.sales_order_id
WHERE s.status = 'ACTIVA'
  AND so.remaining_amount <> coalesce((
      SELECT sum(i.total) FROM public.sales_order_items i
      WHERE i.sales_order_id = so.id AND NOT coalesce(i.is_paid, false) AND NOT coalesce(i.is_cancelled, false)), 0);

COMMIT;
