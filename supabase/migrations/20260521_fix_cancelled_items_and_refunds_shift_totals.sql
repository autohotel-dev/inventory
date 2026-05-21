-- Migration: Fix shift totals and pre-cuts for cancelled items and refunds
-- Target: public.get_income_report (both signatures), public.calculate_shift_totals, public.get_shift_closing_summary

-- Update 1: calculate_shift_totals
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
      WHEN p.status = 'PENDIENTE' OR (p.status = 'CANCELADO' AND p.concept <> 'REFUND') THEN 0
      WHEN p.concept = 'REFUND' AND p.payment_method = 'EFECTIVO' THEN -p.amount
      WHEN p.payment_method = 'EFECTIVO' THEN p.amount 
      ELSE 0 
    END), 0)::DECIMAL(12,2) AS total_cash,
    COALESCE(SUM(CASE 
      WHEN p.status = 'PENDIENTE' OR (p.status = 'CANCELADO' AND p.concept <> 'REFUND') THEN 0
      WHEN p.concept = 'REFUND' AND p.payment_method = 'TARJETA' AND pt.code = 'BBVA' THEN -p.amount
      WHEN p.payment_method = 'TARJETA' AND pt.code = 'BBVA' THEN p.amount 
      ELSE 0 
    END), 0)::DECIMAL(12,2) AS total_card_bbva,
    COALESCE(SUM(CASE 
      WHEN p.status = 'PENDIENTE' OR (p.status = 'CANCELADO' AND p.concept <> 'REFUND') THEN 0
      WHEN p.concept = 'REFUND' AND p.payment_method = 'TARJETA' AND pt.code = 'GETNET' THEN -p.amount
      WHEN p.payment_method = 'TARJETA' AND pt.code = 'GETNET' THEN p.amount 
      ELSE 0 
    END), 0)::DECIMAL(12,2) AS total_card_getnet,
    COALESCE(SUM(CASE 
      WHEN p.status = 'PENDIENTE' OR (p.status = 'CANCELADO' AND p.concept <> 'REFUND') THEN 0
      WHEN p.concept = 'REFUND' THEN -p.amount
      ELSE p.amount 
    END), 0)::DECIMAL(12,2) AS total_sales,
    COUNT(p.id) FILTER (WHERE p.status NOT IN ('PENDIENTE', 'CANCELADO'))::INTEGER AS total_transactions
  FROM payments p
  LEFT JOIN payment_terminals pt ON pt.code = p.terminal_code
  WHERE p.employee_id = p_employee_id
    AND p.created_at >= p_period_start
    AND p.created_at < p_period_end;
END;
$$;

-- Update 2: get_shift_closing_summary
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
  -- 2a. Get all payments for this shift — STRICT: only by session ID
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
    WHERE
      p.shift_session_id = p_session_id
  ),

  -- 2b. Calculate totals by payment method (exclude PENDIENTE, CANCELLED, negative amounts, handle refunds)
  payment_totals AS (
    SELECT
      COALESCE(SUM(CASE
        WHEN payment_method = 'PENDIENTE' OR payment_method = 'MIXTO' 
          OR payment_status = 'PENDIENTE'
          OR (payment_status = 'CANCELADO' AND concept <> 'REFUND')
          OR amount < 0
          OR COALESCE(order_status, 'ENDED') = 'CANCELLED' THEN 0
        WHEN concept = 'REFUND' AND payment_method = 'EFECTIVO' THEN -amount
        WHEN payment_method = 'EFECTIVO' THEN amount
        ELSE 0
      END), 0) AS total_cash,
      COALESCE(SUM(CASE
        WHEN payment_method = 'PENDIENTE' OR payment_method = 'MIXTO' 
          OR payment_status = 'PENDIENTE'
          OR (payment_status = 'CANCELADO' AND concept <> 'REFUND')
          OR amount < 0
          OR COALESCE(order_status, 'ENDED') = 'CANCELLED' THEN 0
        WHEN concept = 'REFUND' AND (
             payment_method = 'TARJETA_BBVA' 
             OR (payment_method = 'TARJETA' AND (terminal_code = 'BBVA' OR terminal_name = 'BBVA'))
             OR (payment_method = 'TARJETA' AND terminal_code IS NULL AND terminal_name IS NULL)
        ) THEN -amount
        WHEN payment_method = 'TARJETA_BBVA' THEN amount
        WHEN payment_method = 'TARJETA' AND (terminal_code = 'BBVA' OR terminal_name = 'BBVA') THEN amount
        WHEN payment_method = 'TARJETA' AND terminal_code IS NULL AND terminal_name IS NULL THEN amount
        ELSE 0
      END), 0) AS total_card_bbva,
      COALESCE(SUM(CASE
        WHEN payment_method = 'PENDIENTE' OR payment_method = 'MIXTO' 
          OR payment_status = 'PENDIENTE'
          OR (payment_status = 'CANCELADO' AND concept <> 'REFUND')
          OR amount < 0
          OR COALESCE(order_status, 'ENDED') = 'CANCELLED' THEN 0
        WHEN concept = 'REFUND' AND (
             payment_method = 'TARJETA_GETNET' 
             OR (payment_method = 'TARJETA' AND (terminal_code = 'GETNET' OR terminal_name = 'GETNET'))
        ) THEN -amount
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

  -- 2g. Accrual items (exclude cancelled items completely)
  accrual AS (
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', soi.id, 'qty', soi.qty, 'unit_price', soi.unit_price,
        'total', soi.total, 'concept_type', soi.concept_type,
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
  ),

  -- 2h. Sales orders (exclude cancelled items from order detail items)
  shift_orders AS (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', so.id, 'created_at', so.created_at, 'total', so.total,
      'paid_amount', so.paid_amount, 'remaining_amount', so.remaining_amount, 'status', so.status,
      'room_stays', (SELECT jsonb_agg(jsonb_build_object('id', rs2.id, 'rooms', jsonb_build_object(
        'number', rm2.number, 'room_types', jsonb_build_object('name', rt2.name))))
        FROM public.room_stays rs2 JOIN public.rooms rm2 ON rm2.id = rs2.room_id
        LEFT JOIN public.room_types rt2 ON rt2.id = rm2.room_type_id WHERE rs2.sales_order_id = so.id),
      'sales_order_items', (SELECT jsonb_agg(jsonb_build_object(
        'id', soi2.id, 'qty', soi2.qty, 'unit_price', soi2.unit_price, 'total', soi2.total,
        'concept_type', soi2.concept_type, 'is_paid', soi2.is_paid, 'paid_at', soi2.paid_at,
        'payment_method', soi2.payment_method,
        'products', CASE WHEN pr2.id IS NOT NULL THEN jsonb_build_object('name', pr2.name, 'sku', pr2.sku) ELSE NULL END))
        FROM public.sales_order_items soi2 LEFT JOIN public.products pr2 ON pr2.id = soi2.product_id
        WHERE soi2.sales_order_id = so.id AND soi2.is_cancelled IS NOT TRUE)
    ) ORDER BY so.created_at DESC), '[]'::jsonb) AS items
    FROM public.sales_orders so
    WHERE so.id IN (SELECT DISTINCT sales_order_id FROM shift_payments WHERE sales_order_id IS NOT NULL)
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

-- Update 3: get_income_report (7 parameters)
CREATE OR REPLACE FUNCTION public.get_income_report(p_report_type text, p_shift_id uuid DEFAULT NULL::uuid, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_payment_method_filter text DEFAULT 'all'::text, p_room_filter text DEFAULT 'all'::text, p_status_filter text DEFAULT 'all'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_employee_name TEXT;
  v_result JSONB;
  v_sales_order_ids UUID[];
BEGIN
  -- 1. Resolve shift info if needed
  IF p_report_type = 'shift' AND p_shift_id IS NOT NULL THEN
    -- Try shift_closings first
    SELECT sc.shift_session_id, sc.period_start, sc.period_end,
           COALESCE(e.first_name || ' ' || e.last_name, 'Desconocido')
    INTO v_session_id, v_shift_start, v_shift_end, v_employee_name
    FROM public.shift_closings sc
    LEFT JOIN public.employees e ON e.id = sc.employee_id
    WHERE sc.id = p_shift_id;

    -- Fallback to shift_sessions
    IF v_session_id IS NULL THEN
      SELECT ss.id, ss.clock_in_at, ss.clock_out_at,
             COALESCE(e.first_name || ' ' || e.last_name, 'Desconocido')
      INTO v_session_id, v_shift_start, v_shift_end, v_employee_name
      FROM public.shift_sessions ss
      LEFT JOIN public.employees e ON e.id = ss.employee_id
      WHERE ss.id = p_shift_id;
    END IF;

    -- Find sales_order_ids for this shift (exclude cancelled items)
    SELECT ARRAY_AGG(DISTINCT soid) INTO v_sales_order_ids
    FROM (
      SELECT sales_order_id AS soid FROM public.sales_order_items WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND is_cancelled IS NOT TRUE
      UNION
      SELECT sales_order_id AS soid FROM public.payments WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND status NOT IN ('PENDIENTE', 'CANCELADO')
    ) sub;
  END IF;

  -- 2. Build entries
  WITH
  filtered_stays AS (
    SELECT
      rs.id AS stay_id,
      rs.check_in_at,
      rs.vehicle_plate,
      rs.status AS stay_status,
      rs.sales_order_id,
      rm.number AS room_number,
      COALESCE(ev.first_name || ' ' || ev.last_name, '—') AS checkout_valet_name,
      COALESCE(e_in.first_name || ' ' || e_in.last_name, '—') AS receptionist_name,
      COALESCE(sd.name, '—') AS shift_name
    FROM public.room_stays rs
    JOIN public.rooms rm ON rm.id = rs.room_id
    LEFT JOIN public.employees ev ON ev.id = rs.checkout_valet_employee_id
    LEFT JOIN public.shift_sessions ss_in ON rs.shift_session_id = ss_in.id
    LEFT JOIN public.employees e_in ON e_in.id = ss_in.employee_id
    LEFT JOIN public.shift_definitions sd ON sd.id = ss_in.shift_definition_id
    WHERE
      -- Exclude rooms 13/113
      rm.number NOT IN ('13', '113')
      -- Status filter
      AND (
        CASE WHEN p_status_filter = 'all' OR p_status_filter IS NULL
          THEN rs.status IN ('ACTIVA', 'FINALIZADA', 'CANCELADA')
          ELSE rs.status = p_status_filter
        END
      )
      -- Shift or date range filter
      AND (
        CASE
          WHEN p_report_type = 'shift' AND v_sales_order_ids IS NOT NULL
            THEN rs.sales_order_id = ANY(v_sales_order_ids)
          WHEN p_report_type = 'dateRange' THEN
            (p_start_date IS NULL OR rs.check_in_at >= p_start_date)
            AND (p_end_date IS NULL OR rs.check_in_at <= (p_end_date + interval '1 day' - interval '1 millisecond'))
          ELSE true
        END
      )
    ORDER BY rs.check_in_at ASC
  ),

  stay_entries AS (
    SELECT
      fs.stay_id,
      fs.check_in_at,
      fs.vehicle_plate,
      fs.room_number,
      fs.stay_status,
      fs.checkout_valet_name,
      fs.receptionist_name,
      fs.shift_name,
      -- Room price (exclude cancelled)
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type = 'ROOM_BASE'
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS room_price,
      -- Extras (exclude cancelled)
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('EXTRA_PERSON', 'EXTRA_HOUR', 'RENEWAL', 'PROMO_4H', 'DAMAGE_CHARGE', 'ROOM_CHANGE_ADJUSTMENT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS extra,
      -- Consumption (exclude cancelled)
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('CONSUMPTION', 'PRODUCT', 'RESTAURANT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS consumption,
      -- Payment method (exclude PENDIENTE & CANCELADO)
      (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 'PENDIENTE'
          WHEN COUNT(DISTINCT p2.payment_method) > 1 THEN 'MIXTO'
          ELSE MIN(p2.payment_method)
        END
        FROM public.payments p2
        WHERE p2.sales_order_id = fs.sales_order_id
          AND p2.status <> 'PENDIENTE' AND p2.status <> 'CANCELADO'
          AND UPPER(COALESCE(p2.concept, '')) <> 'CHECKOUT'
          AND p2.payment_method <> 'PENDIENTE'
          AND (v_session_id IS NULL OR p2.shift_session_id = v_session_id)
      ) AS payment_method,
      -- Card details (first card payment, exclude CANCELADO)
      (
        SELECT jsonb_build_object(
          'card_type', p3.card_type,
          'card_last_4', p3.card_last_4,
          'terminal_code', p3.terminal_code
        )
        FROM public.payments p3
        WHERE p3.sales_order_id = fs.sales_order_id
          AND p3.payment_method = 'TARJETA'
          AND p3.status <> 'PENDIENTE' AND p3.status <> 'CANCELADO'
          AND (v_session_id IS NULL OR p3.shift_session_id = v_session_id)
        LIMIT 1
      ) AS card_details,
      -- Payments array for detailed view (exclude CANCELADO)
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'payment_method', p4.payment_method,
          'amount', p4.amount,
          'card_type', p4.card_type,
          'card_last_4', p4.card_last_4,
          'terminal_code', p4.terminal_code
        )), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (p4i.amount, p4i.payment_method, COALESCE(p4i.card_last_4, ''))
            p4i.*
          FROM public.payments p4i
          WHERE p4i.sales_order_id = fs.sales_order_id
            AND p4i.status <> 'PENDIENTE' AND p4i.status <> 'CANCELADO'
            AND UPPER(COALESCE(p4i.concept, '')) <> 'CHECKOUT'
            AND p4i.payment_method <> 'PENDIENTE'
            AND (v_session_id IS NULL OR p4i.shift_session_id = v_session_id)
        ) p4
      ) AS payments_detail
    FROM filtered_stays fs
  ),

  -- Number the entries
  numbered AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY se.check_in_at ASC) AS row_no,
      se.*
    FROM stay_entries se
  ),

  -- Apply payment method filter
  filtered_entries AS (
    SELECT * FROM numbered
    WHERE (p_payment_method_filter = 'all' OR p_payment_method_filter IS NULL OR payment_method = p_payment_method_filter)
      AND (p_room_filter = 'all' OR p_room_filter IS NULL OR room_number = p_room_filter)
  )

  SELECT jsonb_build_object(
    'entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'no', fe.row_no,
        'time', to_char(fe.check_in_at AT TIME ZONE 'America/Mexico_City', 'HH24:MI'),
        'vehicle_plate', COALESCE(fe.vehicle_plate, ''),
        'room_number', fe.room_number,
        'room_price', fe.room_price,
        'extra', fe.extra,
        'consumption', fe.consumption,
        'total', fe.room_price + fe.extra + fe.consumption,
        'payment_method', fe.payment_method,
        'card_type', fe.card_details->>'card_type',
        'card_last_4', fe.card_details->>'card_last_4',
        'terminal_code', fe.card_details->>'terminal_code',
        'stay_status', fe.stay_status,
        'checkout_valet_name', fe.checkout_valet_name,
        'receptionist_name', fe.receptionist_name,
        'shift_name', fe.shift_name,
        'payments', fe.payments_detail
      ) ORDER BY fe.row_no)
      FROM filtered_entries fe
    ), '[]'::jsonb),
    'shiftInfo', CASE WHEN p_report_type = 'shift' THEN jsonb_build_object(
      'shift_start', v_shift_start,
      'shift_end', v_shift_end,
      'employee_name', v_employee_name
    ) ELSE NULL END,
    'currentShift', (
      SELECT jsonb_build_object('employee_name', COALESCE(e.first_name || ' ' || e.last_name, 'Desconocido'))
      FROM public.shift_sessions ss
      LEFT JOIN public.employees e ON e.id = ss.employee_id
      WHERE ss.status = 'active'
      LIMIT 1
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Update 4: get_income_report (9 parameters - paginated)
CREATE OR REPLACE FUNCTION public.get_income_report(p_report_type text, p_shift_id uuid DEFAULT NULL::uuid, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_payment_method_filter text DEFAULT 'all'::text, p_room_filter text DEFAULT 'all'::text, p_status_filter text DEFAULT 'all'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 50)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_session_id UUID;
  v_shift_start TIMESTAMPTZ;
  v_shift_end TIMESTAMPTZ;
  v_employee_name TEXT;
  v_result JSONB;
  v_sales_order_ids UUID[];
  v_total_room_price NUMERIC := 0;
  v_total_extra NUMERIC := 0;
  v_total_consumption NUMERIC := 0;
  v_total_count INT := 0;
  v_offset INT := 0;
BEGIN
  IF p_page_size IS NOT NULL AND p_page_size > 0 THEN
    v_offset := (p_page - 1) * p_page_size;
  END IF;

  -- 1. Resolve shift info if needed
  IF p_report_type = 'shift' AND p_shift_id IS NOT NULL THEN
    -- Try shift_closings first
    SELECT sc.shift_session_id, sc.period_start, sc.period_end,
           COALESCE(e.first_name || ' ' || e.last_name, 'Desconocido')
    INTO v_session_id, v_shift_start, v_shift_end, v_employee_name
    FROM public.shift_closings sc
    LEFT JOIN public.employees e ON e.id = sc.employee_id
    WHERE sc.id = p_shift_id;

    -- Fallback to shift_sessions
    IF v_session_id IS NULL THEN
      SELECT ss.id, ss.clock_in_at, ss.clock_out_at,
             COALESCE(e.first_name || ' ' || e.last_name, 'Desconocido')
      INTO v_session_id, v_shift_start, v_shift_end, v_employee_name
      FROM public.shift_sessions ss
      LEFT JOIN public.employees e ON e.id = ss.employee_id
      WHERE ss.id = p_shift_id;
    END IF;

    -- Find sales_order_ids for this shift (exclude cancelled items)
    SELECT ARRAY_AGG(DISTINCT soid) INTO v_sales_order_ids
    FROM (
      SELECT sales_order_id AS soid FROM public.sales_order_items WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND is_cancelled IS NOT TRUE
      UNION
      SELECT sales_order_id AS soid FROM public.payments WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND status NOT IN ('PENDIENTE', 'CANCELADO')
    ) sub;
  END IF;

  -- 2. Create Temp Table to store filtered entries
  DROP TABLE IF EXISTS tmp_filtered_entries;
  CREATE TEMP TABLE tmp_filtered_entries AS
  WITH
  filtered_stays AS (
    SELECT
      rs.id AS stay_id,
      rs.check_in_at,
      rs.vehicle_plate,
      rs.status AS stay_status,
      rs.sales_order_id,
      rm.number AS room_number,
      COALESCE(ev.first_name || ' ' || ev.last_name, '—') AS checkout_valet_name,
      COALESCE(e_in.first_name || ' ' || e_in.last_name, '—') AS receptionist_name,
      COALESCE(sd.name, '—') AS shift_name
    FROM public.room_stays rs
    JOIN public.rooms rm ON rm.id = rs.room_id
    LEFT JOIN public.employees ev ON ev.id = rs.checkout_valet_employee_id
    LEFT JOIN public.shift_sessions ss_in ON rs.shift_session_id = ss_in.id
    LEFT JOIN public.employees e_in ON e_in.id = ss_in.employee_id
    LEFT JOIN public.shift_definitions sd ON sd.id = ss_in.shift_definition_id
    WHERE
      rm.number NOT IN ('13', '113')
      AND (
        CASE WHEN p_status_filter = 'all' OR p_status_filter IS NULL
          THEN rs.status IN ('ACTIVA', 'FINALIZADA', 'CANCELADA')
          ELSE rs.status = p_status_filter
        END
      )
      AND (
        CASE
          WHEN p_report_type = 'shift' AND v_sales_order_ids IS NOT NULL
            THEN rs.sales_order_id = ANY(v_sales_order_ids)
          WHEN p_report_type = 'dateRange' THEN
            (p_start_date IS NULL OR rs.check_in_at >= p_start_date)
            AND (p_end_date IS NULL OR rs.check_in_at <= (p_end_date + interval '1 day' - interval '1 millisecond'))
          ELSE true
        END
      )
  ),

  stay_entries AS (
    SELECT
      fs.stay_id,
      fs.check_in_at,
      fs.vehicle_plate,
      fs.room_number,
      fs.stay_status,
      fs.checkout_valet_name,
      fs.receptionist_name,
      fs.shift_name,
      -- Room price (exclude cancelled)
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type = 'ROOM_BASE'
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS room_price,
      -- Extras (exclude cancelled)
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('EXTRA_PERSON', 'EXTRA_HOUR', 'RENEWAL', 'PROMO_4H', 'DAMAGE_CHARGE', 'ROOM_CHANGE_ADJUSTMENT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS extra,
      -- Consumption (exclude cancelled)
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('CONSUMPTION', 'PRODUCT', 'RESTAURANT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS consumption,
      -- Payment method (exclude PENDIENTE & CANCELADO)
      (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 'PENDIENTE'
          WHEN COUNT(DISTINCT p2.payment_method) > 1 THEN 'MIXTO'
          ELSE MIN(p2.payment_method)
        END
        FROM public.payments p2
        WHERE p2.sales_order_id = fs.sales_order_id
          AND p2.status <> 'PENDIENTE' AND p2.status <> 'CANCELADO'
          AND UPPER(COALESCE(p2.concept, '')) <> 'CHECKOUT'
          AND p2.payment_method <> 'PENDIENTE'
          AND (v_session_id IS NULL OR p2.shift_session_id = v_session_id)
      ) AS payment_method,
      -- Card details (first card payment, exclude CANCELADO)
      (
        SELECT jsonb_build_object(
          'card_type', p3.card_type,
          'card_last_4', p3.card_last_4,
          'terminal_code', p3.terminal_code
        )
        FROM public.payments p3
        WHERE p3.sales_order_id = fs.sales_order_id
          AND p3.payment_method = 'TARJETA'
          AND p3.status <> 'PENDIENTE' AND p3.status <> 'CANCELADO'
          AND (v_session_id IS NULL OR p3.shift_session_id = v_session_id)
        LIMIT 1
      ) AS card_details,
      -- Payments array for detailed view (exclude CANCELADO)
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'payment_method', p4.payment_method,
          'amount', p4.amount,
          'card_type', p4.card_type,
          'card_last_4', p4.card_last_4,
          'terminal_code', p4.terminal_code
        )), '[]'::jsonb)
        FROM (
          SELECT DISTINCT ON (p4i.amount, p4i.payment_method, COALESCE(p4i.card_last_4, ''))
            p4i.*
          FROM public.payments p4i
          WHERE p4i.sales_order_id = fs.sales_order_id
            AND p4i.status <> 'PENDIENTE' AND p4i.status <> 'CANCELADO'
            AND UPPER(COALESCE(p4i.concept, '')) <> 'CHECKOUT'
            AND p4i.payment_method <> 'PENDIENTE'
            AND (v_session_id IS NULL OR p4i.shift_session_id = v_session_id)
        ) p4
      ) AS payments_detail
    FROM filtered_stays fs
  ),
  numbered AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY se.check_in_at ASC) AS row_no,
      se.*
    FROM stay_entries se
  )
  SELECT * FROM numbered
  WHERE (p_payment_method_filter = 'all' OR p_payment_method_filter IS NULL OR payment_method = p_payment_method_filter)
    AND (p_room_filter = 'all' OR p_room_filter IS NULL OR room_number = p_room_filter);

  -- 3. Calculate totals over filtered results
  SELECT
    COUNT(*),
    COALESCE(SUM(room_price), 0),
    COALESCE(SUM(extra), 0),
    COALESCE(SUM(consumption), 0)
  INTO v_total_count, v_total_room_price, v_total_extra, v_total_consumption
  FROM tmp_filtered_entries;

  -- 4. Build paginated JSON response
  SELECT jsonb_build_object(
    'totalCount', v_total_count,
    'totals', jsonb_build_object(
      'roomPrice', v_total_room_price,
      'extra', v_total_extra,
      'consumption', v_total_consumption,
      'total', v_total_room_price + v_total_extra + v_total_consumption
    ),
    'entries', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'no', fe.row_no,
        'time', to_char(fe.check_in_at AT TIME ZONE 'America/Mexico_City', 'HH24:MI'),
        'vehicle_plate', COALESCE(fe.vehicle_plate, ''),
        'room_number', fe.room_number,
        'room_price', fe.room_price,
        'extra', fe.extra,
        'consumption', fe.consumption,
        'total', fe.room_price + fe.extra + fe.consumption,
        'payment_method', fe.payment_method,
        'card_type', fe.card_details->>'card_type',
        'card_last_4', fe.card_details->>'card_last_4',
        'terminal_code', fe.card_details->>'terminal_code',
        'stay_status', fe.stay_status,
        'checkout_valet_name', fe.checkout_valet_name,
        'receptionist_name', fe.receptionist_name,
        'shift_name', fe.shift_name,
        'payments', fe.payments_detail
      ) ORDER BY fe.row_no)
      FROM (
        SELECT * FROM tmp_filtered_entries
        ORDER BY row_no ASC
        LIMIT CASE WHEN p_page_size IS NULL OR p_page_size <= 0 THEN NULL ELSE p_page_size END
        OFFSET v_offset
      ) fe
    ), '[]'::jsonb),
    'shiftInfo', CASE WHEN p_report_type = 'shift' THEN jsonb_build_object(
      'shift_start', v_shift_start,
      'shift_end', v_shift_end,
      'employee_name', v_employee_name
    ) ELSE NULL END,
    'currentShift', (
      SELECT jsonb_build_object('employee_name', COALESCE(e.first_name || ' ' || e.last_name, 'Desconocido'))
      FROM public.shift_sessions ss
      LEFT JOIN public.employees e ON e.id = ss.employee_id
      WHERE ss.status = 'active'
      LIMIT 1
    )
  ) INTO v_result;

  -- 5. Cleanup
  DROP TABLE IF EXISTS tmp_filtered_entries;

  RETURN v_result;
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
