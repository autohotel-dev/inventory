-- Migration: Audit and Align Shift Processes for Absolute Coherence
-- Target: public.get_shift_dashboard_summary, public.calculate_shift_totals, public.get_income_report (both signatures)

-- 1. Redefine calculate_shift_totals to handle card terminals, TARJETA_BBVA/TARJETA_GETNET methods, and unassigned cards consistently
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
      WHEN p.concept = 'REFUND' AND (
        p.payment_method = 'TARJETA_BBVA' 
        OR (p.payment_method = 'TARJETA' AND (p.terminal_code = 'BBVA' OR pt.code = 'BBVA'))
        OR (p.payment_method = 'TARJETA' AND p.terminal_code IS NULL)
      ) THEN -p.amount
      WHEN p.payment_method = 'TARJETA_BBVA' THEN p.amount
      WHEN p.payment_method = 'TARJETA' AND (p.terminal_code = 'BBVA' OR pt.code = 'BBVA') THEN p.amount
      WHEN p.payment_method = 'TARJETA' AND p.terminal_code IS NULL THEN p.amount
      ELSE 0 
    END), 0)::DECIMAL(12,2) AS total_card_bbva,
    COALESCE(SUM(CASE 
      WHEN p.status = 'PENDIENTE' OR (p.status = 'CANCELADO' AND p.concept <> 'REFUND') THEN 0
      WHEN p.concept = 'REFUND' AND (
        p.payment_method = 'TARJETA_GETNET'
        OR (p.payment_method = 'TARJETA' AND (p.terminal_code = 'GETNET' OR pt.code = 'GETNET'))
      ) THEN -p.amount
      WHEN p.payment_method = 'TARJETA_GETNET' THEN p.amount
      WHEN p.payment_method = 'TARJETA' AND (p.terminal_code = 'GETNET' OR pt.code = 'GETNET') THEN p.amount
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


-- 2. Redefine get_shift_dashboard_summary to handle refund payments, card terminal mapping, strict session filtering, concept grouping, and cancelled items
CREATE OR REPLACE FUNCTION public.get_shift_dashboard_summary(
  p_user_id uuid,
  p_session_id uuid DEFAULT NULL::uuid,
  p_include_global boolean DEFAULT false
)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $$
DECLARE
  v_start_date TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  -- Determine start date
  IF p_session_id IS NOT NULL THEN
    SELECT clock_in_at INTO v_start_date
    FROM public.shift_sessions WHERE id = p_session_id;
  END IF;

  IF v_start_date IS NULL THEN
    v_start_date := date_trunc('day', now());
  END IF;

  WITH
  -- Sales orders (strictly filter by session ID if supplied)
  shift_sales AS (
    SELECT id, total, status
    FROM public.sales_orders
    WHERE 
      ((p_session_id IS NOT NULL AND shift_session_id = p_session_id)
       OR (p_session_id IS NULL AND created_at >= v_start_date))
      AND (p_include_global OR created_by = p_user_id)
  ),

  -- Payments (Include PAGADO and REFUND/CANCELADO, strictly filter by session ID if supplied)
  shift_payments AS (
    SELECT amount, payment_method, terminal_code, status, concept
    FROM public.payments
    WHERE 
      ((p_session_id IS NOT NULL AND shift_session_id = p_session_id)
       OR (p_session_id IS NULL AND created_at >= v_start_date))
      AND (status = 'PAGADO' OR (status = 'CANCELADO' AND concept = 'REFUND'))
      AND (p_include_global OR created_by = p_user_id)
  ),

  -- Open rooms count
  open_rooms AS (
    SELECT COUNT(*) AS cnt FROM public.rooms WHERE status = 'OCUPADA'
  ),

  -- Shift items (for accrual-based total + breakdown, strictly filter by session ID if supplied) - Exclude cancelled items!
  shift_items AS (
    SELECT concept_type, total, is_paid
    FROM public.sales_order_items
    WHERE 
      ((p_session_id IS NOT NULL AND shift_session_id = p_session_id)
       OR (p_session_id IS NULL AND created_at >= v_start_date))
      AND is_cancelled IS NOT TRUE
  ),

  -- Calculate payment method totals
  payment_totals AS (
    SELECT
      COALESCE(SUM(CASE 
        WHEN payment_method = 'EFECTIVO' AND status = 'CANCELADO' AND concept = 'REFUND' THEN -amount
        WHEN payment_method = 'EFECTIVO' AND status = 'PAGADO' THEN amount
        ELSE 0 
      END), 0) AS cash_amount,
      COALESCE(SUM(CASE
        -- BBVA Card: payment_method = 'TARJETA_BBVA' or general 'TARJETA' where terminal is NOT GETNET (or is BBVA, or terminal_code is NULL)
        WHEN (
          payment_method = 'TARJETA_BBVA'
          OR (payment_method = 'TARJETA' AND (terminal_code = 'BBVA' OR terminal_code IS NULL))
        ) AND status = 'CANCELADO' AND concept = 'REFUND' THEN -amount
        WHEN (
          payment_method = 'TARJETA_BBVA'
          OR (payment_method = 'TARJETA' AND (terminal_code = 'BBVA' OR terminal_code IS NULL))
        ) AND status = 'PAGADO' THEN amount
        ELSE 0
      END), 0) AS card_bbva,
      COALESCE(SUM(CASE
        -- GETNET Card: payment_method = 'TARJETA_GETNET' or general 'TARJETA' where terminal_code = 'GETNET'
        WHEN (
          payment_method = 'TARJETA_GETNET'
          OR (payment_method = 'TARJETA' AND terminal_code = 'GETNET')
        ) AND status = 'CANCELADO' AND concept = 'REFUND' THEN -amount
        WHEN (
          payment_method = 'TARJETA_GETNET'
          OR (payment_method = 'TARJETA' AND terminal_code = 'GETNET')
        ) AND status = 'PAGADO' THEN amount
        ELSE 0
      END), 0) AS card_getnet
    FROM shift_payments
  ),

  -- Concept breakdown (Map Renewal/Promo/RoomChange to ROOM_BASE, Restaurant to CONSUMPTION, Damage to PRODUCT)
  concept_breakdown AS (
    SELECT
      COALESCE(SUM(CASE WHEN is_paid AND concept_type IN ('ROOM_BASE', 'RENEWAL', 'PROMO_4H', 'ROOM_CHANGE_ADJUSTMENT') THEN total ELSE 0 END), 0) AS room_base,
      COALESCE(SUM(CASE WHEN is_paid AND concept_type = 'EXTRA_HOUR' THEN total ELSE 0 END), 0) AS extra_hour,
      COALESCE(SUM(CASE WHEN is_paid AND concept_type = 'EXTRA_PERSON' THEN total ELSE 0 END), 0) AS extra_person,
      COALESCE(SUM(CASE WHEN is_paid AND concept_type IN ('CONSUMPTION', 'RESTAURANT') THEN total ELSE 0 END), 0) AS consumption,
      COALESCE(SUM(CASE WHEN is_paid AND concept_type IN ('PRODUCT', 'DAMAGE_CHARGE') THEN total ELSE 0 END), 0) AS product
    FROM shift_items
  )

  SELECT jsonb_build_object(
    'totalSales', (SELECT COUNT(*) FROM shift_sales),
    'totalAmount', (SELECT COALESCE(SUM(total), 0) FROM shift_items),
    'cashAmount', pt.cash_amount,
    'cardBBVA', pt.card_bbva,
    'cardGetnet', pt.card_getnet,
    'openRooms', orr.cnt,
    'completedCheckouts', (SELECT COUNT(*) FROM shift_sales WHERE status IN ('COMPLETED', 'ENDED')),
    'conceptBreakdown', jsonb_build_object(
      'ROOM_BASE', cb.room_base,
      'EXTRA_HOUR', cb.extra_hour,
      'EXTRA_PERSON', cb.extra_person,
      'CONSUMPTION', cb.consumption,
      'PRODUCT', cb.product
    )
  ) INTO v_result
  FROM payment_totals pt
  CROSS JOIN open_rooms orr
  CROSS JOIN concept_breakdown cb;

  RETURN v_result;
END;
$$;


-- 3. Redefine get_income_report (7 parameters) to negate values for CANCELADA stays
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
      -- Room price (exclude cancelled, negate if stay is cancelled)
      (COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type = 'ROOM_BASE'
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) * CASE WHEN fs.stay_status = 'CANCELADA' THEN -1 ELSE 1 END) AS room_price,
      -- Extras (exclude cancelled, negate if stay is cancelled)
      (COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('EXTRA_PERSON', 'EXTRA_HOUR', 'RENEWAL', 'PROMO_4H', 'DAMAGE_CHARGE', 'ROOM_CHANGE_ADJUSTMENT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) * CASE WHEN fs.stay_status = 'CANCELADA' THEN -1 ELSE 1 END) AS extra,
      -- Consumption (exclude cancelled, negate if stay is cancelled)
      (COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('CONSUMPTION', 'PRODUCT', 'RESTAURANT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) * CASE WHEN fs.stay_status = 'CANCELADA' THEN -1 ELSE 1 END) AS consumption,
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


-- 4. Redefine get_income_report (9 parameters - paginated) to negate values for CANCELADA stays
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
      -- Room price (exclude cancelled, negate if stay is cancelled)
      (COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type = 'ROOM_BASE'
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) * CASE WHEN fs.stay_status = 'CANCELADA' THEN -1 ELSE 1 END) AS room_price,
      -- Extras (exclude cancelled, negate if stay is cancelled)
      (COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('EXTRA_PERSON', 'EXTRA_HOUR', 'RENEWAL', 'PROMO_4H', 'DAMAGE_CHARGE', 'ROOM_CHANGE_ADJUSTMENT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) * CASE WHEN fs.stay_status = 'CANCELADA' THEN -1 ELSE 1 END) AS extra,
      -- Consumption (exclude cancelled, negate if stay is cancelled)
      (COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('CONSUMPTION', 'PRODUCT', 'RESTAURANT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) * CASE WHEN fs.stay_status = 'CANCELADA' THEN -1 ELSE 1 END) AS consumption,
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
