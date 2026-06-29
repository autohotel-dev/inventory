-- Migration: Fix process_granular_payment partial payment bug
--
-- BUG: Step 6 cancelled ALL PENDIENTE payments for the order, even when
-- only a subset of items was being paid (partial payment). This destroyed
-- placeholder payments for items NOT yet paid (e.g., PERSONA_EXTRA, HORA_EXTRA).
--
-- FIX: Only cancel PENDIENTE payments whose concept matches the concept_types
-- of the items being paid (p_item_ids).

CREATE OR REPLACE FUNCTION public.process_granular_payment(
  p_sales_order_id UUID,
  p_employee_id UUID,
  p_user_id UUID,
  p_item_ids UUID[],
  p_payments JSONB,
  p_tip_amount NUMERIC,
  p_selected_total NUMERIC,
  p_discounts JSONB DEFAULT '{}'::jsonb
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
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
  IF p_discounts IS NOT NULL AND p_discounts <> '{}'::jsonb THEN
    FOR v_discount_key IN SELECT jsonb_object_keys(p_discounts) LOOP
      v_discount_val := (p_discounts->>v_discount_key)::numeric;
      
      IF v_discount_val > 0 THEN
        -- Update item discount and recalculate item total
        UPDATE public.sales_order_items
        SET discount = COALESCE(discount, 0) + v_discount_val,
            total = GREATEST(0, (unit_price * qty) - (COALESCE(discount, 0) + v_discount_val))
        WHERE id = v_discount_key::uuid;

        -- Update order totals to subtract the discount
        UPDATE public.sales_orders
        SET subtotal = GREATEST(0, subtotal - v_discount_val),
            total = GREATEST(0, total - v_discount_val),
            remaining_amount = GREATEST(0, remaining_amount - v_discount_val)
        WHERE id = p_sales_order_id;
      END IF;
    END LOOP;

    -- Refresh order total and remaining variables after discount adjustments
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
  --    FIX: Previously cancelled ALL PENDIENTE payments, breaking partial payments.
  --    Now uses a concept mapping to only cancel payments related to selected items.
  IF array_length(p_item_ids, 1) > 0 THEN
    UPDATE public.payments
    SET status = 'CANCELADO'
    WHERE sales_order_id = p_sales_order_id
      AND status = 'PENDIENTE'
      AND concept IN (
        SELECT DISTINCT
          CASE soi.concept_type
            WHEN 'ROOM_BASE' THEN 'ESTANCIA'
            WHEN 'EXTRA_PERSON' THEN 'PERSONA_EXTRA'
            WHEN 'EXTRA_HOUR' THEN 'HORA_EXTRA'
            WHEN 'TOLERANCE_EXPIRED' THEN 'TOLERANCIA_EXPIRADA'
            ELSE soi.concept_type
          END
        FROM public.sales_order_items soi
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

    -- If original_payment_id is provided, update that exact payment (smart reconciliation)
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
      -- Otherwise, insert a new payment (direct lobby/reception payment)
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
    -- Audit failure must never block the payment
    NULL;
  END;

  -- RETURN
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
$$;
