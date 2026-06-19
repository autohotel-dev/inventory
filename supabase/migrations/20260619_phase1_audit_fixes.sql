-- Migration: Phase 1 Audit Fixes
-- Fixes 4 critical issues identified in the shift closing audit:
-- 1. process_cancel_stay: refund payments missing shift_session_id
-- 2. get_income_report: DAMAGE_CHARGE grouped into extra instead of its own column
-- 3. get_income_report: missing expenses and employee charges for pre-corte
-- 4. shift_closings: missing UNIQUE constraint on shift_session_id

-- ═══════════════════════════════════════════════════════════════════
-- FIX #1: process_cancel_stay — add shift_session_id to refund INSERT
-- Without this, refund payments are invisible to get_shift_closing_summary
-- which filters by shift_session_id, causing "phantom money" in closings.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.process_cancel_stay(
  p_room_stay_id UUID,
  p_room_id UUID,
  p_sales_order_id UUID,
  p_reason TEXT,
  p_refund_type TEXT DEFAULT 'none',
  p_refund_amount NUMERIC DEFAULT 0
)
RETURNS JSONB
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
  v_current_employee_id UUID;
  v_current_session_id UUID;
BEGIN
  -- Resolve current employee and active session
  SELECT id INTO v_current_employee_id
  FROM public.employees WHERE auth_user_id = auth.uid();

  SELECT id INTO v_current_session_id
  FROM public.shift_sessions
  WHERE employee_id = v_current_employee_id AND status = 'active'
  ORDER BY clock_in_at DESC LIMIT 1;

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
      is_cancelled = true,
      cancelled_at = NOW(),
      cancellation_reason = 'Cancelación de estancia: ' || COALESCE(p_reason, ''),
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
  -- FIX: Now includes shift_session_id and employee_id so the refund
  -- is visible to get_shift_closing_summary
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
      collected_by,
      employee_id,
      shift_session_id
    ) VALUES (
      p_sales_order_id,
      v_refund_val,
      'EFECTIVO',
      'REF-' || substr(md5(random()::text), 1, 8),
      'REFUND',
      'CANCELADO',
      'COMPLETO',
      'Reembolso por cancelación de estancia: ' || COALESCE(p_reason, ''),
      v_current_employee_id,
      v_current_employee_id,
      v_current_session_id
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


-- ═══════════════════════════════════════════════════════════════════
-- FIX #2 + #3: get_income_report
-- - Separates DAMAGE_CHARGE from 'extra' into its own 'damage' column
-- - Adds expenses and employee charges to the response for pre-corte
-- ═══════════════════════════════════════════════════════════════════

-- Drop the old 7-param version if it exists (the 9-param version supersedes it)
DROP FUNCTION IF EXISTS public.get_income_report(text, uuid, timestamptz, timestamptz, text, text, text);

CREATE OR REPLACE FUNCTION public.get_income_report(
  p_report_type text,
  p_shift_id uuid DEFAULT NULL,
  p_start_date timestamptz DEFAULT NULL,
  p_end_date timestamptz DEFAULT NULL,
  p_payment_method_filter text DEFAULT 'all',
  p_room_filter text DEFAULT 'all',
  p_status_filter text DEFAULT 'all',
  p_page integer DEFAULT 1,
  p_page_size integer DEFAULT 50
)
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
  v_total_damage NUMERIC := 0;
  v_total_count INT := 0;
  v_offset INT := 0;
BEGIN
  IF p_page_size IS NOT NULL AND p_page_size > 0 THEN
    v_offset := (p_page - 1) * p_page_size;
  END IF;

  IF p_report_type = 'shift' AND p_shift_id IS NOT NULL THEN
    SELECT sc.shift_session_id, sc.period_start, sc.period_end,
           COALESCE(e.first_name || ' ' || e.last_name, 'Desconocido')
    INTO v_session_id, v_shift_start, v_shift_end, v_employee_name
    FROM public.shift_closings sc
    LEFT JOIN public.employees e ON e.id = sc.employee_id
    WHERE sc.id = p_shift_id;

    IF v_session_id IS NULL THEN
      SELECT ss.id, ss.clock_in_at, ss.clock_out_at,
             COALESCE(e.first_name || ' ' || e.last_name, 'Desconocido')
      INTO v_session_id, v_shift_start, v_shift_end, v_employee_name
      FROM public.shift_sessions ss
      LEFT JOIN public.employees e ON e.id = ss.employee_id
      WHERE ss.id = p_shift_id;
    END IF;

    SELECT ARRAY_AGG(DISTINCT soid) INTO v_sales_order_ids
    FROM (
      SELECT sales_order_id AS soid FROM public.sales_order_items WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND is_cancelled IS NOT TRUE
      UNION
      SELECT sales_order_id AS soid FROM public.payments WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND (status NOT IN ('PENDIENTE', 'CANCELADO') OR (status = 'CANCELADO' AND concept = 'REFUND')) AND UPPER(COALESCE(concept, '')) <> 'CHECKOUT'
    ) sub;
  END IF;

  DROP TABLE IF EXISTS tmp_filtered_entries;
  CREATE TEMP TABLE tmp_filtered_entries AS
  WITH
  filtered_stays AS (
    SELECT
      rs.id AS stay_id, rs.check_in_at, rs.vehicle_plate, rs.status AS stay_status,
      rs.sales_order_id, rm.number AS room_number,
      COALESCE(ev.first_name || ' ' || ev.last_name, '—') AS checkout_valet_name,
      COALESCE(ev_in.first_name || ' ' || ev_in.last_name, '—') AS checkin_valet_name,
      COALESCE(
        (SELECT COALESCE(ep.first_name || ' ' || ep.last_name, NULL)
         FROM public.payments pp
         LEFT JOIN public.employees ep ON ep.id = pp.employee_id
         WHERE pp.sales_order_id = rs.sales_order_id
           AND (pp.status <> 'PENDIENTE' AND (pp.status <> 'CANCELADO' OR pp.concept = 'REFUND'))
           AND UPPER(COALESCE(pp.concept, '')) <> 'CHECKOUT'
           AND pp.payment_method <> 'PENDIENTE'
           AND (v_session_id IS NULL OR pp.shift_session_id = v_session_id)
         ORDER BY pp.amount DESC
         LIMIT 1),
        COALESCE(e_in.first_name || ' ' || e_in.last_name, '—')
      ) AS receptionist_name,
      COALESCE(sd.name, '—') AS shift_name
    FROM public.room_stays rs
    JOIN public.rooms rm ON rm.id = rs.room_id
    LEFT JOIN public.employees ev ON ev.id = rs.checkout_valet_employee_id
    LEFT JOIN public.employees ev_in ON ev_in.id = rs.valet_employee_id
    LEFT JOIN public.shift_sessions ss_in ON rs.shift_session_id = ss_in.id
    LEFT JOIN public.employees e_in ON e_in.id = ss_in.employee_id
    LEFT JOIN public.shift_definitions sd ON sd.id = ss_in.shift_definition_id
    WHERE
      rm.number NOT IN ('13', '113')
      AND (CASE WHEN p_status_filter = 'all' OR p_status_filter IS NULL THEN rs.status IN ('ACTIVA', 'FINALIZADA', 'CANCELADA') ELSE rs.status = p_status_filter END)
      AND (CASE WHEN p_report_type = 'shift' AND v_sales_order_ids IS NOT NULL THEN rs.sales_order_id = ANY(v_sales_order_ids) WHEN p_report_type = 'dateRange' THEN (p_start_date IS NULL OR rs.check_in_at >= p_start_date) AND (p_end_date IS NULL OR rs.check_in_at <= (p_end_date + interval '1 day' - interval '1 millisecond')) ELSE true END)
  ),
  stay_entries AS (
    SELECT
      fs.stay_id, fs.check_in_at, fs.vehicle_plate, fs.room_number, fs.stay_status,
      fs.checkout_valet_name, fs.checkin_valet_name, fs.receptionist_name, fs.shift_name,
      (COALESCE((SELECT SUM(soi.unit_price * soi.qty) FROM public.sales_order_items soi WHERE soi.sales_order_id = fs.sales_order_id AND soi.concept_type = 'ROOM_BASE' AND soi.is_cancelled IS NOT TRUE AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)), 0) - COALESCE((SELECT SUM(amount) FROM public.payments p_ref WHERE p_ref.sales_order_id = fs.sales_order_id AND p_ref.status = 'CANCELADO' AND p_ref.concept = 'REFUND' AND (CASE WHEN p_report_type = 'shift' AND v_session_id IS NOT NULL THEN p_ref.shift_session_id = v_session_id WHEN p_report_type = 'dateRange' THEN (p_start_date IS NULL OR p_ref.created_at >= p_start_date) AND (p_end_date IS NULL OR p_ref.created_at <= (p_end_date + interval '1 day' - interval '1 millisecond')) ELSE true END)), 0)) AS room_price,
      -- FIX #2: DAMAGE_CHARGE separated from extra into its own column
      COALESCE((SELECT SUM(soi.unit_price * soi.qty) FROM public.sales_order_items soi WHERE soi.sales_order_id = fs.sales_order_id AND soi.concept_type IN ('EXTRA_PERSON', 'EXTRA_HOUR', 'RENEWAL', 'PROMO_4H', 'ROOM_CHANGE_ADJUSTMENT') AND soi.is_cancelled IS NOT TRUE AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)), 0) AS extra,
      COALESCE((SELECT SUM(soi.unit_price * soi.qty) FROM public.sales_order_items soi WHERE soi.sales_order_id = fs.sales_order_id AND soi.concept_type IN ('CONSUMPTION', 'PRODUCT', 'RESTAURANT') AND soi.is_cancelled IS NOT TRUE AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)), 0) AS consumption,
      COALESCE((SELECT SUM(soi.unit_price * soi.qty) FROM public.sales_order_items soi WHERE soi.sales_order_id = fs.sales_order_id AND soi.concept_type = 'DAMAGE_CHARGE' AND soi.is_cancelled IS NOT TRUE AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)), 0) AS damage,
      (SELECT CASE WHEN COUNT(*) = 0 THEN 'PENDIENTE' WHEN COUNT(DISTINCT p2.payment_method) > 1 THEN 'MIXTO' ELSE MIN(p2.payment_method) END FROM public.payments p2 WHERE p2.sales_order_id = fs.sales_order_id AND (p2.status <> 'PENDIENTE' AND (p2.status <> 'CANCELADO' OR p2.concept = 'REFUND')) AND UPPER(COALESCE(p2.concept, '')) <> 'CHECKOUT' AND p2.payment_method <> 'PENDIENTE' AND (v_session_id IS NULL OR p2.shift_session_id = v_session_id)) AS payment_method,
      (SELECT jsonb_build_object('card_type', p3.card_type, 'card_last_4', p3.card_last_4, 'terminal_code', p3.terminal_code) FROM public.payments p3 WHERE p3.sales_order_id = fs.sales_order_id AND p3.payment_method = 'TARJETA' AND p3.status <> 'PENDIENTE' AND p3.status <> 'CANCELADO' AND (v_session_id IS NULL OR p3.shift_session_id = v_session_id) LIMIT 1) AS card_details,
      (SELECT COALESCE(jsonb_agg(jsonb_build_object('payment_method', p4.payment_method, 'amount', CASE WHEN p4.concept = 'REFUND' THEN -p4.amount ELSE p4.amount END, 'card_type', p4.card_type, 'card_last_4', p4.card_last_4, 'terminal_code', p4.terminal_code)), '[]'::jsonb) FROM (SELECT p4i.* FROM public.payments p4i WHERE p4i.sales_order_id = fs.sales_order_id AND (p4i.status <> 'PENDIENTE' AND (p4i.status <> 'CANCELADO' OR p4i.concept = 'REFUND')) AND UPPER(COALESCE(p4i.concept, '')) <> 'CHECKOUT' AND p4i.payment_method <> 'PENDIENTE' AND (v_session_id IS NULL OR p4i.shift_session_id = v_session_id) ORDER BY p4i.created_at ASC) p4) AS payments_detail
    FROM filtered_stays fs
  ),
  numbered AS (SELECT ROW_NUMBER() OVER (ORDER BY se.check_in_at ASC) AS row_no, se.* FROM stay_entries se)
  SELECT * FROM numbered
  WHERE (p_payment_method_filter = 'all' OR p_payment_method_filter IS NULL OR payment_method = p_payment_method_filter)
    AND (p_room_filter = 'all' OR p_room_filter IS NULL OR room_number = p_room_filter);

  -- Calculate totals including new damage column
  SELECT COUNT(*), COALESCE(SUM(room_price), 0), COALESCE(SUM(extra), 0), COALESCE(SUM(consumption), 0), COALESCE(SUM(damage), 0)
  INTO v_total_count, v_total_room_price, v_total_extra, v_total_consumption, v_total_damage
  FROM tmp_filtered_entries;

  SELECT jsonb_build_object(
    'totalCount', v_total_count,
    'totals', jsonb_build_object(
      'roomPrice', v_total_room_price,
      'extra', v_total_extra,
      'consumption', v_total_consumption,
      'damage', v_total_damage,
      'total', v_total_room_price + v_total_extra + v_total_consumption + v_total_damage
    ),
    'entries', COALESCE((SELECT jsonb_agg(jsonb_build_object(
      'no', fe.row_no, 'time', to_char(fe.check_in_at AT TIME ZONE 'America/Mexico_City', 'HH24:MI'),
      'vehicle_plate', COALESCE(fe.vehicle_plate, ''), 'room_number', fe.room_number,
      'room_price', fe.room_price, 'extra', fe.extra, 'consumption', fe.consumption,
      'damage', fe.damage,
      'total', fe.room_price + fe.extra + fe.consumption + fe.damage,
      'payment_method', fe.payment_method,
      'card_type', fe.card_details->>'card_type', 'card_last_4', fe.card_details->>'card_last_4',
      'terminal_code', fe.card_details->>'terminal_code',
      'stay_status', fe.stay_status, 'checkout_valet_name', fe.checkout_valet_name,
      'checkin_valet_name', fe.checkin_valet_name, 'receptionist_name', fe.receptionist_name,
      'shift_name', fe.shift_name, 'payments', fe.payments_detail
    ) ORDER BY fe.row_no) FROM (SELECT * FROM tmp_filtered_entries ORDER BY row_no ASC LIMIT CASE WHEN p_page_size IS NULL OR p_page_size <= 0 THEN NULL ELSE p_page_size END OFFSET v_offset) fe), '[]'::jsonb),
    'shiftInfo', CASE WHEN p_report_type = 'shift' THEN jsonb_build_object('shift_start', v_shift_start, 'shift_end', v_shift_end, 'employee_name', v_employee_name) ELSE NULL END,
    'currentShift', (SELECT jsonb_build_object('employee_name', COALESCE(e.first_name || ' ' || e.last_name, 'Desconocido')) FROM public.shift_sessions ss LEFT JOIN public.employees e ON e.id = ss.employee_id WHERE ss.status = 'active' LIMIT 1),
    -- FIX #3: Add expenses and employee charges for pre-corte visibility
    'expenses', CASE WHEN p_report_type = 'shift' AND v_session_id IS NOT NULL THEN
      COALESCE((SELECT jsonb_agg(row_to_json(se)::jsonb ORDER BY se.created_at DESC)
        FROM public.shift_expenses se
        WHERE se.shift_session_id = v_session_id AND se.status <> 'rejected'), '[]'::jsonb)
      ELSE '[]'::jsonb END,
    'totalExpenses', CASE WHEN p_report_type = 'shift' AND v_session_id IS NOT NULL THEN
      COALESCE((SELECT SUM(se.amount) FROM public.shift_expenses se
        WHERE se.shift_session_id = v_session_id AND se.status <> 'rejected'), 0)
      ELSE 0 END,
    'employeeCharges', CASE WHEN p_report_type = 'shift' AND v_session_id IS NOT NULL THEN
      COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', sec.id, 'charge_type', sec.charge_type, 'description', sec.description,
        'unit_price', sec.unit_price, 'quantity', sec.quantity, 'subtotal', sec.subtotal,
        'discount_amount', sec.discount_amount, 'total', sec.total,
        'payment_method', sec.payment_method, 'notes', sec.notes, 'created_at', sec.created_at,
        'charged_employee', jsonb_build_object('first_name', emp.first_name, 'last_name', emp.last_name)
      ) ORDER BY sec.created_at ASC)
        FROM public.shift_employee_charges sec
        LEFT JOIN public.employees emp ON emp.id = sec.charged_to
        WHERE sec.shift_session_id = v_session_id AND sec.status <> 'rejected'), '[]'::jsonb)
      ELSE '[]'::jsonb END,
    'totalEmployeeCharges', CASE WHEN p_report_type = 'shift' AND v_session_id IS NOT NULL THEN
      COALESCE((SELECT SUM(sec.total) FROM public.shift_employee_charges sec
        WHERE sec.shift_session_id = v_session_id AND sec.status <> 'rejected'), 0)
      ELSE 0 END,
    'totalEmployeeChargesCash', CASE WHEN p_report_type = 'shift' AND v_session_id IS NOT NULL THEN
      COALESCE((SELECT SUM(sec.total) FROM public.shift_employee_charges sec
        WHERE sec.shift_session_id = v_session_id AND sec.status <> 'rejected' AND sec.payment_method = 'CASH'), 0)
      ELSE 0 END
  ) INTO v_result;

  DROP TABLE IF EXISTS tmp_filtered_entries;
  RETURN v_result;
END;
$$;


-- ═══════════════════════════════════════════════════════════════════
-- FIX #4: Add UNIQUE constraint on shift_closings(shift_session_id)
-- Prevents duplicate closings for the same shift session.
-- Uses a partial index to only enforce on non-correction closings.
-- ═══════════════════════════════════════════════════════════════════

CREATE UNIQUE INDEX IF NOT EXISTS idx_shift_closings_unique_session
  ON public.shift_closings (shift_session_id)
  WHERE is_correction IS NOT TRUE;


-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
