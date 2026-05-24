-- Migration: Fix refund calculations and record stay cancellation refunds in payments
-- Target: public.calculate_shift_totals, public.get_shift_closing_summary, public.process_cancel_stay

-- Update 1: calculate_shift_totals
-- Reorders CASE conditions to process concept = 'REFUND' before status = 'CANCELADO'
CREATE OR REPLACE FUNCTION public.calculate_shift_totals(
  p_employee_id uuid,
  p_period_start timestamp with time zone,
  p_period_end timestamp with time zone
)
 RETURNS TABLE(total_cash numeric, total_card_bbva numeric, total_card_getnet numeric, total_sales numeric, total_transactions integer)
 LANGUAGE plpgsql
 AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(CASE 
      WHEN p.concept = 'REFUND' AND p.payment_method = 'EFECTIVO' THEN -p.amount
      WHEN p.status = 'PENDIENTE' OR p.status = 'CANCELADO' THEN 0
      WHEN p.payment_method = 'EFECTIVO' THEN p.amount 
      ELSE 0 
    END), 0)::DECIMAL(12,2) AS total_cash,
    COALESCE(SUM(CASE 
      WHEN p.concept = 'REFUND' AND p.payment_method = 'TARJETA' AND pt.code = 'BBVA' THEN -p.amount
      WHEN p.status = 'PENDIENTE' OR p.status = 'CANCELADO' THEN 0
      WHEN p.payment_method = 'TARJETA' AND pt.code = 'BBVA' THEN p.amount 
      ELSE 0 
    END), 0)::DECIMAL(12,2) AS total_card_bbva,
    COALESCE(SUM(CASE 
      WHEN p.concept = 'REFUND' AND p.payment_method = 'TARJETA' AND pt.code = 'GETNET' THEN -p.amount
      WHEN p.status = 'PENDIENTE' OR p.status = 'CANCELADO' THEN 0
      WHEN p.payment_method = 'TARJETA' AND pt.code = 'GETNET' THEN p.amount 
      ELSE 0 
    END), 0)::DECIMAL(12,2) AS total_card_getnet,
    COALESCE(SUM(CASE 
      WHEN p.concept = 'REFUND' THEN -p.amount
      WHEN p.status = 'PENDIENTE' OR p.status = 'CANCELADO' THEN 0
      ELSE p.amount 
    END), 0)::DECIMAL(12,2) AS total_sales,
    COUNT(p.id) FILTER (WHERE p.status NOT IN ('PENDIENTE', 'CANCELADO'))::INTEGER AS total_transactions
  FROM payments p
  LEFT JOIN payment_terminals pt ON pt.code = p.terminal_code
  LEFT JOIN public.sales_orders so ON so.id = p.sales_order_id
  LEFT JOIN public.room_stays rs ON rs.sales_order_id = so.id
  LEFT JOIN public.rooms rm ON rm.id = rs.room_id
  WHERE p.employee_id = p_employee_id
    AND p.created_at >= p_period_start
    AND p.created_at < p_period_end
    AND (rm.number IS NULL OR rm.number NOT IN ('13', '113'));
END;
$$;


-- Update 2: get_shift_closing_summary
-- Reorders CASE conditions in CTE payment_totals to process concept = 'REFUND' first
CREATE OR REPLACE FUNCTION public.get_shift_closing_summary(p_session_id uuid, p_employee_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_clock_in TIMESTAMPTZ;
  v_clock_out TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- 1. Get session period
  SELECT clock_in_at, COALESCE(clock_out_at, now())
  INTO v_clock_in, v_clock_out
  FROM public.shift_sessions
  WHERE id = p_session_id;

  IF v_clock_in IS NULL THEN
    RETURN jsonb_build_object('error', 'Session not found');
  END IF;

  -- 2. Build complete summary in one shot
  WITH
  -- 2a. Get all payments for this shift — STRICT: only by session ID (excluding room 13/113)
  shift_payments AS (
    SELECT
      p.id,
      p.created_at,
      p.amount,
      p.payment_method,
      p.terminal_code,
      p.sales_order_id,
      p.reference,
      p.concept,
      p.status AS payment_status,
      p.collected_by,
      p.card_last_4,
      p.card_type,
      pt.code AS terminal_name,
      pt.name AS terminal_display_name,
      so.id AS order_id,
      so.total AS order_total,
      so.status AS order_status
    FROM public.payments p
    LEFT JOIN public.payment_terminals pt ON pt.code = p.terminal_code
    LEFT JOIN public.sales_orders so ON so.id = p.sales_order_id
    LEFT JOIN public.room_stays rs ON rs.sales_order_id = so.id
    LEFT JOIN public.rooms rm ON rm.id = rs.room_id
    WHERE
      p.shift_session_id = p_session_id
      AND (rm.number IS NULL OR rm.number NOT IN ('13', '113'))
  ),

  -- 2b. Calculate totals by payment method (exclude PENDIENTE, CANCELLED, negative amounts, handle refunds)
  payment_totals AS (
    SELECT
      COALESCE(SUM(CASE
        WHEN concept = 'REFUND' AND payment_method = 'EFECTIVO' THEN -amount
        WHEN payment_method = 'PENDIENTE' OR payment_method = 'MIXTO' 
          OR payment_status = 'PENDIENTE'
          OR payment_status = 'CANCELADO'
          OR amount < 0
          OR COALESCE(order_status, 'ENDED') = 'CANCELLED' THEN 0
        WHEN payment_method = 'EFECTIVO' THEN amount
        ELSE 0
      END), 0) AS total_cash,
      COALESCE(SUM(CASE
        WHEN concept = 'REFUND' AND (
             payment_method = 'TARJETA_BBVA' 
             OR (payment_method = 'TARJETA' AND (terminal_code = 'BBVA' OR terminal_name = 'BBVA'))
             OR (payment_method = 'TARJETA' AND terminal_code IS NULL AND terminal_name IS NULL)
        ) THEN -amount
        WHEN payment_method = 'PENDIENTE' OR payment_method = 'MIXTO' 
          OR payment_status = 'PENDIENTE'
          OR payment_status = 'CANCELADO'
          OR amount < 0
          OR COALESCE(order_status, 'ENDED') = 'CANCELLED' THEN 0
        WHEN payment_method = 'TARJETA_BBVA' THEN amount
        WHEN payment_method = 'TARJETA' AND (terminal_code = 'BBVA' OR terminal_name = 'BBVA') THEN amount
        WHEN payment_method = 'TARJETA' AND terminal_code IS NULL AND terminal_name IS NULL THEN amount
        ELSE 0
      END), 0) AS total_card_bbva,
      COALESCE(SUM(CASE
        WHEN concept = 'REFUND' AND (
             payment_method = 'TARJETA_GETNET' 
             OR (payment_method = 'TARJETA' AND (terminal_code = 'GETNET' OR terminal_name = 'GETNET'))
        ) THEN -amount
        WHEN payment_method = 'PENDIENTE' OR payment_method = 'MIXTO' 
          OR payment_status = 'PENDIENTE'
          OR payment_status = 'CANCELADO'
          OR amount < 0
          OR COALESCE(order_status, 'ENDED') = 'CANCELLED' THEN 0
        WHEN payment_method = 'TARJETA_GETNET' THEN amount
        WHEN payment_method = 'TARJETA' AND (terminal_code = 'GETNET' OR terminal_name = 'GETNET') THEN amount
        ELSE 0
      END), 0) AS total_card_getnet,
      COUNT(*) FILTER (
        WHERE payment_method <> 'PENDIENTE' 
          AND COALESCE(payment_status, '') NOT IN ('PENDIENTE', 'CANCELADO')
          AND COALESCE(order_status, 'ENDED') <> 'CANCELLED'
      ) AS total_transactions
    FROM shift_payments
  ),

  -- 2c. Unassigned card payments
  unassigned_cards AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', sp.id, 'amount', sp.amount, 'payment_method', sp.payment_method,
      'terminal_code', sp.terminal_code, 'created_at', sp.created_at,
      'reference', sp.reference, 'concept', sp.concept
    )), '[]'::jsonb) AS items
    FROM shift_payments sp
    WHERE sp.payment_method = 'TARJETA'
      AND sp.terminal_code IS NULL AND sp.terminal_name IS NULL
      AND sp.collected_by IS NULL
      AND sp.payment_status <> 'PENDIENTE' AND sp.payment_status <> 'CANCELADO' AND sp.amount >= 0
  ),

  -- 2d. Unhandled payment methods
  unhandled_methods AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'payment', jsonb_build_object('id', sp.id, 'amount', sp.amount, 'payment_method', sp.payment_method),
      'method', sp.payment_method
    )), '[]'::jsonb) AS items
    FROM shift_payments sp
    WHERE sp.payment_method NOT IN ('EFECTIVO', 'TARJETA', 'TARJETA_BBVA', 'TARJETA_GETNET', 'PENDIENTE', 'MIXTO')
      AND sp.payment_status <> 'PENDIENTE' AND sp.payment_status <> 'CANCELADO' AND sp.amount >= 0
  ),

  -- 2e. Enriched payments with items
  enriched AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', sp.id, 'created_at', sp.created_at, 'amount', sp.amount,
        'payment_method', sp.payment_method, 'terminal_code', sp.terminal_code,
        'sales_order_id', sp.sales_order_id, 'reference', sp.reference,
        'concept', sp.concept, 'status', sp.payment_status,
        'collected_by', sp.collected_by, 'card_last_4', sp.card_last_4,
        'card_type', sp.card_type,
        'payment_terminals', CASE WHEN sp.terminal_name IS NOT NULL THEN
          jsonb_build_object('code', sp.terminal_name, 'name', sp.terminal_display_name) ELSE NULL END,
        'sales_orders', CASE WHEN sp.order_id IS NOT NULL THEN
          jsonb_build_object('id', sp.order_id, 'total', sp.order_total, 'status', sp.order_status) ELSE NULL END,
        'itemsDescription', (
          SELECT string_agg(
            CASE WHEN sub_i.qty > 1 THEN sub_i.qty || 'x ' ELSE '' END ||
            COALESCE(sub_p.name,
              CASE sub_i.concept_type
                WHEN 'ROOM_BASE' THEN 'Habitación' WHEN 'EXTRA_HOUR' THEN 'Hora Extra'
                WHEN 'EXTRA_PERSON' THEN 'Persona Extra' WHEN 'RENEWAL' THEN 'Renovación'
                WHEN 'PROMO_4H' THEN 'Promo 4H' WHEN 'CONSUMPTION' THEN 'Consumo'
                WHEN 'PRODUCT' THEN 'Producto'
                WHEN 'DAMAGE_CHARGE' THEN 'Cargo por Daños'
                WHEN 'ROOM_CHANGE_ADJUSTMENT' THEN 'Cambio de Habitación'
                ELSE 'Item' END
            ), ', ')
          FROM public.sales_order_items sub_i
          LEFT JOIN public.products sub_p ON sub_p.id = sub_i.product_id
          WHERE sub_i.sales_order_id = sp.sales_order_id
            AND sub_i.is_paid = true AND sub_i.paid_at IS NOT NULL
            AND sub_i.is_cancelled IS NOT TRUE
            AND ABS(EXTRACT(EPOCH FROM (sp.created_at - sub_i.paid_at))) <= 300
        ),
        'itemsCount', (
          SELECT COUNT(*) FROM public.sales_order_items sub_i
          WHERE sub_i.sales_order_id = sp.sales_order_id
            AND sub_i.is_paid = true AND sub_i.paid_at IS NOT NULL
            AND sub_i.is_cancelled IS NOT TRUE
            AND ABS(EXTRACT(EPOCH FROM (sp.created_at - sub_i.paid_at))) <= 300
        ),
        'itemsRaw', (
          SELECT jsonb_agg(jsonb_build_object(
            'name', COALESCE(sub_p.name,
              CASE sub_i.concept_type
                WHEN 'ROOM_BASE' THEN 'Habitación' WHEN 'EXTRA_HOUR' THEN 'Hora Extra'
                WHEN 'EXTRA_PERSON' THEN 'Persona Extra' WHEN 'RENEWAL' THEN 'Renovación'
                WHEN 'PROMO_4H' THEN 'Promo 4H' WHEN 'CONSUMPTION' THEN 'Consumo'
                WHEN 'PRODUCT' THEN 'Producto'
                WHEN 'DAMAGE_CHARGE' THEN 'Cargo por Daños'
                WHEN 'ROOM_CHANGE_ADJUSTMENT' THEN 'Cambio de Habitación'
                ELSE 'Item' END
            ), 'qty', sub_i.qty, 'unitPrice', sub_i.unit_price,
            'is_courtesy', sub_i.is_courtesy,
            'courtesy_reason', sub_i.courtesy_reason,
            'total', sub_i.qty * sub_i.unit_price))
          FROM public.sales_order_items sub_i
          LEFT JOIN public.products sub_p ON sub_p.id = sub_i.product_id
          WHERE sub_i.sales_order_id = sp.sales_order_id
            AND sub_i.is_paid = true AND sub_i.paid_at IS NOT NULL
            AND sub_i.is_cancelled IS NOT TRUE
            AND ABS(EXTRACT(EPOCH FROM (sp.created_at - sub_i.paid_at))) <= 300
        )
      ) ORDER BY sp.created_at DESC
    ), '[]'::jsonb) AS items
    FROM shift_payments sp
  ),

  -- 2f. Expenses
  shift_expenses AS (
    SELECT
      COALESCE(jsonb_agg(row_to_json(se)::jsonb ORDER BY se.created_at DESC), '[]'::jsonb) AS items,
      COALESCE(SUM(se.amount), 0) AS total
    FROM public.shift_expenses se
    WHERE se.shift_session_id = p_session_id AND se.status <> 'rejected'
  ),

  -- 2g. Accrual items (exclude cancelled items and room 13/113)
  accrual AS (
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', soi.id, 'qty', soi.qty, 'unit_price', soi.unit_price,
        'total', soi.total, 'concept_type', soi.concept_type,
        'is_courtesy', soi.is_courtesy,
        'courtesy_reason', soi.courtesy_reason,
        'products', CASE WHEN pr.id IS NOT NULL THEN jsonb_build_object('name', pr.name, 'sku', pr.sku) ELSE NULL END,
        'sales_orders', jsonb_build_object('id', so.id, 'room_stays', jsonb_build_object(
          'rooms', jsonb_build_object('number', rm.number, 'room_types', jsonb_build_object('name', rt.name)),
          'status', rs.status))
      )), '[]'::jsonb) AS items,
      COALESCE(SUM(CASE WHEN rs.status IS NULL OR rs.status <> 'CANCELADA' THEN soi.total ELSE 0 END), 0) AS total_active
    FROM public.sales_order_items soi
    LEFT JOIN public.products pr ON pr.id = soi.product_id
    LEFT JOIN public.sales_orders so ON so.id = soi.sales_order_id
    LEFT JOIN public.room_stays rs ON rs.sales_order_id = so.id
    LEFT JOIN public.rooms rm ON rm.id = rs.room_id
    LEFT JOIN public.room_types rt ON rt.id = rm.room_type_id
    WHERE soi.shift_session_id = p_session_id
      AND soi.is_cancelled IS NOT TRUE
      AND (rm.number IS NULL OR rm.number NOT IN ('13', '113'))
  ),

  -- 2h. Sales orders (exclude room 13/113, and select all shift orders dynamically)
  shift_orders AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', so.id, 'created_at', so.created_at, 'total', so.total,
      'paid_amount', so.paid_amount, 'remaining_amount', so.remaining_amount, 'status', so.status,
      'room_stays', (SELECT jsonb_agg(jsonb_build_object(
        'id', rs2.id, 
        'check_in_at', rs2.check_in_at,
        'vehicle_plate', rs2.vehicle_plate,
        'status', rs2.status,
        'rooms', jsonb_build_object(
          'number', rm2.number, 
          'room_types', jsonb_build_object('name', rt2.name))))
        FROM public.room_stays rs2 JOIN public.rooms rm2 ON rm2.id = rs2.room_id
        LEFT JOIN public.room_types rt2 ON rt2.id = rm2.room_type_id WHERE rs2.sales_order_id = so.id),
      'sales_order_items', (SELECT jsonb_agg(jsonb_build_object(
        'id', soi2.id, 'qty', soi2.qty, 'unit_price', soi2.unit_price, 'total', soi2.total,
        'concept_type', soi2.concept_type, 'is_paid', soi2.is_paid, 'paid_at', soi2.paid_at,
        'payment_method', soi2.payment_method,
        'is_courtesy', soi2.is_courtesy,
        'courtesy_reason', soi2.courtesy_reason,
        'products', CASE WHEN pr2.id IS NOT NULL THEN jsonb_build_object('name', pr2.name, 'sku', pr2.sku) ELSE NULL END))
        FROM public.sales_order_items soi2 LEFT JOIN public.products pr2 ON pr2.id = soi2.product_id
        WHERE soi2.sales_order_id = so.id AND soi2.is_cancelled IS NOT TRUE)
    ) ORDER BY so.created_at DESC), '[]'::jsonb) AS items
    FROM public.sales_orders so
    LEFT JOIN public.room_stays rs ON rs.sales_order_id = so.id
    LEFT JOIN public.rooms rm ON rm.id = rs.room_id
    WHERE so.id IN (
      SELECT DISTINCT sales_order_id FROM shift_payments WHERE sales_order_id IS NOT NULL
      UNION
      SELECT DISTINCT sales_order_id FROM public.sales_order_items WHERE shift_session_id = p_session_id AND sales_order_id IS NOT NULL
      UNION
      SELECT DISTINCT sales_order_id FROM public.room_stays WHERE shift_session_id = p_session_id AND sales_order_id IS NOT NULL
    )
    AND (rm.number IS NULL OR rm.number NOT IN ('13', '113'))
  )

  SELECT jsonb_build_object(
    'total_cash', pt.total_cash, 'total_card_bbva', pt.total_card_bbva,
    'total_card_getnet', pt.total_card_getnet,
    'total_sales', pt.total_cash + pt.total_card_bbva + pt.total_card_getnet,
    'total_transactions', pt.total_transactions,
    'payments', e.items, 'salesOrders', sor.items,
    'expenses', se.items, 'total_expenses', se.total,
    'total_accrual_sales', a.total_active, 'accrual_items', a.items,
    'unassigned_card_payments', uc.items, 'unhandled_payment_methods', um.items
  ) INTO v_result
  FROM payment_totals pt
  CROSS JOIN enriched e CROSS JOIN shift_expenses se
  CROSS JOIN accrual a CROSS JOIN shift_orders sor
  CROSS JOIN unassigned_cards uc CROSS JOIN unhandled_methods um;

  RETURN v_result;
END;
$$;


-- Update 3: process_cancel_stay
-- Registers cash refunds in the payments table so they are correctly deducted from shift totals
CREATE OR REPLACE FUNCTION public.process_cancel_stay(
  p_room_stay_id uuid,
  p_room_id uuid,
  p_sales_order_id uuid,
  p_reason text,
  p_refund_type text,
  p_refund_amount numeric
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 AS $$
DECLARE
  v_valet_money_warning NUMERIC := 0;
  v_total_paid NUMERIC := 0;
  v_retained_amount NUMERIC := 0;
  v_old_notes TEXT;
  v_new_notes TEXT;
  v_order_update_note TEXT;
  v_refund_val NUMERIC := 0;
  v_refund_payment_id UUID;
BEGIN
  -- 1. Finalizar la estancia como CANCELADA y limpiar datos
  UPDATE room_stays
  SET status = 'CANCELADA',
      actual_check_out_at = NOW(),
      checkout_payment_data = NULL,
      vehicle_requested_at = NULL,
      valet_checkout_requested_at = NULL
  WHERE id = p_room_stay_id;

  -- 2. Marcar habitación como SUCIA
  UPDATE rooms
  SET status = 'SUCIA'
  WHERE id = p_room_id;

  -- 3. Calcular dinero retenido por el cochero
  SELECT COALESCE(SUM(amount), 0)
  INTO v_valet_money_warning
  FROM payments
  WHERE sales_order_id = p_sales_order_id
    AND status IN ('COBRADO_POR_VALET', 'CORROBORADO_RECEPCION');

  -- 4. Cancelar pagos no finalizados
  UPDATE payments
  SET status = 'CANCELADO',
      notes = 'Cancelado por cancelación de estancia: ' || p_reason
  WHERE sales_order_id = p_sales_order_id
    AND status IN ('PENDIENTE', 'COBRADO_POR_VALET', 'CORROBORADO_RECEPCION');

  -- 5. Cancelar sales_order_items no pagados
  UPDATE sales_order_items
  SET delivery_status = 'CANCELLED',
      is_paid = false
  WHERE sales_order_id = p_sales_order_id
    AND is_paid = false;

  -- 6. Calcular monto retenido y actualizar orden
  SELECT paid_amount, notes
  INTO v_total_paid, v_old_notes
  FROM sales_orders
  WHERE id = p_sales_order_id;

  v_total_paid := COALESCE(v_total_paid, 0);

  IF p_refund_type = 'none' THEN
    v_retained_amount := v_total_paid;
  ELSIF p_refund_type = 'full' THEN
    v_retained_amount := 0;
    v_refund_val := v_total_paid;
  ELSIF p_refund_type = 'partial' THEN
    v_retained_amount := GREATEST(0, v_total_paid - COALESCE(p_refund_amount, 0));
    v_refund_val := COALESCE(p_refund_amount, 0);
  END IF;

  -- Register REFUND payment if refund value is greater than 0
  IF v_refund_val > 0 THEN
    INSERT INTO public.payments (
      sales_order_id,
      amount,
      payment_method,
      reference,
      concept,
      status,
      payment_type,
      notes,
      collected_by
    ) VALUES (
      p_sales_order_id,
      v_refund_val,
      'EFECTIVO',
      'REF-' || substr(md5(random()::text), 1, 8),
      'REFUND',
      'CANCELADO',
      'COMPLETO',
      'Reembolso por cancelación de estancia: ' || COALESCE(p_reason, ''),
      (SELECT id FROM public.employees WHERE auth_user_id = auth.uid())
    ) RETURNING id INTO v_refund_payment_id;
  END IF;

  v_order_update_note := '❌ CANCELADA: ' || COALESCE(p_reason, '') || '. Reembolso: ' ||
                         CASE WHEN p_refund_type = 'full' THEN 'Total'
                              WHEN p_refund_type = 'partial' THEN 'Parcial $' || COALESCE(p_refund_amount, 0)::TEXT
                              ELSE 'Sin reembolso' END || 
                         ' (Retenido: $' || v_retained_amount::TEXT || ')';

  v_new_notes := TRIM(REPLACE(COALESCE(v_old_notes, ''), v_order_update_note, ''));
  v_new_notes := TRIM(v_new_notes || E'\n' || v_order_update_note);

  UPDATE sales_orders
  SET status = 'CANCELLED',
      subtotal = v_retained_amount,
      total = v_retained_amount,
      paid_amount = v_retained_amount,
      remaining_amount = 0,
      notes = v_new_notes
  WHERE id = p_sales_order_id;

  -- 7. Devolver el resultado
  RETURN jsonb_build_object(
    'success', true,
    'valetMoneyWarning', v_valet_money_warning
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', SQLERRM
  );
END;
$$;
