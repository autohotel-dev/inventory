-- Migration: Fix 3 bugs in POS RPCs
-- 
-- BUG 2: process_full_checkout double-counted paid_amount
--   - Now calculates ACTUAL remaining from real PAGADO payments
--   - Sets paid_amount = total at checkout (fully settled)
--   - 272 historical overpaid orders corrected
--
-- BUG 3: cancel_stay (legacy) didn't set is_cancelled on items
--   - Added is_cancelled, cancelled_at, cancellation_reason
--
-- BUG 4: cancel_reception_item_v1 did hard-delete (lost audit trail)
--   - Changed to soft-delete with is_cancelled, cancelled_at, cancelled_by

-- ═══════════════════════════════════════════════════════════════════
-- BUG 2 FIX: process_full_checkout
-- ═══════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.process_full_checkout(
  p_sales_order_id UUID,
  p_checkout_valet_id UUID DEFAULT NULL,
  p_payments JSONB DEFAULT '[]'::jsonb,
  p_total_paid NUMERIC DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_stay_id UUID;
  v_stay_status TEXT;
  v_room_id UUID;
  v_tolerance_started_at TIMESTAMPTZ;
  v_tolerance_type TEXT;
  v_vehicle_plate TEXT;
  v_checkout_valet_employee_id UUID;
  v_blocking_count INT;
  v_session_id UUID;
  v_employee_id UUID;
  v_payment_method TEXT;
  v_valid_payments JSONB;
  v_payment_count INT;
  v_is_multipago BOOLEAN;
  v_payment_entry JSONB;
  v_pending_rec RECORD;
  v_remaining_to_pay NUMERIC;
  v_order_total NUMERIC;
  v_order_remaining NUMERIC;
  v_order_paid NUMERIC;
  v_new_remaining NUMERIC;
  v_actual_already_paid NUMERIC;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- 1. VALIDATE: Stay must exist and be ACTIVA
  SELECT id, status, room_id, tolerance_started_at, tolerance_type,
         vehicle_plate, checkout_valet_employee_id
  INTO v_stay_id, v_stay_status, v_room_id, v_tolerance_started_at,
       v_tolerance_type, v_vehicle_plate, v_checkout_valet_employee_id
  FROM public.room_stays
  WHERE sales_order_id = p_sales_order_id
    AND status = 'ACTIVA'
  FOR UPDATE;

  IF v_stay_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No se encontró la estancia activa o ya fue finalizada.');
  END IF;

  -- Check vehicle checkout verified
  IF v_vehicle_plate IS NOT NULL AND v_checkout_valet_employee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Salida de vehículo no verificada por el cochero.');
  END IF;

  -- 2. VALIDATE: No blocking deliveries
  SELECT COUNT(*) INTO v_blocking_count
  FROM public.sales_order_items
  WHERE sales_order_id = p_sales_order_id
    AND concept_type = 'CONSUMPTION'
    AND COALESCE(is_cancelled, false) = false
    AND delivery_status IS NOT NULL
    AND delivery_status NOT IN ('DELIVERED', 'COMPLETED', 'CANCELLED');

  IF v_blocking_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error',
      format('No se puede finalizar. Hay %s producto(s) sin entregar.', v_blocking_count));
  END IF;

  -- 3. RESOLVE: Shift session
  SELECT e.id INTO v_employee_id
  FROM public.employees e
  WHERE e.auth_user_id = auth.uid();

  SELECT ss.id INTO v_session_id
  FROM public.shift_sessions ss
  JOIN public.employees e ON e.id = ss.employee_id
  WHERE ss.employee_id = v_employee_id
    AND ss.status IN ('active', 'open')
    AND e.role IN ('receptionist', 'admin', 'manager')
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

  -- 4. MARK: All items as paid
  v_valid_payments := '[]'::jsonb;
  FOR v_payment_entry IN SELECT * FROM jsonb_array_elements(p_payments)
  LOOP
    IF (v_payment_entry->>'amount')::numeric > 0 THEN
      v_valid_payments := v_valid_payments || jsonb_build_array(v_payment_entry);
    END IF;
  END LOOP;

  v_payment_count := jsonb_array_length(v_valid_payments);
  v_is_multipago := v_payment_count > 1;

  IF v_is_multipago THEN
    v_payment_method := 'MULTIPAGO';
  ELSIF v_payment_count = 1 THEN
    v_payment_method := v_valid_payments->0->>'method';
  ELSE
    v_payment_method := 'EFECTIVO';
  END IF;

  UPDATE public.sales_order_items
  SET is_paid = true, paid_at = v_now, payment_method = v_payment_method
  WHERE sales_order_id = p_sales_order_id
    AND is_paid = false
    AND COALESCE(is_cancelled, false) = false;

  -- =====================================================================
  -- FIX: Calculate ACTUAL remaining based on real PAGADO payments,
  -- not blindly trusting p_total_paid which may double-count
  -- =====================================================================
  SELECT total, paid_amount INTO v_order_total, v_order_paid
  FROM public.sales_orders WHERE id = p_sales_order_id;

  SELECT COALESCE(SUM(amount), 0) INTO v_actual_already_paid
  FROM public.payments
  WHERE sales_order_id = p_sales_order_id
    AND status = 'PAGADO'
    AND UPPER(COALESCE(concept, '')) NOT IN ('CHECKOUT', 'PROPINA');

  v_remaining_to_pay := GREATEST(0, COALESCE(v_order_total, 0) - v_actual_already_paid);

  -- 5. RECONCILE: Pending payments
  FOR v_pending_rec IN
    SELECT id, amount, concept
    FROM public.payments
    WHERE sales_order_id = p_sales_order_id
      AND status = 'PENDIENTE'
      AND parent_payment_id IS NULL
    ORDER BY created_at ASC
  LOOP
    EXIT WHEN v_remaining_to_pay <= 0;

    IF v_is_multipago THEN
      UPDATE public.payments
      SET status = 'PAGADO', payment_method = 'PENDIENTE'
      WHERE id = v_pending_rec.id;

      DECLARE
        v_proportion NUMERIC := LEAST(v_pending_rec.amount, v_remaining_to_pay) / GREATEST(p_total_paid, 1);
        v_sub JSONB;
      BEGIN
        FOR v_sub IN SELECT * FROM jsonb_array_elements(v_valid_payments)
        LOOP
          INSERT INTO public.payments (
            sales_order_id, amount, payment_method, reference, concept,
            status, payment_type, parent_payment_id, shift_session_id,
            collected_by, terminal_code, card_last_4, card_type
          ) VALUES (
            p_sales_order_id,
            ROUND(((v_sub->>'amount')::numeric * v_proportion)::numeric, 2),
            v_sub->>'method',
            COALESCE(NULLIF(v_sub->>'reference', ''), 'SUB-' || upper(to_hex(extract(epoch from v_now)::int))),
            v_pending_rec.concept,
            'PAGADO', 'PARCIAL', v_pending_rec.id, v_session_id,
            v_employee_id,
            NULLIF(v_sub->>'terminal', ''),
            NULLIF(v_sub->>'cardLast4', ''),
            NULLIF(v_sub->>'cardType', '')
          );
        END LOOP;
      END;
    ELSE
      UPDATE public.payments SET
        status = 'PAGADO',
        payment_method = COALESCE(v_valid_payments->0->>'method', 'EFECTIVO'),
        reference = COALESCE(NULLIF(v_valid_payments->0->>'reference', ''), reference),
        shift_session_id = v_session_id,
        collected_by = v_employee_id,
        terminal_code = NULLIF(v_valid_payments->0->>'terminal', ''),
        card_last_4 = NULLIF(v_valid_payments->0->>'cardLast4', ''),
        card_type = NULLIF(v_valid_payments->0->>'cardType', '')
      WHERE id = v_pending_rec.id;
    END IF;

    v_remaining_to_pay := v_remaining_to_pay - v_pending_rec.amount;
  END LOOP;

  -- 6. NEW PAYMENTS: Only if there's ACTUAL remaining to pay
  IF v_remaining_to_pay > 0 AND v_payment_count > 0 THEN
    IF v_is_multipago THEN
      DECLARE
        v_proportion NUMERIC := v_remaining_to_pay / GREATEST(p_total_paid, 1);
      BEGIN
        FOR v_payment_entry IN SELECT * FROM jsonb_array_elements(v_valid_payments)
        LOOP
          INSERT INTO public.payments (
            sales_order_id, amount, payment_method, reference, concept,
            status, payment_type, shift_session_id, collected_by,
            terminal_code, card_last_4, card_type
          ) VALUES (
            p_sales_order_id,
            ROUND(((v_payment_entry->>'amount')::numeric * v_proportion)::numeric, 2),
            v_payment_entry->>'method',
            COALESCE(NULLIF(v_payment_entry->>'reference', ''), 'CHK-' || upper(to_hex(extract(epoch from v_now)::int))),
            'CHECKOUT', 'PAGADO', 'PARCIAL', v_session_id, v_employee_id,
            NULLIF(v_payment_entry->>'terminal', ''),
            NULLIF(v_payment_entry->>'cardLast4', ''),
            NULLIF(v_payment_entry->>'cardType', '')
          );
        END LOOP;
      END;
    ELSE
      INSERT INTO public.payments (
        sales_order_id, amount, payment_method, reference, concept,
        status, payment_type, shift_session_id, collected_by,
        terminal_code, card_last_4, card_type
      ) VALUES (
        p_sales_order_id,
        v_remaining_to_pay,
        COALESCE(v_valid_payments->0->>'method', 'EFECTIVO'),
        COALESCE(NULLIF(v_valid_payments->0->>'reference', ''), 'CHK-' || upper(to_hex(extract(epoch from v_now)::int))),
        'CHECKOUT', 'PAGADO', 'COMPLETO', v_session_id, v_employee_id,
        NULLIF(v_valid_payments->0->>'terminal', ''),
        NULLIF(v_valid_payments->0->>'cardLast4', ''),
        NULLIF(v_valid_payments->0->>'cardType', '')
      );
    END IF;
  END IF;

  -- 7. FINALIZE: Update stay, order, room
  UPDATE public.room_stays SET
    status = 'FINALIZADA',
    actual_check_out_at = v_now,
    checkout_valet_employee_id = COALESCE(p_checkout_valet_id, checkout_valet_employee_id),
    checkout_shift_session_id = v_session_id,
    tolerance_started_at = NULL,
    tolerance_type = NULL
  WHERE id = v_stay_id;

  -- FIX: Set paid_amount = total at checkout (order is fully settled)
  v_new_remaining := GREATEST(0, v_remaining_to_pay);

  UPDATE public.sales_orders SET
    status = 'ENDED',
    paid_amount = COALESCE(v_order_total, 0),
    remaining_amount = 0
  WHERE id = p_sales_order_id;

  UPDATE public.rooms SET
    status = 'SUCIA'
  WHERE id = v_room_id;

  -- 8. AUDIT
  BEGIN
    PERFORM log_audit(
      'CHECKOUT_COMPLETED'::text,
      'ROOM_STAY'::text,
      v_stay_id::text,
      'UPDATE'::text,
      NULL::jsonb, NULL::jsonb,
      format('Checkout completado: $%s cobrados. Restante: $%s', p_total_paid, v_new_remaining)::text,
      jsonb_build_object(
        'sales_order_id', p_sales_order_id,
        'total_paid', p_total_paid,
        'actual_remaining_at_checkout', v_remaining_to_pay,
        'remaining', v_new_remaining,
        'payment_method', v_payment_method,
        'checkout_valet_id', p_checkout_valet_id
      ),
      'INFO'::text
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object(
    'success', true,
    'stay_id', v_stay_id,
    'room_id', v_room_id,
    'new_remaining', v_new_remaining,
    'payment_method', v_payment_method
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM,
    'detail', SQLSTATE
  );
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- BUG 3 FIX: cancel_stay (legacy)
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.cancel_stay(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.cancel_stay(
  p_room_id UUID,
  p_sales_order_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_number TEXT;
BEGIN
  SELECT number INTO v_room_number FROM rooms WHERE id = p_room_id;

  UPDATE room_stays
  SET status = 'CANCELADA', actual_check_out_at = NOW()
  WHERE room_id = p_room_id AND status = 'ACTIVA';

  UPDATE sales_orders
  SET status = 'CANCELLED', notes = COALESCE(notes, '') || ' | CANCELADA: ' || p_reason
  WHERE id = p_sales_order_id;

  UPDATE payments
  SET status = 'CANCELADO'
  WHERE sales_order_id = p_sales_order_id AND status IN ('PENDIENTE', 'COBRADO_POR_VALET');

  -- FIX: Mark unpaid items as cancelled (was missing - caused phantom items)
  UPDATE sales_order_items
  SET is_cancelled = true,
      cancelled_at = NOW(),
      cancellation_reason = 'Cancelación de estancia (legacy): ' || COALESCE(p_reason, ''),
      delivery_status = 'CANCELLED'
  WHERE sales_order_id = p_sales_order_id
    AND is_paid = false;

  UPDATE rooms SET status = 'LIBRE', notes = NULL WHERE id = p_room_id;

  BEGIN
    PERFORM log_audit(
      'STAY_CANCELLED'::text, 'ROOM'::text, p_room_id::text, 'UPDATE'::text,
      NULL::jsonb, NULL::jsonb,
      format('Hab. %s cancelada: %s', v_room_number, p_reason)::text,
      jsonb_build_object('room_number', v_room_number, 'sales_order_id', p_sales_order_id, 'reason', p_reason),
      'WARNING'::text
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN jsonb_build_object('success', true, 'room_number', v_room_number);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- BUG 4 FIX: cancel_reception_item_v1 (hard-delete → soft-delete)
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.cancel_reception_item_v1(uuid, uuid);

CREATE OR REPLACE FUNCTION public.cancel_reception_item_v1(
  p_item_id UUID,
  p_employee_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_item record;
    v_stay record;
    v_room_type record;
    v_hours_to_deduct numeric := 0;
    v_people_to_deduct integer := 0;
    v_payment record;
    v_payment_deleted boolean := false;
    v_item_total numeric;
BEGIN
    -- 1. Get item
    SELECT * INTO v_item FROM public.sales_order_items WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Item no encontrado');
    END IF;

    IF v_item.is_paid = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'No se puede cancelar un item ya pagado');
    END IF;

    IF v_item.is_cancelled = true THEN
        RETURN jsonb_build_object('success', false, 'error', 'Este item ya fue cancelado');
    END IF;

    v_item_total := v_item.qty * v_item.unit_price;

    -- 2. Get active stay
    SELECT rs.*, r.room_type_id INTO v_stay 
    FROM public.room_stays rs
    JOIN public.rooms r ON r.id = rs.room_id
    WHERE rs.sales_order_id = v_item.sales_order_id AND rs.status = 'ACTIVA'
    FOR UPDATE;

    -- 3. Adjust time/people based on concept
    IF FOUND THEN
        SELECT * INTO v_room_type FROM public.room_types WHERE id = v_stay.room_type_id;

        IF v_item.concept_type = 'PROMO_4H' THEN
            v_hours_to_deduct := 4;
        ELSIF v_item.concept_type = 'EXTRA_HOUR' THEN
            v_hours_to_deduct := v_item.qty;
        ELSIF v_item.concept_type = 'EXTRA_PERSON' THEN
            v_people_to_deduct := v_item.qty;
        ELSIF v_item.concept_type = 'RENEWAL' THEN
            v_hours_to_deduct := COALESCE(v_room_type.weekday_hours, 4);
        END IF;

        IF v_hours_to_deduct > 0 THEN
            UPDATE public.room_stays 
            SET expected_check_out_at = expected_check_out_at - (v_hours_to_deduct || ' hours')::interval
            WHERE id = v_stay.id;
        END IF;

        IF v_people_to_deduct > 0 THEN
            UPDATE public.room_stays
            SET current_people = GREATEST(1, current_people - v_people_to_deduct),
                total_people = GREATEST(1, total_people - v_people_to_deduct)
            WHERE id = v_stay.id;
        END IF;
    END IF;

    -- 4. Delete the corresponding PENDIENTE payment (if it exists)
    SELECT * INTO v_payment 
    FROM public.payments 
    WHERE sales_order_id = v_item.sales_order_id 
      AND status = 'PENDIENTE' 
      AND concept = CASE WHEN v_item.concept_type = 'EXTRA_PERSON' THEN 'PERSONA_EXTRA' 
                         WHEN v_item.concept_type = 'DAMAGE' THEN 'DAMAGE_CHARGE'
                         ELSE v_item.concept_type END
    LIMIT 1 FOR UPDATE;

    IF FOUND THEN
        IF v_payment.amount <= v_item_total THEN
            DELETE FROM public.payments WHERE id = v_payment.id;
            v_payment_deleted := true;
        ELSE
            UPDATE public.payments SET amount = amount - v_item_total WHERE id = v_payment.id;
        END IF;
    END IF;

    -- 5. Update sales orders totals
    UPDATE public.sales_orders
    SET subtotal = GREATEST(0, subtotal - v_item_total),
        total = GREATEST(0, total - v_item_total),
        remaining_amount = GREATEST(0, remaining_amount - v_item_total)
    WHERE id = v_item.sales_order_id;

    -- 6. FIX: Soft-delete instead of hard-delete (preserves audit trail)
    UPDATE public.sales_order_items
    SET is_cancelled = true,
        cancelled_at = NOW(),
        cancelled_by = p_employee_id,
        cancellation_reason = 'Cancelado desde modal de pagos granulares',
        delivery_status = 'CANCELLED'
    WHERE id = p_item_id;

    RETURN jsonb_build_object(
        'success', true, 
        'hours_deducted', v_hours_to_deduct, 
        'payment_deleted', v_payment_deleted,
        'item_deleted', true,
        'people_deducted', v_people_to_deduct,
        'stay_id', v_stay.id
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- HISTORICAL DATA FIX: Correct overpaid orders
-- ═══════════════════════════════════════════════════════════════════
-- Already applied via direct UPDATE:
-- UPDATE sales_orders SET paid_amount = total, remaining_amount = 0
-- WHERE paid_amount > total AND status NOT IN ('CANCELLED');
