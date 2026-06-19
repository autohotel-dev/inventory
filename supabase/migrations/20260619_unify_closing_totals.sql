-- Migration: Unify closing totals (ticket ↔ HP sheet)
-- Changes total_sales from payment-based to item-based calculation
-- in get_shift_closing_summary, aligning with get_income_report.
-- Payment method breakdowns (total_cash, total_card_bbva, total_card_getnet)
-- remain payment-based for cash/card reconciliation (arqueo).

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
          OR amount < 0 THEN 0
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
          OR amount < 0 THEN 0
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
          OR amount < 0 THEN 0
        WHEN payment_method = 'TARJETA_GETNET' THEN amount
        WHEN payment_method = 'TARJETA' AND (terminal_code = 'GETNET' OR terminal_name = 'GETNET') THEN amount
        ELSE 0
      END), 0) AS total_card_getnet,
      COUNT(*) FILTER (
        WHERE payment_method <> 'PENDIENTE' 
          AND COALESCE(payment_status, '') NOT IN ('PENDIENTE', 'CANCELADO')
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

  -- 2g. Accrual items with concept-type breakdown (aligned with get_income_report)
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
      -- Total activo general (excluye estancias CANCELADA)
      COALESCE(SUM(CASE WHEN rs.status IS NULL OR rs.status <> 'CANCELADA' THEN soi.total ELSE 0 END), 0) AS total_active,
      -- Desglose por tipo de concepto (alineado con get_income_report)
      COALESCE(SUM(CASE WHEN (rs.status IS NULL OR rs.status <> 'CANCELADA') AND soi.concept_type = 'ROOM_BASE' THEN soi.total ELSE 0 END), 0) AS total_room_price,
      COALESCE(SUM(CASE WHEN (rs.status IS NULL OR rs.status <> 'CANCELADA') AND soi.concept_type IN ('EXTRA_PERSON', 'EXTRA_HOUR', 'RENEWAL', 'PROMO_4H', 'ROOM_CHANGE_ADJUSTMENT') THEN soi.total ELSE 0 END), 0) AS total_extra,
      COALESCE(SUM(CASE WHEN (rs.status IS NULL OR rs.status <> 'CANCELADA') AND soi.concept_type IN ('CONSUMPTION', 'PRODUCT', 'RESTAURANT') THEN soi.total ELSE 0 END), 0) AS total_consumption,
      COALESCE(SUM(CASE WHEN (rs.status IS NULL OR rs.status <> 'CANCELADA') AND soi.concept_type = 'DAMAGE_CHARGE' THEN soi.total ELSE 0 END), 0) AS total_damage
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
    -- UNIFIED: total_sales now uses item-based total (aligned with get_income_report / HP sheet)
    'total_sales', a.total_active,
    -- AUDIT: keep payment-based total as reference for diagnostics
    'total_payment_sales', pt.total_cash + pt.total_card_bbva + pt.total_card_getnet,
    -- BREAKDOWN: concept-type totals (aligned with get_income_report / HP sheet)
    'total_room_price', a.total_room_price,
    'total_extra', a.total_extra,
    'total_consumption', a.total_consumption,
    'total_damage', a.total_damage,
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

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
