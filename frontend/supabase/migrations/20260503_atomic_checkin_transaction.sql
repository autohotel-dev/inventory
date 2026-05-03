-- ==============================================================================
-- MIGRATION: Atomic Check-In Transaction & Orphan State Prevention
-- Description:
-- 1. Creates process_checkin_transaction RPC for atomic check-in
-- 2. Prevents race conditions with FOR UPDATE room lock
-- 3. All-or-nothing: if any step fails, everything rolls back
-- ==============================================================================

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
  p_payment_data JSONB DEFAULT '[]'::JSONB
) RETURNS JSONB AS $$
DECLARE
  v_room_status TEXT;
  v_sales_order_id UUID;
  v_stay_id UUID;
  v_guest_token UUID;
  v_service_product_id UUID;
  v_shift_session_id UUID;
  v_employee_id UUID;
  v_payment_record JSONB;
  v_main_payment_id UUID;
  v_payment_count INTEGER;
  v_is_multipago BOOLEAN;
  v_is_pagado BOOLEAN;
BEGIN
  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 0: Lock room row and validate availability (prevents double check-in)
  -- ═══════════════════════════════════════════════════════════════════
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

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 1: Resolve shift session and employee
  -- ═══════════════════════════════════════════════════════════════════
  SELECT ss.id INTO v_shift_session_id
  FROM shift_sessions ss
  JOIN employees e ON e.id = ss.employee_id
  WHERE e.auth_user_id = auth.uid()
    AND ss.status = 'active'
  LIMIT 1;

  SELECT e.id INTO v_employee_id
  FROM employees e
  WHERE e.auth_user_id = auth.uid()
  LIMIT 1;

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 2: Create Sales Order
  -- ═══════════════════════════════════════════════════════════════════
  INSERT INTO sales_orders (
    customer_id, warehouse_id, currency, notes,
    subtotal, tax, total, status,
    remaining_amount, paid_amount,
    created_by, shift_session_id
  ) VALUES (
    NULL, p_warehouse_id, 'MXN', p_notes,
    p_total_price, 0, p_total_price, 'OPEN',
    GREATEST(0, p_total_price - p_total_paid), p_total_paid,
    auth.uid(), v_shift_session_id
  ) RETURNING id INTO v_sales_order_id;

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 3: Get or create SVC-ROOM product
  -- ═══════════════════════════════════════════════════════════════════
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

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 4: Create Sales Order Items
  -- ═══════════════════════════════════════════════════════════════════
  -- Base room item
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

  -- Extra person items
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

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 5: Create Payments
  -- ═══════════════════════════════════════════════════════════════════
  v_payment_count := jsonb_array_length(p_payment_data);
  v_is_multipago := v_payment_count > 1;
  v_is_pagado := p_total_paid >= p_base_price;

  IF v_payment_count > 0 THEN
    IF v_is_multipago THEN
      -- MULTIPAGO: Main payment + sub-payments
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
        auth.uid(), v_shift_session_id, v_employee_id
      ) RETURNING id INTO v_main_payment_id;

      -- Sub-payments
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
            auth.uid(), v_shift_session_id, v_employee_id,
            v_payment_record->>'terminal',
            v_payment_record->>'cardLast4',
            v_payment_record->>'cardType'
          );
        END IF;
      END LOOP;

    ELSE
      -- PAGO ÚNICO
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
          auth.uid(), v_shift_session_id, v_employee_id,
          v_payment_record->>'terminal',
          v_payment_record->>'cardLast4',
          v_payment_record->>'cardType'
        );
      END IF;
    END IF;
  END IF;

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 6: Create Room Stay
  -- ═══════════════════════════════════════════════════════════════════
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

  -- ═══════════════════════════════════════════════════════════════════
  -- STEP 7: Update room status to OCUPADA
  -- ═══════════════════════════════════════════════════════════════════
  UPDATE rooms SET status = 'OCUPADA' WHERE id = p_room_id;

  -- ═══════════════════════════════════════════════════════════════════
  -- SUCCESS: Return all created IDs
  -- ═══════════════════════════════════════════════════════════════════
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
