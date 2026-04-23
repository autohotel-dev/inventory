-- ==============================================================================
-- MIGRATION: Granular Receptionist KPIs and Checkout Tracking
-- Description:
-- 1. Adds checkout_shift_session_id to room_stays for precise attribution
-- 2. Retroactively links past checkouts to receptionists
-- 3. Updates process_checkout_transaction to automatically track the receptionist
-- 4. Rewrites get_receptionist_performance_kpis to query source-of-truth tables
-- ==============================================================================

-- 1. Add tracking column
ALTER TABLE room_stays 
ADD COLUMN IF NOT EXISTS checkout_shift_session_id UUID REFERENCES shift_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_room_stays_checkout_shift ON room_stays(checkout_shift_session_id);

-- 2. Retroactively assign checkout_shift_session_id using payments as a proxy
-- If a checkout happened, it usually involved a final payment. We use the shift session of the payment.
UPDATE room_stays rs
SET checkout_shift_session_id = p.shift_session_id
FROM payments p
WHERE rs.status = 'FINALIZADA'
  AND p.sales_order_id = rs.sales_order_id
  AND rs.checkout_shift_session_id IS NULL
  AND p.shift_session_id IS NOT NULL;

-- 3. Update checkout RPC to automatically capture the receptionist's session
CREATE OR REPLACE FUNCTION process_checkout_transaction(
  p_stay_id UUID,
  p_sales_order_id UUID,
  p_payment_data JSONB,
  p_checkout_valet_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_room_id UUID;
  v_stay_status TEXT;
  v_tolerance_started_at TIMESTAMPTZ;
  v_payment_record JSONB;
  v_main_payment_id UUID;
  v_checkout_shift_session_id UUID;
BEGIN
  -- Validate and Lock Stay
  SELECT room_id, status, tolerance_started_at 
  INTO v_room_id, v_stay_status, v_tolerance_started_at
  FROM room_stays 
  WHERE id = p_stay_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estancia no encontrada');
  END IF;

  IF v_stay_status = 'FINALIZADA' THEN
    RETURN jsonb_build_object('success', false, 'error', 'La estancia ya fue finalizada');
  END IF;

  -- Attempt to get shift session from the user performing the checkout
  SELECT id INTO v_checkout_shift_session_id 
  FROM shift_sessions 
  WHERE employee_id = (SELECT id FROM employees WHERE auth_user_id = auth.uid()) 
    AND status = 'ACTIVE' 
  LIMIT 1;

  -- Update Room Stay
  UPDATE room_stays
  SET 
    status = 'FINALIZADA',
    actual_check_out_at = NOW(),
    checkout_valet_employee_id = p_checkout_valet_id,
    checkout_shift_session_id = v_checkout_shift_session_id
  WHERE id = p_stay_id;

  -- Update Sales Order
  UPDATE sales_orders
  SET status = 'ENDED'
  WHERE id = p_sales_order_id;

  -- Update Room Status
  UPDATE rooms
  SET status = CASE 
    WHEN v_tolerance_started_at IS NOT NULL THEN 'OCUPADA'
    ELSE 'SUCIA'
  END
  WHERE id = v_room_id;

  -- Process Payments
  FOR v_payment_record IN SELECT * FROM jsonb_array_elements(p_payment_data)
  LOOP
    INSERT INTO payments (
      sales_order_id,
      amount,
      payment_method,
      reference,
      concept,
      status,
      payment_type,
      shift_session_id,
      parent_payment_id,
      terminal_code,
      card_last_4,
      card_type
    ) VALUES (
      (v_payment_record->>'sales_order_id')::UUID,
      (v_payment_record->>'amount')::NUMERIC,
      v_payment_record->>'payment_method',
      v_payment_record->>'reference',
      v_payment_record->>'concept',
      v_payment_record->>'status',
      v_payment_record->>'payment_type',
        CASE WHEN (v_payment_record->>'shift_session_id') IS NULL THEN NULL
             ELSE (v_payment_record->>'shift_session_id')::UUID END,
        CASE WHEN (v_payment_record->>'parent_payment_id') IS NULL THEN NULL 
             ELSE (v_payment_record->>'parent_payment_id')::UUID END,
      v_payment_record->>'terminal_code',
      v_payment_record->>'card_last_4',
      v_payment_record->>'card_type'
    );
  END LOOP;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

-- 4. Rewrite get_receptionist_performance_kpis to query source-of-truth tables
DROP FUNCTION IF EXISTS get_receptionist_performance_kpis(DATE, DATE);

CREATE OR REPLACE FUNCTION get_receptionist_performance_kpis(p_start_date DATE, p_end_date DATE)
RETURNS TABLE (
  employee_id UUID,
  employee_name TEXT,
  total_entries_processed INTEGER,
  total_exits_processed INTEGER,
  total_extras_charged INTEGER,
  total_revenue DECIMAL,
  anomalies_detected INTEGER,
  is_active BOOLEAN
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id AS employee_id,
    e.first_name || ' ' || e.last_name AS employee_name,
    
    -- Entradas: Conteo de estancias registradas en su turno activo
    (SELECT COUNT(rs.id)::INTEGER 
     FROM room_stays rs 
     JOIN shift_sessions ss ON rs.shift_session_id = ss.id 
     WHERE ss.employee_id = e.id 
       AND rs.check_in_at IS NOT NULL
       AND DATE(rs.check_in_at) BETWEEN p_start_date AND p_end_date) AS total_entries_processed,
       
    -- Salidas: Conteo de estancias finalizadas vinculadas a su turno de checkout
    (SELECT COUNT(rs.id)::INTEGER 
     FROM room_stays rs 
     JOIN shift_sessions ss ON rs.checkout_shift_session_id = ss.id 
     WHERE ss.employee_id = e.id 
       AND rs.actual_check_out_at IS NOT NULL
       AND rs.status = 'FINALIZADA'
       AND DATE(rs.actual_check_out_at) BETWEEN p_start_date AND p_end_date) AS total_exits_processed,
       
    -- Extras Cobrados: Conteo de pagos de tipo extras asociados a su id de empleado
    (SELECT COUNT(p.id)::INTEGER 
     FROM payments p 
     WHERE p.collected_by = e.id 
       AND p.concept IN ('EXTRA_HOUR', 'PERSONA_EXTRA', 'RENEWAL', 'DAMAGE_CHARGE') 
       AND p.status = 'PAGADO'
       AND DATE(p.created_at) BETWEEN p_start_date AND p_end_date) AS total_extras_charged,
       
    -- Ingresos Totales: Suma del dinero recolectado directamente de la tabla payments
    (SELECT COALESCE(SUM(amount), 0)::DECIMAL 
     FROM payments p 
     WHERE p.collected_by = e.id 
       AND p.status = 'PAGADO'
       AND DATE(p.created_at) BETWEEN p_start_date AND p_end_date) AS total_revenue,
       
    -- Anomalías: Buscar anomalias ligadas a los cobros de este empleado
    (SELECT COUNT(dpa.payment_id)::INTEGER 
     FROM detect_payment_anomalies() dpa 
     JOIN payments p ON p.id = dpa.payment_id
     WHERE p.collected_by = e.id) AS anomalies_detected,
     
    (e.deleted_at IS NULL) AS is_active
  FROM employees e
  LEFT JOIN roles r ON r.id = e.role_id
  WHERE LOWER(e.role) IN ('receptionist', 'recepcionista') OR LOWER(r.name) IN ('receptionist', 'recepcionista')
  GROUP BY e.id, e.first_name, e.last_name, e.deleted_at;
END;
$$;
