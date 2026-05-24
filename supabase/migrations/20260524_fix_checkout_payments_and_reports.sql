-- Migration: Sincronización de pagos y corrección de reportes de ingresos
-- Target: public.enforce_active_shift_on_payment, public.get_shift_dashboard_summary, public.get_income_report (7 and 9 parameters)

-- 1. Sincronizar employee_id y shift_session_id en INSERT o UPDATE
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
  -- Ignorar validación para pagos de cochero/valet (usan su propio turno)
  IF NEW.status IN ('COBRADO_POR_VALET', 'CORROBORADO_RECEPCION') THEN
    RETURN NEW;
  END IF;

  -- 1. Si se provee un shift_session_id, verificar su dueño y estado
  IF NEW.shift_session_id IS NOT NULL THEN
    SELECT status, employee_id INTO v_shift_status, v_active_employee_id
    FROM public.shift_sessions
    WHERE id = NEW.shift_session_id;
    
    IF v_active_employee_id IS NOT NULL THEN
      -- Asegurar la sincronización del employee_id con el dueño del turno
      NEW.employee_id := v_active_employee_id;
      
      -- En inserción o cambio explícito de turno, si está activo/abierto, mantener
      IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.shift_session_id IS DISTINCT FROM NEW.shift_session_id) THEN
        IF v_shift_status IN ('active', 'open') THEN
          RETURN NEW;
        END IF;
        -- Si está cerrado, reasignar al activo si es INSERT o si era NULL en UPDATE
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.shift_session_id IS NULL) THEN
          -- fall through
        ELSE
          -- Si es UPDATE de auditoría histórica con turno ya puesto, mantener
          RETURN NEW;
        END IF;
      ELSE
        RETURN NEW;
      END IF;
    END IF;
  END IF;
  
  -- 2. Buscar el turno activo de recepción
  SELECT ss.id, ss.employee_id INTO v_active_shift_id, v_active_employee_id
  FROM public.shift_sessions ss
  JOIN public.employees e ON ss.employee_id = e.id
  WHERE ss.status IN ('active', 'open')
    AND e.role IN ('receptionist', 'admin', 'manager')
  ORDER BY ss.clock_in_at DESC
  LIMIT 1;
  
  -- 3. Asignar si se encuentra
  IF v_active_shift_id IS NOT NULL THEN
    NEW.shift_session_id := v_active_shift_id;
    NEW.employee_id := v_active_employee_id;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Cambiar el trigger para que se ejecute en BEFORE INSERT OR UPDATE
DROP TRIGGER IF EXISTS trg_enforce_active_shift_on_payment ON public.payments;
CREATE TRIGGER trg_enforce_active_shift_on_payment
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_active_shift_on_payment();


-- 2. Redefinir get_shift_dashboard_summary para evitar filtros de created_by si p_session_id es proveído
-- Además, excluye las habitaciones 13 y 113 para coherencia con el corte impreso.
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
  -- Determinar fecha de inicio
  IF p_session_id IS NOT NULL THEN
    SELECT clock_in_at INTO v_start_date
    FROM public.shift_sessions WHERE id = p_session_id;
  END IF;

  IF v_start_date IS NULL THEN
    v_start_date := date_trunc('day', now());
  END IF;

  WITH
  -- Ventas (excluir habitaciones 13/113 y aplicar filtro de usuario solo si no hay sesión activa)
  shift_sales AS (
    SELECT so.id, so.total, so.status
    FROM public.sales_orders so
    LEFT JOIN public.room_stays rs ON rs.sales_order_id = so.id
    LEFT JOIN public.rooms rm ON rm.id = rs.room_id
    WHERE 
      ((p_session_id IS NOT NULL AND so.shift_session_id = p_session_id)
       OR (p_session_id IS NULL AND so.created_at >= v_start_date AND (p_include_global OR so.created_by = p_user_id)))
      AND (rm.number IS NULL OR rm.number NOT IN ('13', '113'))
  ),

  -- Pagos (excluir habitaciones 13/113 y aplicar filtro de usuario solo si no hay sesión activa)
  shift_payments AS (
    SELECT p.amount, p.payment_method, p.terminal_code, p.status, p.concept
    FROM public.payments p
    LEFT JOIN public.sales_orders so ON so.id = p.sales_order_id
    LEFT JOIN public.room_stays rs ON rs.sales_order_id = so.id
    LEFT JOIN public.rooms rm ON rm.id = rs.room_id
    WHERE 
      ((p_session_id IS NOT NULL AND p.shift_session_id = p_session_id)
       OR (p_session_id IS NULL AND p.created_at >= v_start_date AND (p_include_global OR p.created_by = p_user_id)))
      AND (p.status = 'PAGADO' OR (p.status = 'CANCELADO' AND p.concept = 'REFUND'))
      AND (rm.number IS NULL OR rm.number NOT IN ('13', '113'))
  ),

  -- Habitaciones ocupadas
  open_rooms AS (
    SELECT COUNT(*) AS cnt FROM public.rooms WHERE status = 'OCUPADA'
  ),

  -- Conceptos devengados (excluyendo cancelados y habitaciones 13/113)
  shift_items AS (
    SELECT soi.concept_type, soi.total, soi.is_paid
    FROM public.sales_order_items soi
    LEFT JOIN public.sales_orders so ON so.id = soi.sales_order_id
    LEFT JOIN public.room_stays rs ON rs.sales_order_id = so.id
    LEFT JOIN public.rooms rm ON rm.id = rs.room_id
    WHERE 
      ((p_session_id IS NOT NULL AND soi.shift_session_id = p_session_id)
       OR (p_session_id IS NULL AND soi.created_at >= v_start_date))
      AND soi.is_cancelled IS NOT TRUE
      AND (rm.number IS NULL OR rm.number NOT IN ('13', '113'))
  ),

  -- Calcular totales por método de pago
  payment_totals AS (
    SELECT
      COALESCE(SUM(CASE 
        WHEN payment_method = 'EFECTIVO' AND status = 'CANCELADO' AND concept = 'REFUND' THEN -amount
        WHEN payment_method = 'EFECTIVO' AND status = 'PAGADO' THEN amount
        ELSE 0 
      END), 0) AS cash_amount,
      COALESCE(SUM(CASE
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

  -- Desglose por concepto
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


-- 3. Redefinir get_income_report (7 parámetros) con lógica de reembolso precisa
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
  -- 1. Resolver información de turno si aplica
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

    -- Obtener órdenes del turno (incluyendo cobros normales y reembolsos cancelados)
    SELECT ARRAY_AGG(DISTINCT soid) INTO v_sales_order_ids
    FROM (
      SELECT sales_order_id AS soid FROM public.sales_order_items WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND is_cancelled IS NOT TRUE
      UNION
      SELECT sales_order_id AS soid FROM public.payments WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND (status NOT IN ('PENDIENTE', 'CANCELADO') OR (status = 'CANCELADO' AND concept = 'REFUND'))
    ) sub;
  END IF;

  -- 2. Construir entradas
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
      -- Habitación: Sumar base y restar reembolsos reales asignados a este reporte/turno
      (COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type = 'ROOM_BASE'
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) - COALESCE((
        SELECT SUM(amount)
        FROM public.payments p_ref
        WHERE p_ref.sales_order_id = fs.sales_order_id
          AND p_ref.status = 'CANCELADO'
          AND p_ref.concept = 'REFUND'
          AND (
            CASE
              WHEN p_report_type = 'shift' AND v_session_id IS NOT NULL
                THEN p_ref.shift_session_id = v_session_id
              WHEN p_report_type = 'dateRange' THEN
                (p_start_date IS NULL OR p_ref.created_at >= p_start_date)
                AND (p_end_date IS NULL OR p_ref.created_at <= (p_end_date + interval '1 day' - interval '1 millisecond'))
              ELSE true
            END
          )
      ), 0)) AS room_price,
      -- Extras
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('EXTRA_PERSON', 'EXTRA_HOUR', 'RENEWAL', 'PROMO_4H', 'DAMAGE_CHARGE', 'ROOM_CHANGE_ADJUSTMENT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS extra,
      -- Consumos
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('CONSUMPTION', 'PRODUCT', 'RESTAURANT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS consumption,
      -- Método de pago (incluyendo reembolsos)
      (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 'PENDIENTE'
          WHEN COUNT(DISTINCT p2.payment_method) > 1 THEN 'MIXTO'
          ELSE MIN(p2.payment_method)
        END
        FROM public.payments p2
        WHERE p2.sales_order_id = fs.sales_order_id
          AND (p2.status <> 'PENDIENTE' AND (p2.status <> 'CANCELADO' OR p2.concept = 'REFUND'))
          AND UPPER(COALESCE(p2.concept, '')) <> 'CHECKOUT'
          AND p2.payment_method <> 'PENDIENTE'
          AND (v_session_id IS NULL OR p2.shift_session_id = v_session_id)
      ) AS payment_method,
      -- Detalles de tarjeta
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
      -- Array de pagos detallados (incluyendo reembolsos negativos y quitando DISTINCT ON)
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'payment_method', p4.payment_method,
          'amount', CASE WHEN p4.concept = 'REFUND' THEN -p4.amount ELSE p4.amount END,
          'card_type', p4.card_type,
          'card_last_4', p4.card_last_4,
          'terminal_code', p4.terminal_code
        )), '[]'::jsonb)
        FROM (
          SELECT p4i.*
          FROM public.payments p4i
          WHERE p4i.sales_order_id = fs.sales_order_id
            AND (p4i.status <> 'PENDIENTE' AND (p4i.status <> 'CANCELADO' OR p4i.concept = 'REFUND'))
            AND UPPER(COALESCE(p4i.concept, '')) <> 'CHECKOUT'
            AND p4i.payment_method <> 'PENDIENTE'
            AND (v_session_id IS NULL OR p4i.shift_session_id = v_session_id)
          ORDER BY p4i.created_at ASC
        ) p4
      ) AS payments_detail
    FROM filtered_stays fs
  ),

  numbered AS (
    SELECT
      ROW_NUMBER() OVER (ORDER BY se.check_in_at ASC) AS row_no,
      se.*
    FROM stay_entries se
  ),

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


-- 4. Redefinir get_income_report (9 parámetros - paginado) con soporte de reembolsos y sin DISTINCT ON
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

  -- 1. Resolver información de turno si aplica
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

    -- Obtener órdenes del turno (incluyendo cobros normales y reembolsos cancelados)
    SELECT ARRAY_AGG(DISTINCT soid) INTO v_sales_order_ids
    FROM (
      SELECT sales_order_id AS soid FROM public.sales_order_items WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND is_cancelled IS NOT TRUE
      UNION
      SELECT sales_order_id AS soid FROM public.payments WHERE shift_session_id = v_session_id AND sales_order_id IS NOT NULL AND (status NOT IN ('PENDIENTE', 'CANCELADO') OR (status = 'CANCELADO' AND concept = 'REFUND'))
    ) sub;
  END IF;

  -- 2. Crear tabla temporal
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
      -- Habitación: Sumar base y restar reembolsos reales asignados a este reporte/turno
      (COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type = 'ROOM_BASE'
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) - COALESCE((
        SELECT SUM(amount)
        FROM public.payments p_ref
        WHERE p_ref.sales_order_id = fs.sales_order_id
          AND p_ref.status = 'CANCELADO'
          AND p_ref.concept = 'REFUND'
          AND (
            CASE
              WHEN p_report_type = 'shift' AND v_session_id IS NOT NULL
                THEN p_ref.shift_session_id = v_session_id
              WHEN p_report_type = 'dateRange' THEN
                (p_start_date IS NULL OR p_ref.created_at >= p_start_date)
                AND (p_end_date IS NULL OR p_ref.created_at <= (p_end_date + interval '1 day' - interval '1 millisecond'))
              ELSE true
            END
          )
      ), 0)) AS room_price,
      -- Extras
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('EXTRA_PERSON', 'EXTRA_HOUR', 'RENEWAL', 'PROMO_4H', 'DAMAGE_CHARGE', 'ROOM_CHANGE_ADJUSTMENT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS extra,
      -- Consumos
      COALESCE((
        SELECT SUM(soi.unit_price * soi.qty)
        FROM public.sales_order_items soi
        WHERE soi.sales_order_id = fs.sales_order_id
          AND soi.concept_type IN ('CONSUMPTION', 'PRODUCT', 'RESTAURANT')
          AND soi.is_cancelled IS NOT TRUE
          AND (v_session_id IS NULL OR soi.shift_session_id = v_session_id)
      ), 0) AS consumption,
      -- Método de pago (incluyendo reembolsos)
      (
        SELECT CASE
          WHEN COUNT(*) = 0 THEN 'PENDIENTE'
          WHEN COUNT(DISTINCT p2.payment_method) > 1 THEN 'MIXTO'
          ELSE MIN(p2.payment_method)
        END
        FROM public.payments p2
        WHERE p2.sales_order_id = fs.sales_order_id
          AND (p2.status <> 'PENDIENTE' AND (p2.status <> 'CANCELADO' OR p2.concept = 'REFUND'))
          AND UPPER(COALESCE(p2.concept, '')) <> 'CHECKOUT'
          AND p2.payment_method <> 'PENDIENTE'
          AND (v_session_id IS NULL OR p2.shift_session_id = v_session_id)
      ) AS payment_method,
      -- Detalles de tarjeta
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
      -- Array de pagos detallados (incluyendo reembolsos negativos y quitando DISTINCT ON)
      (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'payment_method', p4.payment_method,
          'amount', CASE WHEN p4.concept = 'REFUND' THEN -p4.amount ELSE p4.amount END,
          'card_type', p4.card_type,
          'card_last_4', p4.card_last_4,
          'terminal_code', p4.terminal_code
        )), '[]'::jsonb)
        FROM (
          SELECT p4i.*
          FROM public.payments p4i
          WHERE p4i.sales_order_id = fs.sales_order_id
            AND (p4i.status <> 'PENDIENTE' AND (p4i.status <> 'CANCELADO' OR p4i.concept = 'REFUND'))
            AND UPPER(COALESCE(p4i.concept, '')) <> 'CHECKOUT'
            AND p4i.payment_method <> 'PENDIENTE'
            AND (v_session_id IS NULL OR p4i.shift_session_id = v_session_id)
          ORDER BY p4i.created_at ASC
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

  -- 3. Calcular totales
  SELECT
    COUNT(*),
    COALESCE(SUM(room_price), 0),
    COALESCE(SUM(extra), 0),
    COALESCE(SUM(consumption), 0)
  INTO v_total_count, v_total_room_price, v_total_extra, v_total_consumption
  FROM tmp_filtered_entries;

  -- 4. Construir respuesta JSON
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

  -- 5. Limpieza
  DROP TABLE IF EXISTS tmp_filtered_entries;

  RETURN v_result;
END;
$$;

-- Recargar cache del esquema REST
NOTIFY pgrst, 'reload schema';
