-- ════════════════════════════════════════════════════════════════════════════
-- Flujo recepción ↔ cochero: correcciones encontradas en la auditoría (2026-10-14)
--
-- 1. process_granular_payment (cobro de recepción):
--    a) El descuento escribía sales_order_items.total, que es columna generada: con descuento
--       la función fallaba siempre ("no se pudo procesar el pago"). Ahora solo se escribe
--       `discount` y el total se recalcula solo.
--    b) Al pagar, cancela los pagos PENDIENTE del concepto pagado, pero la equivalencia estaba
--       incompleta: RENEWAL se crea como RENOVACION, DAMAGE_CHARGE como CARGO_DANO y el consumo
--       a veces como CONSUMO. Esos pendientes quedaban huérfanos para siempre.
-- 2. process_full_checkout (dar salida): no contaba ni convertía los pagos COBRADO_POR_VALET;
--    se podía cerrar la estancia con dinero del cochero sin corroborar (así quedaron 18 pagos,
--    $7,095, entre mayo y septiembre). Ahora exige corroborarlos antes, igual que las
--    solicitudes de cobro del cochero pendientes de aprobar. Recepción decide, no se omite.
-- 3. notify_cochero_event: avisa también de renovaciones (el cochero las cobra en la
--    habitación) y no avisa de cargos que vienen de una solicitud del cochero ya aprobada.
-- ════════════════════════════════════════════════════════════════════════════
BEGIN;

-- ── 1. process_granular_payment ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.process_granular_payment(p_sales_order_id uuid, p_employee_id uuid, p_user_id uuid, p_item_ids uuid[], p_payments jsonb, p_tip_amount numeric, p_selected_total numeric, p_discounts jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_session_id UUID;
  v_valid_payments JSONB;
  v_payment_entry JSONB;
  v_payment_count INT;
  v_is_multipago BOOLEAN;
  v_order_total NUMERIC;
  v_order_paid NUMERIC;
  v_new_paid NUMERIC;
  v_new_remaining NUMERIC;
  v_stay_room_id UUID;
  v_room_status TEXT;
  v_now TIMESTAMPTZ := NOW();
  v_discount_key TEXT;
  v_discount_val NUMERIC;
  v_orig_payment_id UUID;
  v_item_exists INT;
BEGIN
  -- 1. VALIDATE ORDER EXISTENCE
  SELECT total, paid_amount INTO v_order_total, v_order_paid
  FROM public.sales_orders WHERE id = p_sales_order_id;

  IF v_order_total IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Orden de venta no encontrada');
  END IF;

  -- 2. VALIDATE CONCURRENCY: Ensure all requested items still exist in the database (not deleted)
  IF array_length(p_item_ids, 1) > 0 THEN
    SELECT COUNT(*) INTO v_item_exists
    FROM public.sales_order_items
    WHERE id = ANY(p_item_ids);

    IF v_item_exists < array_length(p_item_ids, 1) THEN
      RETURN jsonb_build_object('success', false, 'error', 'Uno o más conceptos seleccionados ya no existen o fueron eliminados.');
    END IF;
  END IF;

  -- 3. RESOLVE shift session
  SELECT ss.id INTO v_session_id
  FROM public.shift_sessions ss
  JOIN public.employees e ON e.id = ss.employee_id
  WHERE ss.employee_id = p_employee_id
    AND ss.status IN ('active', 'open')
    AND e.role IN ('receptionist', 'admin', 'manager')
  ORDER BY ss.clock_in_at DESC
  LIMIT 1;

  IF v_session_id IS NULL THEN
    SELECT ss.id INTO v_session_id
    FROM public.shift_sessions ss
    JOIN public.employees e ON e.id = ss.employee_id
    WHERE ss.status IN ('active', 'open')
      AND e.role IN ('receptionist', 'admin', 'manager')
    ORDER BY ss.clock_in_at DESC
    LIMIT 1;
  END IF;

  -- 4. APPLY DISCOUNTS on individual items and adjust totals
  --    sales_order_items.total es columna generada (qty * (unit_price - discount) + tax):
  --    basta con escribir discount.
  IF p_discounts IS NOT NULL AND p_discounts <> '{}'::jsonb THEN
    FOR v_discount_key IN SELECT jsonb_object_keys(p_discounts) LOOP
      v_discount_val := (p_discounts->>v_discount_key)::numeric;

      IF v_discount_val > 0 THEN
        UPDATE public.sales_order_items
        SET discount = COALESCE(discount, 0) + v_discount_val / GREATEST(COALESCE(qty, 1), 1)
        WHERE id = v_discount_key::uuid;

        UPDATE public.sales_orders
        SET subtotal = GREATEST(0, subtotal - v_discount_val),
            total = GREATEST(0, total - v_discount_val)
        WHERE id = p_sales_order_id;
      END IF;
    END LOOP;

    SELECT total, paid_amount INTO v_order_total, v_order_paid
    FROM public.sales_orders WHERE id = p_sales_order_id;
  END IF;

  -- 5. MARK ITEMS as paid
  IF array_length(p_item_ids, 1) > 0 THEN
    UPDATE public.sales_order_items
    SET is_paid = true, paid_at = v_now
    WHERE id = ANY(p_item_ids);
  END IF;

  -- 6. CANCEL placeholder PENDIENTE payments ONLY for the concepts being paid
  --    (con los nombres alternos con que se crean los pendientes de cada concepto)
  IF array_length(p_item_ids, 1) > 0 THEN
    UPDATE public.payments
    SET status = 'CANCELADO'
    WHERE sales_order_id = p_sales_order_id
      AND status = 'PENDIENTE'
      AND concept IN (
        SELECT DISTINCT c
        FROM public.sales_order_items soi
        CROSS JOIN LATERAL unnest(
          CASE soi.concept_type
            WHEN 'ROOM_BASE'         THEN ARRAY['ESTANCIA']
            WHEN 'EXTRA_PERSON'      THEN ARRAY['PERSONA_EXTRA']
            WHEN 'EXTRA_HOUR'        THEN ARRAY['HORA_EXTRA']
            WHEN 'TOLERANCE_EXPIRED' THEN ARRAY['TOLERANCIA_EXPIRADA']
            WHEN 'RENEWAL'           THEN ARRAY['RENEWAL', 'RENOVACION']
            WHEN 'DAMAGE_CHARGE'     THEN ARRAY['DAMAGE_CHARGE', 'CARGO_DANO']
            WHEN 'CONSUMPTION'       THEN ARRAY['CONSUMPTION', 'CONSUMO']
            ELSE ARRAY[soi.concept_type]
          END
        ) AS c
        WHERE soi.id = ANY(p_item_ids)
      );
  END IF;

  -- 7. FILTER valid payments (amount > 0)
  v_valid_payments := '[]'::jsonb;
  FOR v_payment_entry IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF (v_payment_entry->>'amount')::numeric > 0 THEN
      v_valid_payments := v_valid_payments || jsonb_build_array(v_payment_entry);
    END IF;
  END LOOP;

  v_payment_count := jsonb_array_length(v_valid_payments);
  v_is_multipago := v_payment_count > 1;

  -- 8. PROCESS AND RECONCILE PAYMENTS
  FOR i IN 0..(v_payment_count - 1) LOOP
    v_payment_entry := v_valid_payments->i;
    v_orig_payment_id := NULLIF(v_payment_entry->>'original_payment_id', '')::uuid;

    IF v_orig_payment_id IS NOT NULL THEN
      UPDATE public.payments SET
        amount = (v_payment_entry->>'amount')::numeric,
        payment_method = v_payment_entry->>'method',
        status = 'PAGADO',
        confirmed_at = v_now,
        confirmed_by = p_employee_id,
        shift_session_id = v_session_id,
        collected_at = v_now,
        terminal_code = NULLIF(v_payment_entry->>'terminal', ''),
        reference = COALESCE(NULLIF(v_payment_entry->>'reference', ''), id::text),
        card_last_4 = NULLIF(v_payment_entry->>'cardLast4', ''),
        card_type = NULLIF(v_payment_entry->>'cardType', ''),
        payment_type = CASE WHEN v_is_multipago THEN 'PARCIAL' ELSE 'COMPLETO' END
      WHERE id = v_orig_payment_id;
    ELSE
      INSERT INTO public.payments (
        sales_order_id, amount, payment_method, card_last_4, card_type,
        terminal_code, reference, concept, status, payment_type,
        created_by, shift_session_id, collected_at, collected_by
      ) VALUES (
        p_sales_order_id,
        (v_payment_entry->>'amount')::numeric,
        v_payment_entry->>'method',
        NULLIF(v_payment_entry->>'cardLast4', ''),
        NULLIF(v_payment_entry->>'cardType', ''),
        NULLIF(v_payment_entry->>'terminal', ''),
        COALESCE(NULLIF(v_payment_entry->>'reference', ''), 'PAGO-' || upper(to_hex(extract(epoch from v_now)::int))),
        'PAGO_POR_CONCEPTOS',
        'PAGADO',
        CASE WHEN v_is_multipago THEN 'PARCIAL' ELSE 'COMPLETO' END,
        p_user_id,
        v_session_id,
        v_now,
        NULLIF(v_payment_entry->>'collected_by', '')::uuid
      );
    END IF;
  END LOOP;

  -- 9. TIP
  IF p_tip_amount > 0 THEN
    INSERT INTO public.payments (
      sales_order_id, amount, payment_method, concept, status,
      created_by, shift_session_id, collected_at
    ) VALUES (
      p_sales_order_id,
      p_tip_amount,
      COALESCE(v_valid_payments->0->>'method', 'EFECTIVO'),
      'PROPINA',
      'PAGADO',
      p_user_id,
      v_session_id,
      v_now
    );
  END IF;

  -- 10. UPDATE order paid/remaining totals
  v_new_paid := COALESCE(v_order_paid, 0) + p_selected_total;
  v_new_remaining := GREATEST(0, COALESCE(v_order_total, 0) - v_new_paid);

  UPDATE public.sales_orders SET
    paid_amount = v_new_paid,
    remaining_amount = v_new_remaining,
    status = CASE WHEN v_new_remaining <= 0 THEN 'PAID' ELSE 'PARTIAL' END
  WHERE id = p_sales_order_id;

  -- 11. LEFTOVERS: If order is fully settled, mark any remaining valet payments as PAGADO
  IF v_new_remaining <= 0 THEN
    UPDATE public.payments SET
      status = 'PAGADO',
      confirmed_at = v_now,
      confirmed_by = p_employee_id,
      shift_session_id = v_session_id
    WHERE sales_order_id = p_sales_order_id
      AND status IN ('COBRADO_POR_VALET', 'CORROBORADO_RECEPCION');
  END IF;

  -- 12. SYNC payment items
  PERFORM sync_payment_items(p_sales_order_id, p_employee_id);

  -- 13. CLEANUP checkout_payment_data
  UPDATE public.room_stays
  SET checkout_payment_data = NULL
  WHERE sales_order_id = p_sales_order_id;

  -- 14. UNBLOCK room if BLOQUEADA
  SELECT room_id INTO v_stay_room_id
  FROM public.room_stays
  WHERE sales_order_id = p_sales_order_id
  LIMIT 1;

  IF v_stay_room_id IS NOT NULL THEN
    SELECT status INTO v_room_status
    FROM public.rooms WHERE id = v_stay_room_id;

    IF v_room_status = 'BLOQUEADA' THEN
      UPDATE public.rooms SET status = 'OCUPADA'
      WHERE id = v_stay_room_id;
    END IF;
  END IF;

  -- 15. AUDIT
  BEGIN
    PERFORM log_audit(
      'PAYMENT_PROCESSED'::text,
      'SALES_ORDER'::text,
      p_sales_order_id::text,
      'UPDATE'::text,
      NULL::jsonb,
      NULL::jsonb,
      format('Pago granular procesado: $%s en %s concepto(s)', p_selected_total, v_payment_count)::text,
      jsonb_build_object(
        'payment_count', v_payment_count,
        'total_amount', p_selected_total,
        'tip', p_tip_amount,
        'employee_id', p_employee_id,
        'session_id', v_session_id
      ),
      'INFO'::text
    );
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'payments_processed', v_payment_count,
    'new_paid_amount', v_new_paid,
    'new_remaining', v_new_remaining,
    'session_id', v_session_id,
    'room_unblocked', (v_room_status = 'BLOQUEADA')
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$function$;

-- ── 2. process_full_checkout: no cerrar con dinero del cochero sin corroborar ──
-- Se agrega una función de verificación y la salida la llama al inicio. El resto de
-- process_full_checkout no cambia.
CREATE OR REPLACE FUNCTION public.checkout_valet_blockers(p_sales_order_id uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $function$
    SELECT CASE
      WHEN EXISTS (
        SELECT 1 FROM valet_charge_requests r JOIN room_stays s ON s.id = r.room_stay_id
        WHERE s.sales_order_id = p_sales_order_id AND r.status = 'PENDIENTE')
      THEN 'Hay cobros reportados por el cochero sin aprobar o rechazar. Decide en el aviso de Habitaciones antes de dar salida.'
      WHEN EXISTS (
        SELECT 1 FROM payments
        WHERE sales_order_id = p_sales_order_id AND status IN ('COBRADO_POR_VALET', 'CORROBORADO_RECEPCION'))
      THEN format('Hay $%s cobrados por el cochero sin corroborar. Corrobóralos en Cobrar antes de dar salida.',
                  (SELECT sum(amount) FROM payments WHERE sales_order_id = p_sales_order_id AND status IN ('COBRADO_POR_VALET', 'CORROBORADO_RECEPCION')))
    END;
$function$;
REVOKE EXECUTE ON FUNCTION public.checkout_valet_blockers(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_valet_blockers(uuid) TO authenticated, service_role;

DO $$
DECLARE
    v_def text := pg_get_functiondef('public.process_full_checkout(uuid, uuid, jsonb, numeric)'::regprocedure);
    v_anchor text := '  -- 2. VALIDATE: No blocking deliveries';
BEGIN
    IF position('checkout_valet_blockers' in v_def) > 0 THEN
        RETURN; -- ya aplicado
    END IF;
    IF position(v_anchor in v_def) = 0 THEN
        RAISE EXCEPTION 'process_full_checkout cambió: no se encontró el punto de inserción';
    END IF;
    v_def := replace(v_def, v_anchor,
'  -- 1b. VALIDATE: dinero o cobros del cochero que recepción aún no corrobora/decide
  DECLARE v_valet_blocker TEXT := public.checkout_valet_blockers(p_sales_order_id);
  BEGIN
    IF v_valet_blocker IS NOT NULL THEN
      RETURN jsonb_build_object(''success'', false, ''error'', v_valet_blocker);
    END IF;
  END;

' || v_anchor);
    EXECUTE v_def;
END $$;

-- ── 3. notify_cochero_event: renovaciones sí; cargos de solicitudes aprobadas no ──
DO $$
DECLARE
    v_def text := pg_get_functiondef('public.notify_cochero_event()'::regprocedure);
BEGIN
    IF position('app.skip_valet_notify' in v_def) > 0 THEN
        RETURN;
    END IF;
    IF position('    ELSIF NEW.concept_type = ''PROMO_4H'' THEN' in v_def) = 0
       OR position('  -- Si no hay valets activos, no hacemos nada' in v_def) = 0 THEN
        RAISE EXCEPTION 'notify_cochero_event cambió: no se encontraron los puntos de edición';
    END IF;
    v_def := replace(v_def, '  -- Si no hay valets activos, no hacemos nada',
'  -- Cargos que vienen de una solicitud del cochero ya aprobada: él ya los cobró, no avisar
  IF coalesce(current_setting(''app.skip_valet_notify'', true), '''') = ''on'' THEN
    RETURN NEW;
  END IF;

  -- Si no hay valets activos, no hacemos nada');
    v_def := replace(v_def, '    ELSIF NEW.concept_type = ''PROMO_4H'' THEN',
'    ELSIF NEW.concept_type = ''RENEWAL'' THEN
      notification_type := ''NEW_EXTRA'';
      notification_title := ''🔄 Renovación'';
      notification_body := ''Habitación '' || room_num || '': se registró una renovación por cobrar.'';
      notification_data := jsonb_build_object(
        ''type'', ''NEW_EXTRA'',
        ''consumptionId'', NEW.id,
        ''salesOrderId'', NEW.sales_order_id,
        ''roomNumber'', room_num,
        ''stayId'', (SELECT id FROM room_stays WHERE sales_order_id = NEW.sales_order_id LIMIT 1)
      );

    ELSIF NEW.concept_type = ''PROMO_4H'' THEN');
    EXECUTE v_def;
END $$;

-- decide_valet_charge_request marca su transacción para que el aviso no salga
DO $$
DECLARE
    v_def text := pg_get_functiondef('public.decide_valet_charge_request(uuid, boolean, text)'::regprocedure);
    v_anchor text := '    v_ref := ''VALET-'' || v_req.charge_type || ''-'' || v_req.id;';
BEGIN
    IF position('app.skip_valet_notify' in v_def) > 0 THEN
        RETURN;
    END IF;
    IF position(v_anchor in v_def) = 0 THEN
        RAISE EXCEPTION 'decide_valet_charge_request cambió: no se encontró el punto de inserción';
    END IF;
    v_def := replace(v_def, v_anchor, '    PERFORM set_config(''app.skip_valet_notify'', ''on'', true);
' || v_anchor);
    EXECUTE v_def;
END $$;

COMMIT;
