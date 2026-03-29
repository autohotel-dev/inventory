-- Función robusta para procesar horas extra de forma atómica
CREATE OR REPLACE FUNCTION process_extra_hours_v2(
  p_stay_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_sales_order_id UUID;
  v_expected_check_out_at TIMESTAMPTZ;
  v_extra_hour_price DECIMAL;
  v_shift_session_id UUID;
  v_service_product_id UUID;
  v_hours_added INTEGER := 0;
  v_now TIMESTAMPTZ := NOW();
  v_exit_tolerance_interval INTERVAL := INTERVAL '30 minutes';
  v_current_expected TIMESTAMPTZ;
BEGIN
  -- 1. Validar y Bloquear la estancia para evitar que otra pestaña haga lo mismo
  SELECT 
    rs.sales_order_id, 
    rs.expected_check_out_at, 
    rt.extra_hour_price
  INTO 
    v_sales_order_id, 
    v_current_expected, 
    v_extra_hour_price
  FROM room_stays rs
  JOIN rooms r ON rs.room_id = r.id
  JOIN room_types rt ON r.room_type_id = rt.id
  WHERE rs.id = p_stay_id AND rs.status = 'ACTIVA'
  FOR UPDATE; -- Bloqueo de concurrencia

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Estancia no encontrada o no activa');
  END IF;

  -- 2. Obtener el turno de recepción activo (para asociar los pagos)
  SELECT ss.id INTO v_shift_session_id
  FROM shift_sessions ss
  JOIN employees e ON ss.employee_id = e.id
  WHERE ss.status IN ('active', 'open')
    AND e.role IN ('receptionist', 'admin', 'manager')
  ORDER BY ss.clock_in_at DESC
  LIMIT 1;

  -- 3. Obtener el ID del producto de servicio (SKU: SVC-001)
  SELECT id INTO v_service_product_id 
  FROM products 
  WHERE sku = 'SVC-001' 
  LIMIT 1;

  IF v_service_product_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Producto de servicio (SVC-001) no encontrado');
  END IF;

  -- 4. Bucle de puesta al día (Catch-up)
  WHILE v_now > v_current_expected + v_exit_tolerance_interval LOOP
    -- A. Insertar Item en la orden de venta
    INSERT INTO sales_order_items (
      sales_order_id,
      product_id,
      qty,
      unit_price,
      total,
      concept_type,
      is_paid,
      delivery_status
    ) VALUES (
      v_sales_order_id,
      v_service_product_id,
      1,
      v_extra_hour_price,
      v_extra_hour_price,
      'EXTRA_HOUR',
      false,
      'PENDING_VALET'
    );

    -- B. Insertar Registro de Pago Pendiente
    INSERT INTO payments (
      sales_order_id,
      amount,
      payment_method,
      reference,
      concept,
      status,
      payment_type,
      shift_session_id
    ) VALUES (
      v_sales_order_id,
      v_extra_hour_price,
      'PENDIENTE',
      'AEH-' || to_char(NOW(), 'YYYYMMDDHH24MISS') || '-' || substring(md5(random()::text) from 1 for 6),
      'EXTRA_HOUR',
      'PENDIENTE',
      'COMPLETO',
      v_shift_session_id
    );

    -- Avanzar el horario de salida esperado
    v_current_expected := v_current_expected + INTERVAL '1 hour';
    v_hours_added := v_hours_added + 1;

    -- Límite de seguridad para evitar bucles infinitos
    IF v_hours_added >= 24 THEN EXIT; END IF;
  END LOOP;

  -- 5. Actualizar totales y estado de la habitación si hubo cambios
  IF v_hours_added > 0 THEN
    -- Actualizar horario de salida en la estancia
    UPDATE room_stays 
    SET expected_check_out_at = v_current_expected
    WHERE id = p_stay_id;

    -- Actualizar totales de la orden (subtotal y saldo restante)
    UPDATE sales_orders
    SET 
      subtotal = subtotal + (v_extra_hour_price * v_hours_added),
      total = total + (v_extra_hour_price * v_hours_added),
      remaining_amount = remaining_amount + (v_extra_hour_price * v_hours_added)
    WHERE id = v_sales_order_id;
    
    -- Bloquear la habitación automáticamente
    UPDATE rooms 
    SET status = 'BLOQUEADA' 
    WHERE id = (SELECT room_id FROM room_stays WHERE id = p_stay_id AND status = 'ACTIVA');
  END IF;

  RETURN jsonb_build_object('success', true, 'hours_added', v_hours_added);

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION process_extra_hours_v2(UUID) IS 'Procesa horas extra pendientes de forma atómica con bloqueo FOR UPDATE para evitar race conditions. Crea items de venta y pagos pendientes, actualiza totales y bloquea la habitación.';
