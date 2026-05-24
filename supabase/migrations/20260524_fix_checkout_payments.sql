-- Migration: Redefine process_full_checkout and enforce_active_shift_on_payment
-- Target: public.process_full_checkout, public.enforce_active_shift_on_payment

-- Update 1: enforce_active_shift_on_payment
-- Automatically assigns employee_id (the receptionist shift owner) in addition to shift_session_id
CREATE OR REPLACE FUNCTION public.enforce_active_shift_on_payment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_shift_status TEXT;
  v_active_shift_id UUID;
  v_active_employee_id UUID;
BEGIN
  -- Skip enforcement for valet-collected payments (they use their own shift)
  -- Only enforce for PAGADO and PENDIENTE statuses (reception-side payments)
  IF NEW.status IN ('COBRADO_POR_VALET', 'CORROBORADO_RECEPCION') THEN
    RETURN NEW;
  END IF;

  -- 1. If a shift_session_id was provided, check if it's still active
  IF NEW.shift_session_id IS NOT NULL THEN
    SELECT status, employee_id INTO v_shift_status, v_active_employee_id
    FROM shift_sessions
    WHERE id = NEW.shift_session_id;
    
    -- If the shift is active/open, keep it and ensure employee_id is correct
    IF v_shift_status IN ('active', 'open') THEN
      NEW.employee_id := v_active_employee_id;
      RETURN NEW;
    END IF;
    -- Otherwise fall through to reassignment
  END IF;
  
  -- 2. Find the active reception shift
  SELECT ss.id, ss.employee_id INTO v_active_shift_id, v_active_employee_id
  FROM shift_sessions ss
  JOIN employees e ON ss.employee_id = e.id
  WHERE ss.status IN ('active', 'open')
    AND e.role IN ('receptionist', 'admin', 'manager')
  ORDER BY ss.clock_in_at DESC
  LIMIT 1;
  
  -- 3. Assign if found
  IF v_active_shift_id IS NOT NULL THEN
    NEW.shift_session_id := v_active_shift_id;
    NEW.employee_id := v_active_employee_id;
  END IF;
  
  RETURN NEW;
END;
$function$;


-- Update 2: process_full_checkout
-- 1. Removes the v_has_confirmed constraint to ensure checkout payments are always registered.
-- 2. Marks all unpaid, non-cancelled items (consumptions, extras, etc.) as paid at checkout.
CREATE OR REPLACE FUNCTION public.process_full_checkout(
  p_sales_order_id uuid,
  p_checkout_valet_id uuid DEFAULT NULL::uuid,
  p_payments jsonb DEFAULT '[]'::jsonb,
  p_total_paid numeric DEFAULT 0
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
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
  v_new_remaining NUMERIC;
  v_now TIMESTAMPTZ := NOW();
BEGIN
  -- ═══════════════════════════════════════════════════════════════════
  -- 1. VALIDATE: Stay must exist and be ACTIVA
  -- ═══════════════════════════════════════════════════════════════════
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

  -- Check tolerance expiration (1 hour = 3600 seconds)
  IF v_tolerance_started_at IS NOT NULL AND v_tolerance_type IS NOT NULL THEN
    IF EXTRACT(EPOCH FROM (v_now - v_tolerance_started_at)) > 3600 THEN
      RETURN jsonb_build_object('success', false, 'error', 'La tolerancia ha expirado. Se requiere cobrar hora extra.');
    END IF;
  END IF;

  -- Check vehicle checkout verified
  IF v_vehicle_plate IS NOT NULL AND v_checkout_valet_employee_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Salida de vehículo no verificada por el cochero.');
  END IF;

  -- ═══════════════════════════════════════════════════════════════════
  -- 2. VALIDATE: No blocking deliveries
  -- ═══════════════════════════════════════════════════════════════════
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

  -- ═══════════════════════════════════════════════════════════════════
  -- 3. RESOLVE: Shift session
  -- ═══════════════════════════════════════════════════════════════════
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

  -- ═══════════════════════════════════════════════════════════════════
  -- 4. MARK: All items as paid (Updated to mark all unpaid, non-cancelled items)
  -- ═══════════════════════════════════════════════════════════════════
  -- Build valid payments and determine method
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

  -- ═══════════════════════════════════════════════════════════════════
  -- 5. RECONCILE: Pending payments (same logic as buildCheckoutPayments)
  -- ═══════════════════════════════════════════════════════════════════
  v_remaining_to_pay := p_total_paid;

  -- Update existing PENDIENTE payments
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
      -- Mark parent as PAGADO, create sub-payments proportionally
      UPDATE public.payments
      SET status = 'PAGADO', payment_method = 'PENDIENTE'
      WHERE id = v_pending_rec.id;

      DECLARE
        v_proportion NUMERIC := LEAST(v_pending_rec.amount, v_remaining_to_pay) / p_total_paid;
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
      -- Single payment: update the pending record directly
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

  -- ═══════════════════════════════════════════════════════════════════
  -- 6. NEW PAYMENTS: Insert checkout payments if no pending ones consumed everything
  -- ═══════════════════════════════════════════════════════════════════
  IF v_remaining_to_pay > 0 AND v_payment_count > 0 THEN
    -- Redefined: remove v_has_confirmed restriction entirely so we always insert the CHECKOUT payments
    IF v_is_multipago THEN
      DECLARE
        v_proportion NUMERIC := v_remaining_to_pay / p_total_paid;
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

  -- ═══════════════════════════════════════════════════════════════════
  -- 7. FINALIZE: Update stay, order, room
  -- ═══════════════════════════════════════════════════════════════════
  UPDATE public.room_stays SET
    status = 'FINALIZADA',
    actual_check_out_at = v_now,
    checkout_valet_employee_id = COALESCE(p_checkout_valet_id, checkout_valet_employee_id),
    checkout_shift_session_id = v_session_id
  WHERE id = v_stay_id;

  -- Update order totals
  SELECT total, remaining_amount INTO v_order_total, v_order_remaining
  FROM public.sales_orders WHERE id = p_sales_order_id;

  v_new_remaining := GREATEST(0, COALESCE(v_order_remaining, 0) - p_total_paid);

  UPDATE public.sales_orders SET
    status = 'ENDED',
    paid_amount = COALESCE(paid_amount, 0) + p_total_paid,
    remaining_amount = v_new_remaining
  WHERE id = p_sales_order_id;

  -- Update room status
  UPDATE public.rooms SET
    status = CASE
      WHEN v_tolerance_started_at IS NOT NULL THEN 'OCUPADA'
      ELSE 'SUCIA'
    END
  WHERE id = v_room_id;

  -- ═══════════════════════════════════════════════════════════════════
  -- 8. AUDIT
  -- ═══════════════════════════════════════════════════════════════════
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
        'remaining', v_new_remaining,
        'payment_method', v_payment_method,
        'checkout_valet_id', p_checkout_valet_id
      ),
      'INFO'::text
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  -- RETURN
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
$function$;
