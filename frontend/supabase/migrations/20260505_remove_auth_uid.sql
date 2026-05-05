-- ==============================================================================
-- MIGRATION: Remove auth.uid() dependencies for Cognito Migration
-- Description:
-- 1. Updates process_checkin_transaction to accept p_employee_id
-- 2. Updates process_checkout_transaction to accept p_employee_id
-- ==============================================================================

-- 1. Update Check-In RPC
CREATE OR REPLACE FUNCTION process_checkin_transaction(
  p_room_id UUID,
  p_warehouse_id UUID,
  p_room_type_name TEXT,
  p_room_number TEXT,
  p_base_price NUMERIC,
  p_total_price NUMERIC,
  p_total_paid NUMERIC,
  p_initial_people INTEGER,
  p_check_in_at TIMESTAMPTZ,
  p_expected_checkout_at TIMESTAMPTZ,
  p_extra_person_price NUMERIC DEFAULT 0,
  p_extra_people_count INTEGER DEFAULT 0,
  p_vehicle_plate TEXT DEFAULT NULL,
  p_vehicle_brand TEXT DEFAULT NULL,
  p_vehicle_model TEXT DEFAULT NULL,
  p_is_hotel BOOLEAN DEFAULT FALSE,
  p_duration_nights INTEGER DEFAULT 1,
  p_notes TEXT DEFAULT '',
  p_payment_data JSONB DEFAULT '[]'::JSONB,
  p_employee_id UUID DEFAULT NULL -- NEW PARAMETER
) RETURNS JSONB AS $$
DECLARE
  v_room_status TEXT;
  v_sales_order_id UUID;
  v_stay_id UUID;
  v_guest_token UUID;
  v_service_product_id UUID;
  v_shift_session_id UUID;
  v_employee_id UUID;
  v_auth_user_id UUID;
  v_payment_record JSONB;
  v_main_payment_id UUID;
  v_payment_count INTEGER;
  v_is_multipago BOOLEAN;
  v_is_pagado BOOLEAN;
BEGIN
  -- Validate Room Lock
  SELECT status INTO v_room_status
  FROM rooms
  WHERE id = p_room_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Habitación no encontrada');
  END IF;

  IF v_room_status != 'LIBRE' THEN
    RETURN jsonb_build_object('success', false, 'error', 
      format('Habitación %s ya no está disponible. Estado actual: %s', p_room_number, v_room_status));
  END IF;

  -- Resolve Shift Session and Employee
  -- Fallback to auth.uid() if p_employee_id is not provided (for backward compatibility)
  IF p_employee_id IS NOT NULL THEN
    v_employee_id := p_employee_id;
    SELECT auth_user_id INTO v_auth_user_id FROM employees WHERE id = p_employee_id LIMIT 1;
  ELSE
    SELECT e.id, e.auth_user_id INTO v_employee_id, v_auth_user_id
    FROM employees e
    WHERE e.auth_user_id = auth.uid()
    LIMIT 1;
  END IF;

  SELECT ss.id INTO v_shift_session_id
  FROM shift_sessions ss
  WHERE ss.employee_id = v_employee_id
    AND ss.status = 'active'
  LIMIT 1;

  -- Create Sales Order
  INSERT INTO sales_orders (
    customer_id, warehouse_id, currency, notes,
    subtotal, tax, total, status,
    remaining_amount, paid_amount,
    created_by, shift_session_id
  ) VALUES (
    NULL, p_warehouse_id, 'MXN', p_notes,
    p_total_price, 0, p_total_price, 'OPEN',
    GREATEST(0, p_total_price - p_total_paid), p_total_paid,
    v_auth_user_id, v_shift_session_id
  ) RETURNING id INTO v_sales_order_id;

  -- Get or create SVC-ROOM
  SELECT id INTO v_service_product_id
  FROM products
  WHERE sku = 'SVC-ROOM'
  LIMIT 1;

  IF v_service_product_id IS NULL THEN
    INSERT INTO products (name, sku, description, price, cost, unit, min_stock, is_active)
    VALUES ('Servicio de Habitación', 'SVC-ROOM', 
            'Servicios de habitación (estancia, horas extra, personas extra)', 
            0, 0, 'SVC', 0, true)
    RETURNING id INTO v_service_product_id;
  END IF;

  -- Create Sales Order Items
  INSERT INTO sales_order_items (
    sales_order_id, product_id, qty, unit_price,
    concept_type, is_paid, paid_at, payment_method
  ) VALUES (
    v_sales_order_id, v_service_product_id,
    CASE WHEN p_is_hotel THEN p_duration_nights ELSE 1 END,
    p_base_price, 'ROOM_BASE',
    p_total_paid >= p_base_price,
    CASE WHEN p_total_paid >= p_base_price THEN NOW() ELSE NULL END,
    CASE WHEN p_total_paid >= p_base_price THEN
      CASE WHEN jsonb_array_length(p_payment_data) = 1 
        THEN p_payment_data->0->>'method' 
        ELSE 'MIXTO' END
    ELSE NULL END
  );

  IF p_extra_people_count > 0 AND p_extra_person_price > 0 THEN
    FOR i IN 1..p_extra_people_count LOOP
      DECLARE
        v_item_threshold NUMERIC := p_base_price + (i * p_extra_person_price);
        v_is_paid_up_to BOOLEAN := p_total_paid >= v_item_threshold;
      BEGIN
        INSERT INTO sales_order_items (
          sales_order_id, product_id, qty, unit_price,
          concept_type, is_paid, paid_at, payment_method
        ) VALUES (
          v_sales_order_id, v_service_product_id,
          CASE WHEN p_is_hotel THEN p_duration_nights ELSE 1 END,
          p_extra_person_price, 'EXTRA_PERSON',
          v_is_paid_up_to,
          CASE WHEN v_is_paid_up_to THEN NOW() ELSE NULL END,
          CASE WHEN v_is_paid_up_to THEN
            CASE WHEN jsonb_array_length(p_payment_data) = 1
              THEN p_payment_data->0->>'method'
              ELSE 'MIXTO' END
          ELSE NULL END
        );
      END;
    END LOOP;
  END IF;

  -- Create Payments
  v_payment_count := jsonb_array_length(p_payment_data);
  v_is_multipago := v_payment_count > 1;
  v_is_pagado := p_total_paid >= p_base_price;

  IF v_payment_count > 0 THEN
    IF v_is_multipago THEN
      INSERT INTO payments (
        sales_order_id, amount, payment_method, reference,
        concept, status, payment_type,
        created_by, shift_session_id, employee_id
      ) VALUES (
        v_sales_order_id, p_base_price, 'PENDIENTE',
        'EST-' || to_char(NOW(), 'YYMMDD-HH24MISS'),
        'ESTANCIA',
        CASE WHEN v_is_pagado THEN 'PAGADO' ELSE 'PENDIENTE' END,
        'COMPLETO',
        v_auth_user_id, v_shift_session_id, v_employee_id
      ) RETURNING id INTO v_main_payment_id;

      FOR v_payment_record IN SELECT * FROM jsonb_array_elements(p_payment_data)
      LOOP
        IF (v_payment_record->>'amount')::NUMERIC > 0 THEN
          INSERT INTO payments (
            sales_order_id, amount, payment_method, reference,
            concept, status, payment_type, parent_payment_id,
            created_by, shift_session_id, employee_id,
            terminal_code, card_last_4, card_type
          ) VALUES (
            v_sales_order_id,
            (v_payment_record->>'amount')::NUMERIC,
            v_payment_record->>'method',
            COALESCE(v_payment_record->>'reference', 'SUB-' || to_char(NOW(), 'YYMMDD-HH24MISS')),
            'ESTANCIA', 'PAGADO', 'PARCIAL', v_main_payment_id,
            v_auth_user_id, v_shift_session_id, v_employee_id,
            v_payment_record->>'terminal',
            v_payment_record->>'cardLast4',
            v_payment_record->>'cardType'
          );
        END IF;
      END LOOP;
    ELSE
      v_payment_record := p_payment_data->0;
      IF (v_payment_record->>'amount')::NUMERIC > 0 THEN
        INSERT INTO payments (
          sales_order_id, amount, payment_method, reference,
          concept, status, payment_type,
          created_by, shift_session_id, employee_id,
          terminal_code, card_last_4, card_type
        ) VALUES (
          v_sales_order_id,
          (v_payment_record->>'amount')::NUMERIC,
          v_payment_record->>'method',
          COALESCE(v_payment_record->>'reference', 'EST-' || to_char(NOW(), 'YYMMDD-HH24MISS')),
          'ESTANCIA', 'PAGADO', 'COMPLETO',
          v_auth_user_id, v_shift_session_id, v_employee_id,
          v_payment_record->>'terminal',
          v_payment_record->>'cardLast4',
          v_payment_record->>'cardType'
        );
      END IF;
    END IF;
  END IF;

  -- Create Room Stay
  v_guest_token := gen_random_uuid();

  INSERT INTO room_stays (
    room_id, sales_order_id, check_in_at, expected_check_out_at,
    status, current_people, total_people,
    vehicle_plate, vehicle_brand, vehicle_model,
    valet_employee_id, checkout_valet_employee_id,
    guest_access_token, shift_session_id
  ) VALUES (
    p_room_id, v_sales_order_id, p_check_in_at, p_expected_checkout_at,
    'ACTIVA', p_initial_people, p_initial_people,
    p_vehicle_plate, p_vehicle_brand, p_vehicle_model,
    NULL, NULL,
    v_guest_token, v_shift_session_id
  ) RETURNING id INTO v_stay_id;

  -- Update room status
  UPDATE rooms SET status = 'OCUPADA' WHERE id = p_room_id;

  RETURN jsonb_build_object(
    'success', true,
    'sales_order_id', v_sales_order_id,
    'stay_id', v_stay_id,
    'guest_access_token', v_guest_token
  );
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. Update Checkout RPC
CREATE OR REPLACE FUNCTION process_checkout_transaction(
  p_stay_id UUID,
  p_sales_order_id UUID,
  p_payment_data JSONB,
  p_checkout_valet_id UUID DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL -- NEW PARAMETER
) RETURNS JSONB AS $$
DECLARE
  v_room_id UUID;
  v_stay_status TEXT;
  v_tolerance_started_at TIMESTAMPTZ;
  v_payment_record JSONB;
  v_checkout_shift_session_id UUID;
  v_employee_id UUID;
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

  -- Attempt to get shift session
  IF p_employee_id IS NOT NULL THEN
    v_employee_id := p_employee_id;
  ELSE
    SELECT id INTO v_employee_id FROM employees WHERE auth_user_id = auth.uid() LIMIT 1;
  END IF;

  SELECT id INTO v_checkout_shift_session_id 
  FROM shift_sessions 
  WHERE employee_id = v_employee_id
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

-- ==============================================================================
-- 3. Drop Notification Triggers (Logic moved to FastAPI)
-- ==============================================================================
DROP TRIGGER IF EXISTS trigger_room_dirty_notification ON rooms;
DROP TRIGGER IF EXISTS trigger_notify_cochero_new_entry ON room_stays;
DROP TRIGGER IF EXISTS trigger_check_low_stock ON products;

-- 4. Audit Triggers - We decided to keep them but we might need to remove them 
-- if they crash without auth.uid(). However, the ones that matter (log_payment, log_check_in)
-- use NEW.employee_id so they are safe.
-- For system_config_updated_at and similar updated_by triggers, we drop them to use SQLAlchemy:
DROP TRIGGER IF EXISTS system_config_updated_at ON system_config;
